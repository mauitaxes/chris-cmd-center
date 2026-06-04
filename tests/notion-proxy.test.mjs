import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NOTION_TOKEN = "secret_TESTTOKEN";

const {
  encodePropsToMcp,
  mcpPropsToRest,
  extractJsonFence,
  parseDataSourceUrl,
  dispatch,
  handler,
} = await import("./notion-proxy.js");

const FULL = (suffix) => "mcp__b47f7667-3cb0-4d8e-bbaf-fa1fca4c39c7__" + suffix;
const STATE_ID = "37478f3d-415b-814c-8c65-dd76b6ab9aa3";

// Build a mock fetchImpl that records requests and returns canned responses.
function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts, body: opts.body ? JSON.parse(opts.body) : undefined });
    const handler = routes.find((r) => r.match(url, opts));
    if (!handler) throw new Error("no mock route for " + (opts.method || "GET") + " " + url);
    const data = await handler.respond(url, opts);
    return {
      ok: data.ok !== false,
      status: data.status || 200,
      json: async () => data.body,
      text: async () => JSON.stringify(data.body),
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function plainText(s) {
  return [{ type: "text", text: { content: s }, plain_text: s }];
}

test("parseDataSourceUrl strips collection:// prefix", () => {
  assert.equal(parseDataSourceUrl("collection://abc-123"), "abc-123");
  assert.equal(parseDataSourceUrl("abc-123"), "abc-123");
});

test("extractJsonFence pulls JSON out of a markdown code fence", () => {
  const md = "Some text\n```json\n{\"a\":1,\"b\":2}\n```\nmore";
  assert.equal(extractJsonFence(md), "{\"a\":1,\"b\":2}");
});

test("encodePropsToMcp encodes checkbox, date, select, title, number", () => {
  const restProps = {
    Task: { type: "title", title: plainText("Write tests") },
    Done: { type: "checkbox", checkbox: true },
    Priority: { type: "checkbox", checkbox: false },
    Area: { type: "select", select: { name: "Focus & Work" } },
    "Due Date": { type: "date", date: { start: "2026-06-10" } },
    Created: { type: "date", date: null },
    Notes: { type: "rich_text", rich_text: plainText("hi") },
    Minutes: { type: "number", number: 25 },
  };
  const mcp = encodePropsToMcp(restProps);
  assert.equal(mcp.Task, "Write tests");
  assert.equal(mcp.Done, "__YES__");
  assert.equal(mcp.Priority, "__NO__");
  assert.equal(mcp.Area, "Focus & Work");
  assert.equal(mcp["date:Due Date:start"], "2026-06-10");
  assert.ok(!("date:Created:start" in mcp), "null date omitted");
  assert.equal(mcp.Notes, "hi");
  assert.equal(mcp.Minutes, 25);
});

test("mcpPropsToRest builds correct REST objects for Tasks ds", () => {
  const rest = mcpPropsToRest(
    {
      Task: "Do thing",
      Done: "__YES__",
      Priority: "__NO__",
      Area: "Focus & Work",
      "date:Due Date:start": "2026-06-10",
      Notes: "note",
    },
    "fb432308-59b9-4078-92db-a83c6279957d"
  );
  assert.deepEqual(rest.Task, { title: [{ type: "text", text: { content: "Do thing" } }] });
  assert.deepEqual(rest.Done, { checkbox: true });
  assert.deepEqual(rest.Priority, { checkbox: false });
  assert.deepEqual(rest.Area, { select: { name: "Focus & Work" } });
  assert.deepEqual(rest["Due Date"], { date: { start: "2026-06-10" } });
  assert.deepEqual(rest.Notes, { rich_text: [{ type: "text", text: { content: "note" } }] });
});

test("mcpPropsToRest treats Task as rich_text on Focus Sessions ds", () => {
  const rest = mcpPropsToRest(
    { Session: "Focus 25m", Task: "the linked task", Minutes: 25, Type: "Focus" },
    "291cb585-746e-4195-a920-b0ac460fbbf6"
  );
  assert.deepEqual(rest.Session, { title: [{ type: "text", text: { content: "Focus 25m" } }] });
  assert.deepEqual(rest.Task, { rich_text: [{ type: "text", text: { content: "the linked task" } }] });
  assert.deepEqual(rest.Minutes, { number: 25 });
  assert.deepEqual(rest.Type, { select: { name: "Focus" } });
});

test("dispatch rejects unknown op name", async () => {
  await assert.rejects(
    () => dispatch({ name: FULL("notion-delete-everything"), args: {}, fetchImpl: mockFetch([]) }),
    /unknown|not allowed|invalid/i
  );
});

test("notion-fetch on a task page returns <properties> with encoded values", async () => {
  const fetchImpl = mockFetch([
    {
      match: (url) => url.includes("/pages/") && !url.includes("/children"),
      respond: () => ({
        body: {
          id: "page-1",
          properties: {
            Task: { type: "title", title: plainText("My task") },
            Done: { type: "checkbox", checkbox: true },
            "Due Date": { type: "date", date: { start: "2026-06-10" } },
          },
        },
      }),
    },
  ]);
  const r = await dispatch({ name: FULL("notion-fetch"), args: { id: "page-1" }, fetchImpl });
  const text = r.content.map((c) => c.text).join("");
  assert.match(text, /<properties>/);
  const m = text.match(/<properties>\s*([\s\S]*?)<\/properties>/);
  const props = JSON.parse(m[1]);
  assert.equal(props.Done, "__YES__");
  assert.equal(props["date:Due Date:start"], "2026-06-10");
});

test("notion-fetch on State page returns a ```json fence with code block content", async () => {
  const code = '{"focusMinutesToday":42}';
  const fetchImpl = mockFetch([
    {
      match: (url) => url.includes("/blocks/") && url.includes("/children"),
      respond: () => ({
        body: {
          results: [
            { type: "paragraph", paragraph: { rich_text: plainText("ignore") } },
            { type: "code", code: { rich_text: plainText(code) } },
          ],
        },
      }),
    },
    {
      match: (url) => url.includes("/pages/"),
      respond: () => ({ body: { id: STATE_ID, properties: {} } }),
    },
  ]);
  const r = await dispatch({ name: FULL("notion-fetch"), args: { id: STATE_ID }, fetchImpl });
  const text = r.content.map((c) => c.text).join("");
  assert.match(text, /```json/);
  assert.ok(text.includes(code), "code block content present");
});

test("notion-search POSTs to /data_sources/<id>/query and returns plain titles", async () => {
  const fetchImpl = mockFetch([
    {
      match: (url) => url.includes("/data_sources/") && url.endsWith("/query"),
      respond: () => ({
        body: {
          results: [
            { id: "p1", properties: { Task: { type: "title", title: plainText("Alpha") } } },
            { id: "p2", properties: { Task: { type: "title", title: plainText("Beta") } } },
          ],
        },
      }),
    },
  ]);
  const r = await dispatch({
    name: FULL("notion-search"),
    args: { data_source_url: "collection://fb432308-59b9-4078-92db-a83c6279957d", page_size: 10 },
    fetchImpl,
  });
  assert.ok(fetchImpl.calls[0].url.includes("/data_sources/fb432308-59b9-4078-92db-a83c6279957d/query"));
  assert.deepEqual(r.results, [
    { id: "p1", title: "Alpha" },
    { id: "p2", title: "Beta" },
  ]);
});

test("notion-search respects page_size", async () => {
  const many = [];
  for (let i = 0; i < 20; i++) many.push({ id: "p" + i, properties: { Win: { type: "title", title: plainText("W" + i) } } });
  const fetchImpl = mockFetch([
    { match: (url) => url.includes("/query"), respond: () => ({ body: { results: many } }) },
  ]);
  const r = await dispatch({
    name: FULL("notion-search"),
    args: { data_source_url: "collection://x", page_size: 5 },
    fetchImpl,
  });
  assert.equal(r.results.length, 5);
});

test("update_properties PATCHes /pages/<id> with correct REST body", async () => {
  const fetchImpl = mockFetch([
    { match: (url, o) => url.includes("/pages/") && o.method === "PATCH", respond: () => ({ body: { id: "page-9" } }) },
  ]);
  const r = await dispatch({
    name: FULL("notion-update-page"),
    args: {
      page_id: "page-9",
      command: "update_properties",
      properties: { Done: "__YES__", Area: "Focus & Work", "date:Due Date:start": "2026-06-10" },
    },
    fetchImpl,
  });
  const call = fetchImpl.calls[0];
  assert.ok(call.url.includes("/pages/page-9"));
  assert.equal(call.opts.method, "PATCH");
  assert.deepEqual(call.body.properties.Done, { checkbox: true });
  assert.deepEqual(call.body.properties.Area, { select: { name: "Focus & Work" } });
  assert.deepEqual(call.body.properties["Due Date"], { date: { start: "2026-06-10" } });
  assert.deepEqual(r, { ok: true });
});

test("update_content extracts JSON from new_str fence and PATCHes the code block", async () => {
  const newJson = '{"focusMinutesToday":99}';
  const newStr = "# State\n```json\n" + newJson + "\n```\n";
  const fetchImpl = mockFetch([
    {
      match: (url, o) => url.includes("/children") && (!o.method || o.method === "GET"),
      respond: () => ({
        body: { results: [{ id: "code-block-1", type: "code", code: { rich_text: plainText("old") } }] },
      }),
    },
    {
      match: (url, o) => url.includes("/blocks/code-block-1") && o.method === "PATCH",
      respond: () => ({ body: { id: "code-block-1" } }),
    },
  ]);
  const r = await dispatch({
    name: FULL("notion-update-page"),
    args: { page_id: STATE_ID, command: "update_content", content_updates: [{ old_str: "x", new_str: newStr }] },
    fetchImpl,
  });
  const patch = fetchImpl.calls.find((c) => c.opts.method === "PATCH");
  assert.ok(patch.url.includes("/blocks/code-block-1"));
  assert.equal(patch.body.code.rich_text[0].text.content, newJson);
  assert.deepEqual(r, { ok: true });
});

test("create POSTs /pages with parent data_source_id and returns {pages:[{id}]}", async () => {
  const fetchImpl = mockFetch([
    { match: (url, o) => url.endsWith("/pages") && o.method === "POST", respond: () => ({ body: { id: "new-page-1" } }) },
  ]);
  const r = await dispatch({
    name: FULL("notion-create-pages"),
    args: {
      parent: { data_source_id: "fb432308-59b9-4078-92db-a83c6279957d" },
      pages: [{ properties: { Task: "New task", Done: "__NO__" } }],
    },
    fetchImpl,
  });
  const call = fetchImpl.calls[0];
  assert.ok(call.url.endsWith("/pages"));
  assert.deepEqual(call.body.parent, { type: "data_source_id", data_source_id: "fb432308-59b9-4078-92db-a83c6279957d" });
  assert.deepEqual(call.body.properties.Task, { title: [{ type: "text", text: { content: "New task" } }] });
  assert.deepEqual(r, { pages: [{ id: "new-page-1" }] });
});

test("handler returns 400 on unknown op", async () => {
  const res = await handler({
    httpMethod: "POST",
    headers: { origin: "https://example.com", host: "example.com" },
    body: JSON.stringify({ name: FULL("notion-nuke"), args: {} }),
  });
  assert.equal(res.statusCode, 400);
});

test("handler 500 when token missing, without leaking token", async () => {
  const saved = process.env.NOTION_TOKEN;
  delete process.env.NOTION_TOKEN;
  const res = await handler({
    httpMethod: "POST",
    headers: { origin: "https://example.com", host: "example.com" },
    body: JSON.stringify({ name: FULL("notion-fetch"), args: { id: "x" } }),
  });
  process.env.NOTION_TOKEN = saved;
  assert.equal(res.statusCode, 500);
  assert.ok(!res.body.includes("secret_"), "no token in body");
});

test("SECURITY: no response body ever contains the token string", async () => {
  const fetchImpl = mockFetch([
    {
      match: (url) => url.includes("/pages/"),
      respond: () => ({ body: { id: "p", properties: { Task: { type: "title", title: plainText("hi") } } } }),
    },
  ]);
  const r = await dispatch({ name: FULL("notion-fetch"), args: { id: "p" }, fetchImpl });
  assert.ok(!JSON.stringify(r).includes("secret_TESTTOKEN"));
  // Confirm the Authorization header WAS sent to Notion (token used server-side)
  assert.match(fetchImpl.calls[0].opts.headers.Authorization, /Bearer secret_TESTTOKEN/);
});

test("CORS: same-origin sets Allow-Origin; cross-origin omits it", async () => {
  const same = await handler({
    httpMethod: "OPTIONS",
    headers: { origin: "https://my.site", host: "my.site" },
  });
  assert.equal(same.headers["Access-Control-Allow-Origin"], "https://my.site");

  const cross = await handler({
    httpMethod: "OPTIONS",
    headers: { origin: "https://evil.site", host: "my.site" },
  });
  assert.ok(!cross.headers["Access-Control-Allow-Origin"]);
});
