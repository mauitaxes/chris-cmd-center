import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("./cc-data.js");

// ── Task 9: offline-queue helpers for Todoist writes ─────────────────────────
// The whole task hinges on the idempotency key being minted ONCE at enqueue and
// reused on every flush, so the proxy's X-Request-Id de-dupes a reconnect replay.

const TP = { "Focus & Work": "111", "Family & Personal": "222" }; // area -> Todoist projectId

// ---- queueTodoistAdd: key minted-if-absent, preserved-if-present ----
test("queueTodoistAdd: mints a key when absent (prefix 'add')", () => {
  const op = C.queueTodoistAdd({ title: "Call vendor", area: "Focus & Work" });
  assert.equal(op.t, "tdAdd");
  assert.equal(op.title, "Call vendor");
  assert.equal(op.area, "Focus & Work");
  assert.match(op.key, /^add-/);
});

test("queueTodoistAdd: preserves an existing key verbatim", () => {
  const op = C.queueTodoistAdd({ title: "x", area: "", key: "add-FIXED-123" });
  assert.equal(op.key, "add-FIXED-123");
});

test("queueTodoistAdd: trims title; empty/whitespace -> null", () => {
  assert.equal(C.queueTodoistAdd({ title: "   " }), null);
  assert.equal(C.queueTodoistAdd({ title: "" }), null);
  assert.equal(C.queueTodoistAdd({}), null);
  assert.equal(C.queueTodoistAdd({ title: "  hi  " }).title, "hi");
});

test("queueTodoistAdd: missing area defaults to '' (global -> Inbox)", () => {
  const op = C.queueTodoistAdd({ title: "note", key: "k1" });
  assert.equal(op.area, "");
});

// ---- queueTodoistDone ----
test("queueTodoistDone: mints a 'done' key, string-coerces id", () => {
  const op = C.queueTodoistDone({ id: 98765 });
  assert.equal(op.t, "tdDone");
  assert.equal(op.id, "98765");
  assert.match(op.key, /^done-/);
});

test("queueTodoistDone: preserves an existing key; null id -> null", () => {
  assert.equal(C.queueTodoistDone({ id: "7", key: "done-K" }).key, "done-K");
  assert.equal(C.queueTodoistDone({ id: "" }), null);
  assert.equal(C.queueTodoistDone({}), null);
});

// ---- THE idempotency proof: same op flushed twice -> identical requestId ----
test("todoistFlushCall: enqueue->flush preserves key as requestId (tdAdd)", () => {
  const op = C.queueTodoistAdd({ title: "Buy stamps", area: "Family & Personal" });
  const a = C.todoistFlushCall(op, TP);
  const b = C.todoistFlushCall(op, TP); // simulate a second/reconnect flush of the SAME op
  assert.equal(a.name, "add-tasks");
  assert.equal(a.args.requestId, op.key);
  assert.equal(a.args.requestId, b.args.requestId); // identical -> X-Request-Id dedupes
  assert.equal(a.args.tasks[0].projectId, "222");
});

test("todoistFlushCall: enqueue->flush preserves key as requestId (tdDone)", () => {
  const op = C.queueTodoistDone({ id: "555" });
  const a = C.todoistFlushCall(op, TP);
  const b = C.todoistFlushCall(op, TP);
  assert.equal(a.name, "complete-tasks");
  assert.deepEqual(a.args.ids, ["555"]);
  assert.equal(a.args.requestId, op.key);
  assert.equal(a.args.requestId, b.args.requestId);
});

test("todoistFlushCall: unknown area routes to inbox", () => {
  const op = C.queueTodoistAdd({ title: "stray", area: "Nonexistent Area", key: "k" });
  const fc = C.todoistFlushCall(op, TP);
  assert.equal(fc.args.tasks[0].projectId, "inbox");
});

test("todoistFlushCall: empty title -> null; unknown op type -> null", () => {
  assert.equal(C.todoistFlushCall({ t: "tdAdd", title: "  ", key: "k" }, TP), null);
  assert.equal(C.todoistFlushCall({ t: "tdDone", key: "k" }, TP), null); // no id
  assert.equal(C.todoistFlushCall({ t: "task", id: "1" }, TP), null);
  assert.equal(C.todoistFlushCall(null, TP), null);
});

// ---- dedupeQueueByKey: defensive double-enqueue collapse, order-preserving ----
test("dedupeQueueByKey: collapses same-key duplicates, keeps first, order preserved", () => {
  const pending = [
    { t: "tdAdd", key: "add-1", title: "A" },
    { t: "tdAdd", key: "add-2", title: "B" },
    { t: "tdAdd", key: "add-1", title: "A again" }, // duplicate key -> dropped
    { t: "tdDone", key: "done-1", id: "9" },
    { t: "tdDone", key: "done-1", id: "9" },        // duplicate key -> dropped
  ];
  const out = C.dedupeQueueByKey(pending);
  assert.deepEqual(out.map((o) => o.key), ["add-1", "add-2", "done-1"]);
  assert.equal(out[0].title, "A"); // kept the FIRST, not "A again"
});

test("dedupeQueueByKey: keyless ops (other op types) always pass through", () => {
  const pending = [
    { t: "task", id: "1", done: true },
    { t: "tdAdd", key: "add-1", title: "A" },
    { t: "cap", item: "idea" },
    { t: "tdAdd", key: "add-1", title: "dup" },
    { t: "win", title: "w" },
  ];
  const out = C.dedupeQueueByKey(pending);
  assert.equal(out.length, 4); // one tdAdd dup removed; all 3 keyless kept
  assert.deepEqual(out.map((o) => o.t), ["task", "tdAdd", "cap", "win"]);
});

test("dedupeQueueByKey: non-array -> []", () => {
  assert.deepEqual(C.dedupeQueueByKey(null), []);
  assert.deepEqual(C.dedupeQueueByKey(undefined), []);
});

// ---- end-to-end: dedupe then flush still yields one stable requestId per key ----
test("dedupe + flush: a double-enqueued add flushes once with its original key", () => {
  const op1 = C.queueTodoistAdd({ title: "Same capture", area: "Focus & Work" });
  const op2 = C.queueTodoistAdd({ title: "Same capture", area: "Focus & Work", key: op1.key });
  const collapsed = C.dedupeQueueByKey([op1, op2]);
  assert.equal(collapsed.length, 1);
  const fc = C.todoistFlushCall(collapsed[0], TP);
  assert.equal(fc.args.requestId, op1.key);
  assert.equal(fc.args.tasks[0].projectId, "111");
});
