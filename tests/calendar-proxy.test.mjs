// Tests for the Google Calendar proxy (read-only Schedule lane). Injectable fetchImpl; no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatch, handler, normalizeCalendarEvent, getAccessToken } from "../netlify/functions/calendar-proxy.js";

const CALSERVER = "mcp__a8aed00c-e9c0-4e6d-8e3a-64452207f54f__";
const FULL = (op) => CALSERVER + op;

function mockFetch(routes) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, opts: opts || {} });
    for (const r of routes) {
      if (r.match(url, opts || {})) {
        const res = r.respond(url, opts || {});
        return {
          ok: res.ok !== false,
          status: res.status || 200,
          headers: { get: () => null },
          json: async () => res.body,
        };
      }
    }
    throw new Error("no route for " + url);
  };
  f.calls = calls;
  return f;
}

const tokenRoute = { match: (u) => u.includes("oauth2.googleapis.com/token"), respond: () => ({ body: { access_token: "ya29.fake" } }) };

test("normalizeCalendarEvent passes start/end through, keeps summary/status/htmlLink/id", () => {
  const out = normalizeCalendarEvent({ id: 7, summary: "Standup", start: { dateTime: "2026-06-08T09:00:00-10:00" }, end: { dateTime: "2026-06-08T09:30:00-10:00" }, status: "confirmed", htmlLink: "https://x" });
  assert.equal(out.id, "7");
  assert.equal(out.summary, "Standup");
  assert.deepEqual(out.start, { dateTime: "2026-06-08T09:00:00-10:00" });
  assert.equal(out.htmlLink, "https://x");
});

test("getAccessToken: POSTs refresh_token grant, returns access_token", async () => {
  const f = mockFetch([tokenRoute]);
  const tok = await getAccessToken(f);
  assert.equal(tok, "ya29.fake");
  assert.equal(f.calls[0].opts.method, "POST");
  assert.match(f.calls[0].opts.body, /grant_type=refresh_token/);
});

test("getAccessToken: throws on token error", async () => {
  const f = mockFetch([{ match: (u) => u.includes("/token"), respond: () => ({ ok: false, status: 400, body: { error: "invalid_grant" } }) }]);
  await assert.rejects(() => getAccessToken(f), /invalid_grant/);
});

test("dispatch list_events: gets token then events, returns {events} in client shape", async () => {
  const f = mockFetch([
    tokenRoute,
    { match: (u) => /\/calendars\/.+\/events\?/.test(u), respond: () => ({ body: { items: [
      { id: "e1", summary: "Lunch", start: { dateTime: "2026-06-08T12:00:00-10:00" }, end: { dateTime: "2026-06-08T13:00:00-10:00" }, status: "confirmed", htmlLink: "https://g/e1" },
      { id: "e2", summary: "Holiday", start: { date: "2026-06-08" }, end: { date: "2026-06-09" }, status: "confirmed", htmlLink: "https://g/e2" },
    ] } }) },
  ]);
  const r = await dispatch({ name: FULL("list_events"), args: { calendarId: "mauitaxes@gmail.com", startTime: "2026-06-08T10:00:00Z", endTime: "2026-06-09T10:00:00Z", pageSize: 50 }, fetchImpl: f });
  assert.equal(r.events.length, 2);
  assert.equal(r.events[0].summary, "Lunch");
  assert.equal(r.events[1].start.date, "2026-06-08");
  const evUrl = f.calls[1].url;
  assert.match(evUrl, /singleEvents=true/);
  assert.match(evUrl, /orderBy=startTime/);
  assert.match(evUrl, /timeMin=2026-06-08T10%3A00%3A00Z/);
  assert.match(evUrl, /calendars\/mauitaxes%40gmail.com\/events/);
});

test("dispatch list_calendars: returns {calendars}", async () => {
  const f = mockFetch([
    tokenRoute,
    { match: (u) => u.endsWith("/users/me/calendarList"), respond: () => ({ body: { items: [{ id: "mauitaxes@gmail.com", summary: "Personal", primary: true }] } }) },
  ]);
  const r = await dispatch({ name: FULL("list_calendars"), args: {}, fetchImpl: f });
  assert.equal(r.calendars[0].primary, true);
  assert.equal(r.calendars[0].id, "mauitaxes@gmail.com");
});

test("dispatch: disallowed op throws 400", async () => {
  const f = mockFetch([tokenRoute]);
  await assert.rejects(() => dispatch({ name: FULL("delete_event"), args: {}, fetchImpl: f }), /not allowed/);
});

test("handler: missing creds -> 500 server not configured", async () => {
  const saved = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REFRESH_TOKEN];
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; delete process.env.GOOGLE_REFRESH_TOKEN;
  try {
    const res = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ name: FULL("list_events"), args: {} }) });
    assert.equal(res.statusCode, 500);
    assert.match(res.body, /not configured/);
  } finally {
    [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REFRESH_TOKEN] = saved;
  }
});

test("handler: disallowed op rejected with 400 before dispatch", async () => {
  const saved = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REFRESH_TOKEN];
  process.env.GOOGLE_CLIENT_ID = "x"; process.env.GOOGLE_CLIENT_SECRET = "y"; process.env.GOOGLE_REFRESH_TOKEN = "z";
  try {
    const res = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ name: FULL("create_event"), args: {} }) });
    assert.equal(res.statusCode, 400);
  } finally {
    [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REFRESH_TOKEN] = saved;
  }
});
