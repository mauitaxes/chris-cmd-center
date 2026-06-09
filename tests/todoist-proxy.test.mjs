import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TODOIST_API_TOKEN = "tdt_TESTTOKEN";

const {
  restPriorityToMcp,
  mcpPriorityToRest,
  normalizeRestTask,
  normalizeActivityEvent,
  dispatch,
  handler,
  resolveInboxId,
} = await import("../netlify/functions/todoist-proxy.js");

const FULL = (s) => "mcp__b9779bcc-3581-4f0e-bef4-401bb840378a__" + s;

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts, method: opts.method || "GET", auth: (opts.headers || {}).Authorization });
    const r = routes.find((x) => x.match(url, opts));
    if (!r) throw new Error("no mock route for " + (opts.method || "GET") + " " + url);
    const data = await r.respond(url, opts);
    return { ok: data.ok !== false, status: data.status || 200, json: async () => data.body, text: async () => JSON.stringify(data.body) };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

// ---- pure mappers ----
test("restPriorityToMcp inverts Todoist REST priority (4=highest -> p1)", () => {
  assert.equal(restPriorityToMcp(4), "p1");
  assert.equal(restPriorityToMcp(3), "p2");
  assert.equal(restPriorityToMcp(2), "p3");
  assert.equal(restPriorityToMcp(1), "p4");
  assert.equal(restPriorityToMcp(undefined), "p4");
});

test("normalizeRestTask maps REST v2 shape -> client/MCP shape", () => {
  const out = normalizeRestTask({
    id: 123, content: "Pay GET tax", description: "[ccid:abc]",
    priority: 4, project_id: 6789, labels: ["today"],
    is_completed: false, due: { date: "2026-06-10", is_recurring: true },
  });
  assert.equal(out.id, "123");
  assert.equal(out.content, "Pay GET tax");
  assert.equal(out.priority, "p1");          // inverted
  assert.equal(out.projectId, "6789");        // snake -> camel, stringified
  assert.equal(out.dueDate, "2026-06-10");
  assert.equal(out.recurring, true);
  assert.equal(out.checked, false);
  assert.deepEqual(out.labels, ["today"]);
});

test("normalizeRestTask: no due -> no dueDate key; default priority -> p4", () => {
  const out = normalizeRestTask({ id: 1, content: "x", priority: 1, project_id: 2 });
  assert.equal("dueDate" in out, false);
  assert.equal(out.priority, "p4");
  assert.equal(out.recurring, false);
});

test("normalizeActivityEvent maps sync event -> MCP event shape (incl. isRecurring)", () => {
  const out = normalizeActivityEvent({
    object_type: "item", object_id: "6gqCfg829g2j346V", event_type: "completed",
    event_date: "2026-06-08T19:58:53.903Z", parent_project_id: "6gqCVgp6xQ44R2V3",
    initiator_id: 59362469, extra_data: { is_recurring: true, content: "SPIKE" },
  });
  assert.equal(out.eventType, "completed");
  assert.equal(out.parentProjectId, "6gqCVgp6xQ44R2V3");
  assert.equal(out.eventDate, "2026-06-08T19:58:53.903Z");
  assert.equal(out.extraData.isRecurring, true);
});

// ---- dispatch (injected fetch) ----
test("dispatch find-tasks: GETs /tasks?project_id with Bearer auth, returns {tasks}", async () => {
  const fetchImpl = mockFetch([
    { match: (u) => u.includes("/api/v1/tasks"),
      respond: () => ({ body: { results: [
        { id: 1, content: "A", priority: 4, project_id: 6789, due: { date: "2026-06-10" }, is_completed: false, labels: [] },
        { id: 2, content: "B", priority: 1, project_id: 6789, is_completed: false, labels: [] },
      ] } }) },
  ]);
  const r = await dispatch({ name: FULL("find-tasks"), args: { projectId: "6789" }, fetchImpl });
  assert.equal(r.tasks.length, 2);
  assert.equal(r.tasks[0].priority, "p1");
  assert.equal(r.totalCount, 2);
  assert.match(fetchImpl.calls[0].url, /project_id=6789/);
  assert.equal(fetchImpl.calls[0].auth, "Bearer tdt_TESTTOKEN");
});

