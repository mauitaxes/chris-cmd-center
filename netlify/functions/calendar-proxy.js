// Netlify serverless Google Calendar proxy for Command Center (read-only Schedule lane).
// Holds Google OAuth creds server-side; emulates the Calendar MCP output shapes app.c.js (CAL) expects.
// Mirrors todoist-proxy.js: exported pure helpers + dispatch({name,args,fetchImpl}) + handler.
// Read-only: only list_events + list_calendars are allowed. Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// GOOGLE_REFRESH_TOKEN (a single-user refresh token for mauitaxes@gmail.com).

const CAL_BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function suffix(name) {
  const parts = String(name).split("__");
  return parts[parts.length - 1];
}

// Google Calendar event -> the MCP list_events event shape app.c.js normalizeCalEvent() already parses.
// Passes start/end objects ({dateTime}|{date}) through untouched; keeps summary/status/htmlLink/id.
export function normalizeCalendarEvent(e) {
  e = e || {};
  return {
    id: String(e.id || ""),
    summary: e.summary || "",
    start: e.start || {},
    end: e.end || {},
    status: e.status || "confirmed",
    htmlLink: e.htmlLink || "",
  };
}

// Exchange the long-lived refresh token for a short-lived access token (per invocation).
export async function getAccessToken(fetchImpl) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
    grant_type: "refresh_token",
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok || !data || !data.access_token) {
    const err = new Error((data && (data.error_description || data.error)) || ("token error " + res.status));
    err.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  return data.access_token;
}

async function calReq(fetchImpl, url, token) {
  const res = await fetchImpl(url, { method: "GET", headers: { Authorization: "Bearer " + token } });
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok) {
    const msg = (data && data.error && (data.error.message || data.error)) || ("calendar error " + res.status);
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.retryAfter = (res.headers && typeof res.headers.get === "function") ? res.headers.get("Retry-After") : null;
    throw err;
  }
  return data || {};
}

export async function dispatch({ name, args, fetchImpl }) {
  const f = fetchImpl || globalThis.fetch;
  const op = suffix(name);
  args = args || {};
  const token = await getAccessToken(f);

  switch (op) {
    case "list_events": {
      const calId = args.calendarId || "primary";
      const qs = ["singleEvents=true", "orderBy=startTime"];
      if (args.startTime) qs.push("timeMin=" + encodeURIComponent(args.startTime));
      if (args.endTime) qs.push("timeMax=" + encodeURIComponent(args.endTime));
      qs.push("maxResults=" + encodeURIComponent(args.pageSize || 50));
      const url = CAL_BASE + "/calendars/" + encodeURIComponent(calId) + "/events?" + qs.join("&");
      const data = await calReq(f, url, token);
      const events = (data.items || []).map(normalizeCalendarEvent);
      return { events };
    }
    case "list_calendars": {
      const data = await calReq(f, CAL_BASE + "/users/me/calendarList", token);
      const calendars = (data.items || []).map((c) => ({ id: String(c.id || ""), summary: c.summary || "", primary: !!c.primary }));
      return { calendars };
    }
    default: {
      const err = new Error("operation not allowed: " + op);
      err.statusCode = 400;
      throw err;
    }
  }
}

function corsHeaders(event) {
  const headers = { "Content-Type": "application/json" };
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  const host = h.host || h.Host;
  if (origin && host) {
    let originHost = origin;
    try { originHost = new URL(origin).host; } catch (_) {}
    if (originHost === host) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
    }
  }
  return headers;
}

export const handler = async (event) => {
  const headers = corsHeaders(event);
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method);
  if (method === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (method !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "server not configured" }) };
  }
  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch (_) { return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid JSON body" }) }; }

  const op = suffix(payload.name || "");
  const allowed = ["list_events", "list_calendars"];
  if (!allowed.includes(op)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "operation not allowed" }) };
  }
  try {
    const result = await dispatch({ name: payload.name, args: payload.args });
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    const statusCode = e.statusCode || 500;
    if (statusCode === 429 && e.retryAfter != null) headers["Retry-After"] = String(e.retryAfter);
    return { statusCode, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
