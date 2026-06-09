// Netlify serverless Todoist proxy for Command Center.
// Holds TODOIST_API_TOKEN server-side; emulates the MCP output shapes the client (app.c.js TT) expects.
// Mirrors notion-proxy.js: exported pure helpers + dispatch({name,args,fetchImpl}) + handler.
// Task 3 READS: find-tasks, find-activity, find-projects. Task 5 WRITES: add-tasks, complete-tasks. Task 6 WRITE: update-tasks (defer; X-Request-Id idempotency).

const REST_BASE = "https://api.todoist.com/api/v1";  // unified v1 (REST v2 retired 2025 -> 410 Gone); paginated {results:[]} handled below
const SYNC_BASE = "https://api.todoist.com/sync/v9";

// ---- pure helpers (exported for tests) ----

function suffix(name) {
  const parts = String(name).split("__");
  return parts[parts.length - 1];
}

// Todoist REST priority is INVERTED vs the MCP/client: REST 4 = highest -> "p1"; REST 1 = default -> "p4".
export function restPriorityToMcp(p) {
  switch (Number(p)) {
    case 4: return "p1";
    case 3: return "p2";
    case 2: return "p3";
    default: return "p4";
  }
}

// Inverse of restPriorityToMcp: client/MCP "p1"(highest) -> REST 4; "p4"(default) -> REST 1.
export function mcpPriorityToRest(p) {
  switch (String(p)) {
    case "p1": return 4;
    case "p2": return 3;
    case "p3": return 2;
    default: return 1;
  }
}

// REST v2 task -> the MCP find-tasks task shape the client already consumes.
export function normalizeRestTask(t) {
  t = t || {};
  const due = t.due || null;
  const out = {
    id: String(t.id),
    content: t.content || "",
    description: t.description || "",
    recurring: !!(due && due.is_recurring),
    priority: restPriorityToMcp(t.priority),
    projectId: t.project_id != null ? String(t.project_id) : "",
    labels: Array.isArray(t.labels) ? t.labels : [],
    checked: !!(t.is_completed || t.checked),
  };
  if (due && due.date) out.dueDate = String(due.date).slice(0, 10);
  return out;
}

// Todoist Sync activity event -> the MCP find-activity event shape (camelCase).
// The streak/progress path only relies on eventType + parentProjectId + eventDate; extraData is informational.
export function normalizeActivityEvent(e) {
  e = e || {};
  const ex = e.extra_data || e.extraData || {};
  return {
    objectType: e.object_type || e.objectType || "",
    objectId: e.object_id != null ? String(e.object_id) : "",
    eventType: e.event_type || e.eventType || "",
    eventDate: e.event_date || e.eventDate || "",
    parentProjectId: e.parent_project_id != null ? String(e.parent_project_id) : (e.parentProjectId || ""),
    initiatorId: e.initiator_id != null ? String(e.initiator_id) : "",
    extraData: Object.assign({}, ex, { isRecurring: !!(ex.is_recurring || ex.isRecurring) }),
  };
}

function authHeaders() {
  return {
    Authorization: "Bearer " + process.env.TODOIST_API_TOKEN,
    "Content-Type": "application/json",
  };
}

async function todoistReq(fetchImpl, method, url, body, extraHeaders) {
  const opts = { method, headers: Object.assign(authHeaders(), extraHeaders || {}) };
  if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
  const res = await fetchImpl(url, opts);
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || ("todoist error " + res.status);
    const err = new Error(msg);
    err.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  return data;
}

// Resolve the literal "inbox" projectId -> the real inbox project id. REST /tasks rejects
// "inbox"; the MCP accepts it. We mirror the MCP by looking up is_inbox_project from /projects.
export async function resolveInboxId(fetchImpl) {
  const data = await todoistReq(fetchImpl, "GET", REST_BASE + "/projects");
  const arr = Array.isArray(data) ? data : (data.results || []);
  const inbox = arr.find((p) => p.is_inbox_project || p.inbox_project || p.isInboxProject || p.inboxProject);
  return inbox ? String(inbox.id) : "";
}