test("dispatch find-activity: GETs activity/get for completed events, returns {events}", async () => {
  const fetchImpl = mockFetch([
    { match: (u) => u.includes("/sync/v9/activity/get"),
      respond: () => ({ body: { events: [
        { object_type: "item", object_id: "X", event_type: "completed",
          event_date: "2026-06-08T19:58:53.903Z", parent_project_id: "6gqCVgp6xQ44R2V3",
          extra_data: { is_recurring: true } },
      ], count: 1 } }) },
  ]);
  const r = await dispatch({ name: FULL("find-activity"), args: { eventType: "completed", projectId: "6gqCVgp6xQ44R2V3" }, fetchImpl });
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].parentProjectId, "6gqCVgp6xQ44R2V3");
  assert.match(fetchImpl.calls[0].url, /event_type=completed/);
});

test("dispatch unknown op -> 400", async () => {
  await assert.rejects(
    () => dispatch({ name: FULL("delete-everything"), args: {}, fetchImpl: mockFetch([]) }),
    /not allowed/i
  );
});

test("handler rejects non-allowed op with 400", async () => {
  const res = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ name: FULL("delete-everything"), args: {} }) });
  assert.equal(res.statusCode, 400);
});

test("dispatch find-tasks projectId=inbox: resolves inbox id via /projects, then queries by that id", async () => {
  const fetchImpl = mockFetch([
    { match: (u) => u.includes("/api/v1/projects"),
      respond: () => ({ body: { results: [
        { id: 6001, name: "Inbox", is_inbox_project: true },
        { id: 6002, name: "Command Center", is_inbox_project: false },
      ] } }) },
    { match: (u) => u.includes("/api/v1/tasks"),
      respond: () => ({ body: { results: [
        { id: 9, content: "stray note", priority: 1, project_id: 6001, is_completed: false, labels: [] },
      ] } }) },
  ]);
  const r = await dispatch({ name: FULL("find-tasks"), args: { projectId: "inbox" }, fetchImpl });
  assert.equal(r.tasks.length, 1);
  // first call hits /projects, second hits /tasks with the RESOLVED numeric id (not "inbox")
  assert.match(fetchImpl.calls[0].url, /\/projects/);
  assert.match(fetchImpl.calls[1].url, /project_id=6001/);
  assert.doesNotMatch(fetchImpl.calls[1].url, /project_id=inbox/);
});

test("resolveInboxId returns the inbox project id (tolerates is_inbox_project flag variants)", async () => {
  const fetchImpl = mockFetch([
    { match: (u) => u.includes("/api/v1/projects"),
      respond: () => ({ body: { results: [
        { id: 1, name: "Work", inbox_project: false },
        { id: 42, name: "Inbox", inbox_project: true },
      ] } }) },
  ]);
  assert.equal(await resolveInboxId(fetchImpl), "42");
});

// ---- Task 5: write ops (add-tasks, complete-tasks) ----
test("mcpPriorityToRest inverts client priority back to REST (p1 -> 4, default -> 1)", () => {
  assert.equal(mcpPriorityToRest("p1"), 4);
  assert.equal(mcpPriorityToRest("p2"), 3);
  assert.equal(mcpPriorityToRest("p3"), 2);
  assert.equal(mcpPriorityToRest("p4"), 1);
  assert.equal(mcpPriorityToRest(undefined), 1);
});

test("dispatch add-tasks: POSTs /tasks, inverts priority, sets X-Request-Id, returns {tasks}", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => u.endsWith("/api/v1/tasks") && o.method === "POST",
      respond: (u, o) => { const b = JSON.parse(o.body); return { body: { id: 555, content: b.content, priority: b.priority, project_id: b.project_id, labels: [], is_completed: false } }; } },
  ]);
  const r = await dispatch({ name: FULL("add-tasks"), args: { tasks: [{ content: "Pay GET", projectId: "6789", priority: "p1" }], requestId: "req-abc" }, fetchImpl });
  assert.equal(r.tasks.length, 1);
  assert.equal(r.tasks[0].id, "555");
  assert.equal(r.tasks[0].content, "Pay GET");
  assert.equal(r.tasks[0].priority, "p1");
  const c = fetchImpl.calls[0];
  assert.equal(c.method, "POST");
  const body = JSON.parse(c.opts.body);
  assert.equal(body.content, "Pay GET");
  assert.equal(body.project_id, "6789");
  assert.equal(body.priority, 4);                       // p1 -> REST 4
  assert.equal((c.opts.headers || {})["X-Request-Id"], "req-abc"); // single task: raw key
  assert.equal(c.auth, "Bearer tdt_TESTTOKEN");
  assert.equal("requestId" in body, false);             // never leaked into REST body
});

