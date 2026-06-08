import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TODOIST_API_TOKEN = "tdt_TESTTOKEN";

const {
  restPriorityToMcp,
  normalizeRestTask,
  normalizeActivityEvent,
  dispatch,
  handler,
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
    { match: (u) => u.includes("/rest/v2/tasks"),
      respond: () => ({ body: [
        { id: 1, content: "A", priority: 4, project_id: 6789, due: { date: "2026-06-10" }, is_completed: false, labels: [] },
        { id: 2, content: "B", priority: 1, project_id: 6789, is_completed: false, labels: [] },
      ] }) },
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
