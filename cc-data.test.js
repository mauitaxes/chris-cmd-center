import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const F = require("./fixtures.js");
const C = require("./cc-data.js");

// ── Group 1: unwrap, deepText ──────────────────────────────────────────────
test("unwrap: string passthrough", () => {
  assert.equal(C.unwrap("hi"), "hi");
});
test("unwrap: {text}", () => {
  assert.equal(C.unwrap({text:"hi"}), "hi");
});
test("unwrap: {content:[...]}", () => {
  assert.equal(C.unwrap({content:[{text:"a"},{text:"b"}]}), "a\nb");
});
test("unwrap: array", () => {
  assert.equal(C.unwrap(["a","b"]), "a\nb");
});
test("unwrap: {result}", () => {
  assert.equal(C.unwrap({result:"r"}), "r");
});
test("deepText: nested JSON text", () => {
  assert.equal(C.deepText(JSON.stringify({text:JSON.stringify({text:"deep"})})), "deep");
});
test("deepText: TASK_TEXT includes <properties>", () => {
  assert.ok(C.deepText(F.TASK_TEXT).includes("<properties>"));
});

// ── Group 2: parseProps, normalizeTask ────────────────────────────────────
test("parseProps: from TASK_TEXT – Task field", () => {
  assert.equal(C.parseProps(F.TASK_TEXT).Task, "McCleary Estate Return (Husband)");
});
test("parseProps: from TASK_TEXT – Done field", () => {
  assert.equal(C.parseProps(F.TASK_TEXT).Done, "__NO__");
});
test("parseProps: from TASK_TEXT – Due Date", () => {
  assert.equal(C.parseProps(F.TASK_TEXT)["date:Due Date:start"], "2026-10-05");
});
test("parseProps: from TASK_OBJ – Area", () => {
  assert.equal(C.parseProps(F.TASK_OBJ).Area, "Focus & Work");
});
test("parseProps: from TASK_STRING – Area", () => {
  assert.equal(C.parseProps(F.TASK_STRING).Area, "Focus & Work");
});
test("parseProps: from TASK_CONTENT – Area", () => {
  assert.equal(C.parseProps(F.TASK_CONTENT).Area, "Focus & Work");
});
test("normalizeTask: full object", () => {
  const p = C.parseProps(F.TASK_OBJ);
  assert.deepEqual(C.normalizeTask("id1", p), {
    id: "id1",
    title: "McCleary Estate Return (Husband)",
    area: "Focus & Work",
    done: false,
    priority: false,
    due: "2026-10-05",
    energy: "",
    time: ""
  });
});

// ── Group 3: normalizeRoutine, normalizeWin, rankTasks ────────────────────
test("normalizeRoutine: full object", () => {
  assert.deepEqual(
    C.normalizeRoutine("r1", {Routine:"Water",Active:"__YES__","Done Today":"__NO__","Time Of Day":"Morning",Mins:2,Why:"Hydrate",Order:1}),
    { id:"r1", name:"Water", done:false, when:"Morning", mins:2, why:"Hydrate", order:1, active:true }
  );
});
test("normalizeWin: basic", () => {
  assert.deepEqual(
    C.normalizeWin("w1", {Win:"Shipped","date:Date:start":"2026-06-02"}),
    { id:"w1", title:"Shipped", date:"2026-06-02" }
  );
});
test("rankTasks: ordering", () => {
  const tasks = [
    {id:"d",done:true,priority:false,due:""},
    {id:"p",done:false,priority:true,due:""},
    {id:"o",done:false,priority:false,due:""},
    {id:"due",done:false,priority:false,due:"2026-06-01"}
  ];
  const result = C.rankTasks(tasks, "2026-06-03");
  assert.deepEqual(result.map(t => t.id), ["p","due","o","d"]);
});