test("dispatch add-tasks: projectId 'inbox' (or absent) -> no project_id (REST defaults to Inbox)", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => u.endsWith("/api/v1/tasks") && o.method === "POST",
      respond: (u, o) => ({ body: { id: 1, content: JSON.parse(o.body).content, priority: 1, labels: [], is_completed: false } }) },
  ]);
  await dispatch({ name: FULL("add-tasks"), args: { tasks: [{ content: "stray", projectId: "inbox" }] }, fetchImpl });
  const body = JSON.parse(fetchImpl.calls[0].opts.body);
  assert.equal("project_id" in body, false);
});

test("dispatch add-tasks: multiple tasks get per-item X-Request-Id suffixes (no dedupe collision)", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => u.endsWith("/api/v1/tasks") && o.method === "POST",
      respond: (u, o) => ({ body: { id: Math.floor(Math.random()*1e6), content: JSON.parse(o.body).content, priority: 1, labels: [], is_completed: false } }) },
  ]);
  await dispatch({ name: FULL("add-tasks"), args: { tasks: [{ content: "a", projectId: "inbox" }, { content: "b", projectId: "inbox" }], requestId: "req-multi" }, fetchImpl });
  assert.equal((fetchImpl.calls[0].opts.headers || {})["X-Request-Id"], "req-multi-0");
  assert.equal((fetchImpl.calls[1].opts.headers || {})["X-Request-Id"], "req-multi-1");
});

test("dispatch complete-tasks: POSTs /tasks/{id}/close per id with X-Request-Id, returns success", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => /\/api\/v1\/tasks\/\d+\/close$/.test(u) && o.method === "POST",
      respond: () => ({ status: 204, body: null }) },
  ]);
  const r = await dispatch({ name: FULL("complete-tasks"), args: { ids: ["111", "222"], requestId: "req-xyz" }, fetchImpl });
  assert.equal(r.completed, 2);
  assert.deepEqual(r.ids, ["111", "222"]);
  assert.equal(fetchImpl.calls.length, 2);
  assert.match(fetchImpl.calls[0].url, /\/tasks\/111\/close$/);
  assert.equal((fetchImpl.calls[0].opts.headers || {})["X-Request-Id"], "req-xyz-0");
});

test("handler allow-list now permits add-tasks (reaches dispatch -> 200)", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ id: 9, content: "x", priority: 1, labels: [], is_completed: false }), text: async () => "{}" });
  try {
    const res = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ name: FULL("add-tasks"), args: { tasks: [{ content: "x", projectId: "inbox" }] } }) });
    assert.equal(res.statusCode, 200);
  } finally { globalThis.fetch = orig; }
});

// ---- Task 6: update-tasks (defer writes: label-only + dated snooze) ----
test("dispatch update-tasks: POSTs /tasks/{id} with labels body + X-Request-Id, returns {tasks}", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => /\/api\/v1\/tasks\/\d+$/.test(u) && o.method === "POST",
      respond: (u, o) => { const b = JSON.parse(o.body); return { body: { id: 777, content: "deferred", priority: 1, labels: b.labels || [], is_completed: false } }; } },
  ]);
  const r = await dispatch({ name: FULL("update-tasks"), args: { tasks: [{ id: "777", labels: ["energy-low"] }], requestId: "req-def" }, fetchImpl });
  assert.equal(r.tasks.length, 1);
  assert.equal(r.tasks[0].id, "777");
  const c = fetchImpl.calls[0];
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/v1\/tasks\/777$/);
  const body = JSON.parse(c.opts.body);
  assert.deepEqual(body.labels, ["energy-low"]);        // today label dropped client-side
  assert.equal("due_date" in body, false);               // label-only write: no date key
  assert.equal((c.opts.headers || {})["X-Request-Id"], "req-def"); // single task: raw key
  assert.equal(c.auth, "Bearer tdt_TESTTOKEN");
  assert.equal("requestId" in body, false);              // never leaked into REST body
  assert.equal("id" in body, false);                     // id is in the URL, not the body
});

