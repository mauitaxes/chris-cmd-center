// Tests for buildPriorityArgs (Todoist priority toggle, Phase-2 interactive cutover).
// New file (cc-data.test.js is at the ~44KB read limit — do not append there).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const C = createRequire(path.join(__dirname, "cc-data.js"))("./cc-data.js");

test("buildPriorityArgs: star ON -> p1 (highest)", () => {
  const a = C.buildPriorityArgs("123", true, "k1");
  assert.deepEqual(a.tasks, [{ id: "123", priority: "p1" }]);
  assert.equal(a.requestId, "k1");
});

test("buildPriorityArgs: star OFF -> p4 (default)", () => {
  const a = C.buildPriorityArgs("123", false, "k2");
  assert.deepEqual(a.tasks, [{ id: "123", priority: "p4" }]);
  assert.equal(a.requestId, "k2");
});

test("buildPriorityArgs: coerces id to string + auto key when none given", () => {
  const a = C.buildPriorityArgs(987, true);
  assert.equal(a.tasks[0].id, "987");
  assert.equal(a.tasks[0].priority, "p1");
  assert.match(a.requestId, /^prio-/);
});