// ── Group 4: mergeState, replaceStateBlock ────────────────────────────────
test("mergeState: merges updates, preserves unaffected fields", () => {
  const result = JSON.parse(C.mergeState(
    '{"streak":12,"lastWinDate":"2026-06-02","databases":{"tasks":"x"}}',
    {lastWinDate:"2026-06-03", focusMinutesToday:25}
  ));
  assert.equal(result.streak, 12);
  assert.equal(result.lastWinDate, "2026-06-03");
  assert.equal(result.focusMinutesToday, 25);
  assert.deepEqual(result.databases, {tasks:"x"});
});
test("replaceStateBlock: replaces fence in STATE_TEXT", () => {
  const out = C.replaceStateBlock(F.STATE_TEXT, '{"streak":13}');
  assert.ok(out.includes('```json\n{"streak":13}\n```'));
  assert.ok(!out.includes('"streak":12'));
  assert.ok(out.startsWith("State store"));
});
test("replaceStateBlock: no fence – appends", () => {
  const out = C.replaceStateBlock("no fence here", '{"a":1}');
  assert.ok(out.includes('```json\n{"a":1}\n```'));
});

// ── Group 5: applyOps, assertReadComplete ─────────────────────────────────
test("applyOps: full ops sequence", () => {
  const base = {tasks:[{id:"t1",done:false,priority:false}],wins:[],caps:[],focusMinutesToday:0};
  const ops = [
    {t:"task",id:"t1",done:true},
    {t:"task",id:"t1",done:true},
    {t:"prio",id:"t1",priority:true},
    {t:"taskAdd",tmpid:"tmp1",title:"New"},
    {t:"win",title:"W",date:"2026-06-03"},
    {t:"focus",min:25}
  ];
  const result = C.applyOps(base, ops);
  // t1 done and priority
  const t1 = result.tasks.find(t => t.id === "t1");
  assert.equal(t1.done, true);
  assert.equal(t1.priority, true);
  // taskAdd prepended
  assert.equal(result.tasks[0].id, "tmp1");
  // win added
  assert.equal(result.wins[0].title, "W");
  // focus accumulated
  assert.equal(result.focusMinutesToday, 25);
});
test("assertReadComplete: missing items", () => {
  const r = C.assertReadComplete(["a","b","c"], [{id:"a"},{id:"c"}]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["b"]);
});
test("assertReadComplete: all present", () => {
  const r = C.assertReadComplete(["a"], [{id:"a"}]);
  assert.equal(r.ok, true);
});

// ── Fix 1: replaceStateBlock cross-fence safety ───────────────────────────
test("replaceStateBlock: unrelated fence before state block is preserved", () => {
  const md = "```js\nconsole.log(1)\n```\n" + F.STATE_TEXT;
  const out = C.replaceStateBlock(md, '{"streak":99}');
  assert.ok(out.includes('console.log(1)'));        // unrelated block preserved
  assert.ok(out.includes('```json\n{"streak":99}\n```'));
  assert.ok(!out.includes('"streak":12'));
});

// ── Fix 2: rankTasks does not mutate caller's array ───────────────────────
test("rankTasks: does not mutate input array", () => {
  const tasks = [
    {id:"d",done:true,priority:false,due:""},
    {id:"p",done:false,priority:true,due:""},
    {id:"o",done:false,priority:false,due:""}
  ];
  const originalIds = tasks.map(t => t.id);
  const sorted = C.rankTasks(tasks, "2026-06-03");
  // returned array is sorted (priority first, then normal, then done)
  assert.deepEqual(sorted.map(t => t.id), ["p","o","d"]);
  // original array order is unchanged
  assert.deepEqual(tasks.map(t => t.id), originalIds);
});

// ── Fix 4: applyOps – routine and cap ops ────────────────────────────────
test("applyOps: routine op sets done", () => {
  const base = {routines:[{id:"r1",done:false}]};
  const result = C.applyOps(base, [{t:"routine",id:"r1",done:true}]);
  assert.equal(result.routines[0].done, true);
});
test("applyOps: cap op prepends capture", () => {
  const base = {};
  const result = C.applyOps(base, [{t:"cap",item:"idea"}]);
  assert.equal(result.caps[0].item, "idea");
  assert.equal(result.caps[0].id, null);
});