test("dispatch update-tasks: dated snooze sends due_date, omits labels when not provided", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => /\/api\/v1\/tasks\/\d+$/.test(u) && o.method === "POST",
      respond: (u, o) => ({ body: { id: 888, content: "x", priority: 1, labels: [], is_completed: false, due: { date: JSON.parse(o.body).due_date } } }) },
  ]);
  const r = await dispatch({ name: FULL("update-tasks"), args: { tasks: [{ id: "888", due_date: "2026-06-09" }] }, fetchImpl });
  assert.equal(r.tasks[0].id, "888");
  const body = JSON.parse(fetchImpl.calls[0].opts.body);
  assert.equal(body.due_date, "2026-06-09");
  assert.equal("labels" in body, false);                 // dated-only write: no labels key
});

test("dispatch update-tasks: combined labels + due_date in one body", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => /\/api\/v1\/tasks\/\d+$/.test(u) && o.method === "POST",
      respond: (u, o) => ({ body: { id: 999, content: "x", priority: 1, labels: JSON.parse(o.body).labels, is_completed: false } }) },
  ]);
  await dispatch({ name: FULL("update-tasks"), args: { tasks: [{ id: "999", labels: ["energy-low"], due_date: "2026-06-09" }] }, fetchImpl });
  const body = JSON.parse(fetchImpl.calls[0].opts.body);
  assert.deepEqual(body.labels, ["energy-low"]);
  assert.equal(body.due_date, "2026-06-09");
});

test("dispatch update-tasks: multiple tasks get per-item X-Request-Id suffixes", async () => {
  const fetchImpl = mockFetch([
    { match: (u, o) => /\/api\/v1\/tasks\/\d+$/.test(u) && o.method === "POST",
      respond: (u, o) => ({ body: { id: Math.floor(Math.random()*1e6), content: "x", priority: 1, labels: [], is_completed: false } }) },
  ]);
  await dispatch({ name: FULL("update-tasks"), args: { tasks: [{ id: "1", labels: [] }, { id: "2", labels: [] }], requestId: "req-multi" }, fetchImpl });
  assert.equal((fetchImpl.calls[0].opts.headers || {})["X-Request-Id"], "req-multi-0");
  assert.equal((fetchImpl.calls[1].opts.headers || {})["X-Request-Id"], "req-multi-1");
  assert.match(fetchImpl.calls[0].url, /\/tasks\/1$/);
  assert.match(fetchImpl.calls[1].url, /\/tasks\/2$/);
});

test("handler allow-list now permits update-tasks (reaches dispatch -> 200)", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ id: 9, content: "x", priority: 1, labels: [], is_completed: false }), text: async () => "{}" });
  try {
    const res = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ name: FULL("update-tasks"), args: { tasks: [{ id: "9", labels: [] }] } }) });
    assert.equal(res.statusCode, 200);
  } finally { globalThis.fetch = orig; }
});

// ---- Task 10: 429 Retry-After passthrough ----
test("dispatch: upstream 429 throws err carrying statusCode 429 + retryAfter", async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, headers: { get: (k) => (String(k).toLowerCase() === "retry-after" ? "30" : null) }, json: async () => ({ error: "rate limited" }), text: async () => "rate limited" });
  await assert.rejects(
    () => dispatch({ name: FULL("find-tasks"), args: { projectId: "1" }, fetchImpl }),
    (e) => e.statusCode === 429 && e.retryAfter === "30"
  );
});

test("handler: 429 forwards Retry-After response header", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 429, headers: { get: (k) => (String(k).toLowerCase() === "retry-after" ? "45" : null) }, json: async () => ({ error: "rate" }), text: async () => "rate" });
  try {
    const res = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ name: FULL("find-tasks"), args: { projectId: "1" } }) });
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers["Retry-After"], "45");
  } finally { globalThis.fetch = orig; }
});
