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
test("mergeState: taskIds union — base order kept, new appended, no dupes", () => {
  const result = JSON.parse(C.mergeState('{"taskIds":["a","b"]}', {taskIds:["b","c"]}));
  assert.deepEqual(result.taskIds, ["a","b","c"]);
});
test("mergeState: stale snapshot cannot drop ids another writer registered", () => {
  const result = JSON.parse(C.mergeState('{"taskIds":["a","b","c"]}', {taskIds:["a","b","d"]}));
  assert.ok(result.taskIds.includes("c"), "id registered by other writer survives");
  assert.ok(result.taskIds.includes("d"), "new id added");
});
test("mergeState: routineIds still replaced wholesale (legitimately shrinks)", () => {
  const result = JSON.parse(C.mergeState('{"routineIds":["r1","r2","r3"]}', {routineIds:["r1","r3"]}));
  assert.deepEqual(result.routineIds, ["r1","r3"]);
});
test("mergeState: taskIds set when base has none", () => {
  const result = JSON.parse(C.mergeState('{"streak":1}', {taskIds:["a"]}));
  assert.deepEqual(result.taskIds, ["a"]);
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

// ── Group 6: v1.4.0 routine editing + task grouping ──────────────────────
const AREAS = ["Daily Routines","Focus & Work","Health & Sleep","Finances","Home & Space","Relationships","Claude Tasks"];

test("routinePropsFor: name → Routine title", () => {
  assert.deepEqual(C.routinePropsFor("name","Water"), {Routine:"Water"});
});
test("routinePropsFor: why → Why", () => {
  assert.deepEqual(C.routinePropsFor("why","Hydrate"), {Why:"Hydrate"});
});
test("routinePropsFor: mins → Mins number", () => {
  assert.deepEqual(C.routinePropsFor("mins","5"), {Mins:5});
});
test("routinePropsFor: mins non-numeric → 0", () => {
  assert.deepEqual(C.routinePropsFor("mins","abc"), {Mins:0});
});
test("routinePropsFor: when → Time Of Day", () => {
  assert.deepEqual(C.routinePropsFor("when","Evening"), {"Time Of Day":"Evening"});
});
test("routinePropsFor: order → Order number", () => {
  assert.deepEqual(C.routinePropsFor("order","3"), {Order:3});
});
test("routinePropsFor: unknown field → empty", () => {
  assert.deepEqual(C.routinePropsFor("nope","x"), {});
});

test("newRoutineProps: full shape", () => {
  assert.deepEqual(
    C.newRoutineProps({name:"Stretch",when:"Evening",mins:10,why:"Mobility",order:4}),
    {Routine:"Stretch",Active:"__YES__","Done Today":"__NO__","Time Of Day":"Evening",Mins:10,Why:"Mobility",Order:4}
  );
});
test("newRoutineProps: defaults when sparse", () => {
  assert.deepEqual(
    C.newRoutineProps({name:"X"}),
    {Routine:"X",Active:"__YES__","Done Today":"__NO__","Time Of Day":"Morning",Mins:0,Why:"",Order:99}
  );
});

const RL = [{id:"a",order:1},{id:"b",order:2},{id:"c",order:3}];
test("reorderSwap: middle down swaps with next", () => {
  assert.deepEqual(C.reorderSwap(RL,"b",1), [{id:"b",order:3},{id:"c",order:2}]);
});
test("reorderSwap: middle up swaps with prev", () => {
  assert.deepEqual(C.reorderSwap(RL,"b",-1), [{id:"b",order:1},{id:"a",order:2}]);
});
test("reorderSwap: top up → no move", () => {
  assert.deepEqual(C.reorderSwap(RL,"a",-1), []);
});
test("reorderSwap: bottom down → no move", () => {
  assert.deepEqual(C.reorderSwap(RL,"c",1), []);
});
test("reorderSwap: unknown id → no move", () => {
  assert.deepEqual(C.reorderSwap(RL,"zzz",1), []);
});

test("groupTasksByArea: all 7 areas present even when empty", () => {
  const g = C.groupTasksByArea([], AREAS);
  assert.equal(g.length, 7);
  assert.deepEqual(g.map(x => x.area).sort(), AREAS.slice().sort());
});
test("groupTasksByArea: tasks land in correct bucket", () => {
  const g = C.groupTasksByArea([{area:"Finances",done:false}], AREAS);
  const fin = g.find(x => x.area === "Finances");
  assert.equal(fin.tasks.length, 1);
});
test("groupTasksByArea: busiest-open area first, empty last", () => {
  const tasks = [
    {area:"Health & Sleep",done:false},
    {area:"Health & Sleep",done:false},
    {area:"Finances",done:false}
  ];
  const g = C.groupTasksByArea(tasks, AREAS);
  assert.equal(g[0].area, "Health & Sleep");   // 2 open → first
  assert.equal(g[1].area, "Finances");          // 1 open → second
  assert.equal(g[g.length-1].open, 0);          // empty area sinks last
});
test("groupTasksByArea: equal-open areas keep fixed AREAS order", () => {
  const tasks = [
    {area:"Finances",done:false},
    {area:"Health & Sleep",done:false}
  ];
  const g = C.groupTasksByArea(tasks, AREAS);
  // Health & Sleep precedes Finances in AREAS, so it wins the tie
  const openOnes = g.filter(x => x.open === 1).map(x => x.area);
  assert.deepEqual(openOnes, ["Health & Sleep","Finances"]);
});

test("applyOps: taskAdd honors chosen area", () => {
  const r = C.applyOps({tasks:[]}, [{t:"taskAdd",tmpid:"t1",title:"X",area:"Finances"}]);
  assert.equal(r.tasks[0].area, "Finances");
});
test("applyOps: taskAdd missing area falls back to Focus & Work", () => {
  const r = C.applyOps({tasks:[]}, [{t:"taskAdd",tmpid:"t1",title:"X"}]);
  assert.equal(r.tasks[0].area, "Focus & Work");
});

// ── Group 7: v1.5.0 reset engine ──────────────────────────────────────────
test("needsDailyReset: different day → true", () => {
  assert.equal(C.needsDailyReset("2026-06-04", "2026-06-05"), true);
});
test("needsDailyReset: same day → false", () => {
  assert.equal(C.needsDailyReset("2026-06-05", "2026-06-05"), false);
});
test("needsDailyReset: missing/empty last date → true (first run ever)", () => {
  assert.equal(C.needsDailyReset("", "2026-06-05"), true);
  assert.equal(C.needsDailyReset(undefined, "2026-06-05"), true);
});
test("clearedRoutines: sets every done to false, preserves other fields", () => {
  const inp=[{id:"a",name:"X",done:true,order:1},{id:"b",name:"Y",done:false,order:2}];
  const out=C.clearedRoutines(inp);
  assert.deepEqual(out.map(r=>r.done), [false,false]);
  assert.equal(out[0].name, "X");
  assert.equal(out[1].order, 2);
});
test("clearedRoutines: does not mutate the input", () => {
  const inp=[{id:"a",done:true}];
  C.clearedRoutines(inp);
  assert.equal(inp[0].done, true);
});
test("clearedRoutines: handles empty/undefined", () => {
  assert.deepEqual(C.clearedRoutines(), []);
});
test("purgeRoutineOps: removes routine ops, keeps the rest", () => {
  const ops=[{t:"routine",id:"a",done:true},{t:"task",id:"x",done:true},{t:"win",title:"w",date:"2026-06-05"}];
  assert.deepEqual(C.purgeRoutineOps(ops), [{t:"task",id:"x",done:true},{t:"win",title:"w",date:"2026-06-05"}]);
});
test("purgeRoutineOps: empty/undefined → []", () => {
  assert.deepEqual(C.purgeRoutineOps(), []);
});
test("dailyReportText: includes date, task + routine + win counts", () => {
  const txt=C.dailyReportText(
    "2026-06-04",
    [{done:true},{done:false},{done:true}],
    [{done:true},{done:false}],
    [{title:"Shipped X",date:"2026-06-04"}]
  );
  assert.ok(txt.includes("2026-06-04"));
  assert.ok(txt.includes("2 of 3"));
  assert.ok(txt.includes("1 of 2"));
  assert.ok(txt.includes("Shipped X"));
});
test("dailyReportText: handles empty inputs without throwing", () => {
  const txt=C.dailyReportText("2026-06-04", [], [], []);
  assert.ok(txt.includes("2026-06-04"));
  assert.ok(txt.includes("0 of 0"));
});

// ── Group 8: v1.5.0 Brain Dump triage ──
test("registerId: appends a new id", () => {
  assert.deepEqual(C.registerId(["a","b"], "c"), ["a","b","c"]);
});
test("registerId: no duplicate when already present", () => {
  assert.deepEqual(C.registerId(["a","b"], "b"), ["a","b"]);
});
test("registerId: empty/undefined base, ignores falsy id", () => {
  assert.deepEqual(C.registerId(undefined, "a"), ["a"]);
  assert.deepEqual(C.registerId(["a"], ""), ["a"]);
});

// ── Step 2 hardening: classifySyncError + capDel/state ops ────────────────
test("classifySyncError: proxy 500 / not configured → config", () => {
  assert.equal(C.classifySyncError('proxy 500 {"error":"server not configured"}'), "config");
  assert.equal(C.classifySyncError("proxy 500"), "config");
});
test("classifySyncError: 401/403 → auth", () => {
  assert.equal(C.classifySyncError("proxy 401"), "auth");
  assert.equal(C.classifySyncError("proxy 403 restricted from accessing"), "auth");
});
test("classifySyncError: network/other/empty → offline", () => {
  assert.equal(C.classifySyncError("Failed to fetch"), "offline");
  assert.equal(C.classifySyncError(""), "offline");
  assert.equal(C.classifySyncError("proxy 502"), "offline");
});
test("applyOps: capDel removes cap by id", () => {
  const s = C.applyOps({tasks:[],wins:[],caps:[{id:"c1",item:"a"},{id:"c2",item:"b"}]}, [{t:"capDel",id:"c1"}]);
  assert.deepEqual(s.caps.map(c => c.id), ["c2"]);
});
test("applyOps: state op merges updates onto base", () => {
  const s = C.applyOps({tasks:[],wins:[],caps:[],streak:5}, [{t:"state",updates:{streak:6,lastCompleted:"2026-06-05"}}]);
  assert.equal(s.streak, 6);
  assert.equal(s.lastCompleted, "2026-06-05");
});

// ── Task 0: D9 runtime DB-id resolution ────────────────────────────────────
test("missingDbKeys: returns required keys absent or falsy in the map", () => {
  const dbs = { tasks:"id-t", wins:"", routines:"id-r" };
  assert.deepEqual(C.missingDbKeys(dbs, ["tasks","wins","routines","dailyLog"]), ["wins","dailyLog"]);
});
test("missingDbKeys: empty required -> empty", () => {
  assert.deepEqual(C.missingDbKeys({tasks:"x"}, []), []);
});
test("missingDbKeys: null map treats all required as missing", () => {
  assert.deepEqual(C.missingDbKeys(null, ["tasks","wins"]), ["tasks","wins"]);
});
test("mergeResolvedDatabases: adds resolved ids, never overwrites existing", () => {
  const base = { tasks:"id-t" };
  const out = C.mergeResolvedDatabases(base, { dailyLog:"id-dl", tasks:"WRONG" });
  assert.equal(out.tasks, "id-t");
  assert.equal(out.dailyLog, "id-dl");
  assert.notEqual(out, base);
});
test("mergeResolvedDatabases: null inputs -> empty object", () => {
  assert.deepEqual(C.mergeResolvedDatabases(null, null), {});
});

// ── Task 1: Todoist structure spec + State-payload builder ──────────────────
test("ccTodoistSpec: parent + 7 areas + full label set", () => {
  const s = C.ccTodoistSpec();
  assert.equal(s.parent, "Command Center");
  assert.deepEqual(s.areas, ["Daily Routines","Focus & Work","Health & Sleep","Finances","Home & Space","Relationships","Claude Tasks"]);
  assert.deepEqual(s.labels, ["today","energy-low","energy-med","energy-high","5m","15m","30m","1h","2h"]);
});
test("buildTodoistStatePayload: maps areas+labels to id dicts", () => {
  const payload = C.buildTodoistStatePayload(
    "PARENT",
    [{name:"Finances",id:"p-fin"},{name:"Focus & Work",id:"p-foc"}],
    [{name:"today",id:"l-today"},{name:"5m",id:"l-5m"}]
  );
  assert.equal(payload.todoistParentId, "PARENT");
  assert.deepEqual(payload.todoistProjects, {"Finances":"p-fin","Focus & Work":"p-foc"});
  assert.deepEqual(payload.todoistLabels, {"today":"l-today","5m":"l-5m"});
});
test("buildTodoistStatePayload: null inputs -> empty dicts", () => {
  const payload = C.buildTodoistStatePayload(null, null, null);
  assert.equal(payload.todoistParentId, "");
  assert.deepEqual(payload.todoistProjects, {});
  assert.deepEqual(payload.todoistLabels, {});
});