// ---- core dispatch (injectable fetchImpl) ----
export async function dispatch({ name, args, fetchImpl }) {
  const f = fetchImpl || globalThis.fetch;
  const op = suffix(name);
  args = args || {};

  switch (op) {
    case "find-tasks": {
      const qs = [];
      let projectId = args.projectId;
      if (projectId && String(projectId).toLowerCase() === "inbox") {
        projectId = await resolveInboxId(f);   // REST needs the real id, not "inbox"
      }
      if (projectId) qs.push("project_id=" + encodeURIComponent(projectId));
      if (args.filter) qs.push("filter=" + encodeURIComponent(args.filter));
      const url = REST_BASE + "/tasks" + (qs.length ? "?" + qs.join("&") : "");
      const data = await todoistReq(f, "GET", url);
      const arr = Array.isArray(data) ? data : (data.results || []);
      const tasks = arr.map(normalizeRestTask);
      return { tasks, totalCount: tasks.length, hasMore: false };
    }

    case "find-projects": {
      const data = await todoistReq(f, "GET", REST_BASE + "/projects");
      const arr = Array.isArray(data) ? data : (data.results || []);
      const projects = arr.map((p) => ({ id: String(p.id), name: p.name || "", parentId: p.parent_id != null ? String(p.parent_id) : "" }));
      return { projects };
    }

    case "find-activity": {
      const qs = [];
      qs.push("object_type=" + encodeURIComponent(args.objectType || "item"));
      qs.push("event_type=" + encodeURIComponent(args.eventType || "completed"));
      if (args.projectId) qs.push("parent_project_id=" + encodeURIComponent(args.projectId));
      qs.push("limit=" + encodeURIComponent(args.limit || 100));
      const url = SYNC_BASE + "/activity/get?" + qs.join("&");
      const data = await todoistReq(f, "GET", url);
      const events = (data.events || []).map(normalizeActivityEvent);
      return { events, count: data.count != null ? data.count : events.length };
    }

    case "add-tasks": {
      const tasks = Array.isArray(args.tasks) ? args.tasks : [];
      const reqId = args.requestId || args.request_id || null;
      const out = [];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i] || {};
        const body = { content: t.content || "" };
        const pid = t.projectId;
        if (pid && String(pid).toLowerCase() !== "inbox") body.project_id = String(pid);
        if (t.priority) body.priority = mcpPriorityToRest(t.priority);
        if (t.dueString) body.due_string = t.dueString;
        if (Array.isArray(t.labels) && t.labels.length) body.labels = t.labels;
        if (t.description) body.description = t.description;
        const hdr = reqId ? { "X-Request-Id": String(reqId) + (tasks.length > 1 ? ("-" + i) : "") } : {};
        const created = await todoistReq(f, "POST", REST_BASE + "/tasks", body, hdr);
        out.push(normalizeRestTask(created || {}));
      }
      return { tasks: out, totalCount: out.length };
    }

    case "update-tasks": {
      // Defer writes: label-only (drop "today") and/or dated snooze (+1 HST). Recurring tasks never reach here (client deep-links).
      const tasks = Array.isArray(args.tasks) ? args.tasks : [];
      const reqId = args.requestId || args.request_id || null;
      const out = [];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i] || {};
        const body = {};
        if (Array.isArray(t.labels)) body.labels = t.labels;        // [] is a valid write (clears all labels); only omit when undefined
        if (t.due_date !== undefined && t.due_date !== null) body.due_date = String(t.due_date);
        const hdr = reqId ? { "X-Request-Id": String(reqId) + (tasks.length > 1 ? ("-" + i) : "") } : {};
        const updated = await todoistReq(f, "POST", REST_BASE + "/tasks/" + encodeURIComponent(t.id), body, hdr);
        out.push(normalizeRestTask(updated || {}));
      }
      return { tasks: out, totalCount: out.length };
    }

    case "complete-tasks": {
      const ids = Array.isArray(args.ids) ? args.ids : [];
      const reqId = args.requestId || args.request_id || null;
      for (let i = 0; i < ids.length; i++) {
        const hdr = reqId ? { "X-Request-Id": String(reqId) + "-" + i } : {};
        await todoistReq(f, "POST", REST_BASE + "/tasks/" + encodeURIComponent(ids[i]) + "/close", null, hdr);
      }
      return { ids: ids.map(String), completed: ids.length };
    }

    default: {
      const err = new Error("operation not allowed: " + op);
      err.statusCode = 400;
      throw err;
    }
  }
}

// ---- Netlify handler ----
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
  if (!process.env.TODOIST_API_TOKEN) return { statusCode: 500, headers, body: JSON.stringify({ error: "server not configured" }) };

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch (_) { return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid JSON body" }) }; }

  const op = suffix(payload.name || "");
  const allowed = ["find-tasks", "find-activity", "find-projects", "add-tasks", "complete-tasks", "update-tasks"];
  if (!allowed.includes(op)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "operation not allowed" }) };
  }
  try {
    const result = await dispatch({ name: payload.name, args: payload.args });
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    const statusCode = e.statusCode || 500;
    return { statusCode, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
