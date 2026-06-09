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

// ── Task 2: pure migration transforms ──────────────────────────────────────
test("migrationIdKey: deterministic 8-char hash of a notion page id", () => {
  const a = C.migrationIdKey("27268b77-7a95-4cd0-a94c-82bb12188b9a");
  const b = C.migrationIdKey("27268b77-7a95-4cd0-a94c-82bb12188b9a");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(a, C.migrationIdKey("different-id"));
});
test("notionTaskToTodoist: maps area/priority/labels/due/notes + ccid marker", () => {
  const task = { id:"PAGE1", title:"Pay GET tax", area:"Finances",
                 priority:true, due:"2026-06-10", energy:"med", time:"30m", notes:"quarterly" };
  const out = C.notionTaskToTodoist(task, {
    parentId:"PARENT",
    projectByArea:{"Finances":"p-fin"},
    energyLabelMap:{low:"energy-low",med:"energy-med",high:"energy-high"},
    timeLabelMap:{"5m":"5m","15m":"15m","30m":"30m","1h":"1h","2h":"2h"}
  });
  assert.equal(out.content, "Pay GET tax");
  assert.equal(out.projectId, "p-fin");
  assert.equal(out.priority, "p1");
  assert.deepEqual(out.labels.sort(), ["energy-med","30m"].sort());
  assert.equal(out.dueString, "2026-06-10");
  assert.ok(out.description.includes("quarterly"));
  assert.match(out.description, /\[ccid:[0-9a-f]{8}\]/);
});
test("notionTaskToTodoist: no area -> parent project, no priority -> p4", () => {
  const out = C.notionTaskToTodoist({id:"P2",title:"x",area:"",priority:false}, {parentId:"PARENT",projectByArea:{}});
  assert.equal(out.projectId, "PARENT");
  assert.equal(out.priority, "p4");
  assert.deepEqual(out.labels, []);
});
test("notionCaptureToTodoist: inbox + marker", () => {
  const out = C.notionCaptureToTodoist({id:"CAP1",item:"call plumber",notes:""});
  assert.equal(out.projectId, "inbox");
  assert.equal(out.content, "call plumber");
  assert.match(out.description, /\[ccid:[0-9a-f]{8}\]/);
});
test("reconcileCounts: per-key match + overall ok", () => {
  const r = C.reconcileCounts(
    {"Finances":3,"Focus & Work":5,"P1":2,"Inbox":4},
    {"Finances":3,"Focus & Work":5,"P1":2,"Inbox":4}
  );
  assert.equal(r.ok, true);
  assert.equal(r.rows.find(x=>x.key==="Finances").ok, true);
});
test("reconcileCounts: mismatch flags the row and overall", () => {
  const r = C.reconcileCounts({"Inbox":4}, {"Inbox":3});
  assert.equal(r.ok, false);
  assert.equal(r.rows[0].expected, 4);
  assert.equal(r.rows[0].actual, 3);
  assert.equal(r.rows[0].ok, false);
});

// ---- Task 4 / CP3 recurring-completion spike helpers ----
test("hstDayUtcWindow: HST (UTC-10) local day -> [10:00Z, next 10:00Z) window", () => {
  const w = C.hstDayUtcWindow("2026-06-08");
  assert.equal(w.since, "2026-06-08T10:00:00.000Z");
  assert.equal(w.until, "2026-06-09T10:00:00.000Z");
});
test("hstDayUtcWindow: invalid input -> null", () => {
  assert.equal(C.hstDayUtcWindow("nope"), null);
  assert.equal(C.hstDayUtcWindow(""), null);
});
test("completedInTreeOnDay: keeps in-tree completed events inside the window (recurring incl.)", () => {
  const w = C.hstDayUtcWindow("2026-06-08");
  const events = [
    // recurring spike completion, in CC Daily Routines, at 19:58Z on 2026-06-08 (real spike shape)
    { eventType:"completed", parentProjectId:"6gqCVgp6xQ44R2V3", eventDate:"2026-06-08T19:58:53.903Z",
      extraData:{ isRecurring:true, content:"SPIKE" } },
    // completed but OUTSIDE the CC tree (onboarding project) -> excluded by tree filter
    { eventType:"completed", parentProjectId:"6gq77cCq8P4J7vHm", eventDate:"2026-06-08T18:41:28.099Z" },
    // in-tree but wrong event type -> excluded
    { eventType:"added", parentProjectId:"6gqCVgp6xQ44R2V3", eventDate:"2026-06-08T12:00:00.000Z" },
    // in-tree completed but BEFORE the window (previous HST day) -> excluded
    { eventType:"completed", parentProjectId:"6gqCVgp6xQ44R2V3", eventDate:"2026-06-08T09:59:00.000Z" }
  ];
  const treeIds = ["6gqCVgp6xQ44R2V3","6gqCVgmmffVVc4HW","6gqCVgmmg96jc96q"];
  const hit = C.completedInTreeOnDay(events, treeIds, w.since, w.until);
  assert.equal(hit.length, 1);
  assert.equal(hit[0].extraData.content, "SPIKE");
});
test("completedInTreeOnDay: empty / null inputs -> []", () => {
  assert.deepEqual(C.completedInTreeOnDay(null, ["x"], "2026-06-08T10:00:00.000Z", "2026-06-09T10:00:00.000Z"), []);
  assert.deepEqual(C.completedInTreeOnDay([{eventType:"completed",parentProjectId:"x",eventDate:"2026-06-08T12:00:00Z"}], [], "2026-06-08T10:00:00.000Z", "2026-06-09T10:00:00.000Z"), []);
});

// ---- Task 3a — client task-tile transforms ----
test("normalizeTodoistTask: MCP task shape -> dashboard model, strips ccid/created markers", () => {
  const raw = { id:"6gqCXQ3qG6vRFVhW", content:"McCleary Estate Return",
    description:"[created 2026-05-30] Need to inform Donna. [ccid:1739c150]",
    dueDate:"2026-10-05", recurring:false, priority:"p1",
    projectId:"6gqCVgmmffVVc4HW", labels:["today"], checked:false };
  const out = C.normalizeTodoistTask(raw, {"6gqCVgmmffVVc4HW":"Focus & Work"});
  assert.equal(out.id, raw.id);
  assert.equal(out.title, "McCleary Estate Return");
  assert.equal(out.area, "Focus & Work");
  assert.equal(out.priority, true);
  assert.equal(out.done, false);
  assert.equal(out.due, "2026-10-05");
  assert.equal(out.notes, "Need to inform Donna.");
  assert.deepEqual(out.labels, ["today"]);
});
test("normalizeTodoistTask: unknown project -> area ''; p4 -> false; checked -> done; no markers", () => {
  const out = C.normalizeTodoistTask({id:"x",content:"y",priority:"p4",projectId:"zzz",checked:true,description:"plain note"}, {});
  assert.equal(out.area, "");
  assert.equal(out.priority, false);
  assert.equal(out.done, true);
  assert.equal(out.notes, "plain note");
  assert.equal(out.due, "");
});
test("todoistTileCounts: open / p1 / per-area / active areas (done excluded)", () => {
  const tasks = [
    {area:"Finances", priority:true, done:false},
    {area:"Finances", priority:false, done:false},
    {area:"Focus & Work", priority:true, done:true},
    {area:"Focus & Work", priority:false, done:false},
  ];
  const c = C.todoistTileCounts(tasks);
  assert.equal(c.open, 3);
  assert.equal(c.p1, 1);
  assert.equal(c.areasActive, 2);
  assert.deepEqual(c.byArea, {"Finances":2,"Focus & Work":1});
});

// ---- Task 3b — Today panel split ----
test("splitTodayPanel: buckets today vs overdue; priority & @today join today; done excluded", () => {
  const tasks = [
    {id:"a", title:"Due today",   due:"2026-06-08", priority:false, labels:[], done:false},
    {id:"b", title:"Overdue",     due:"2026-06-01", priority:false, labels:[], done:false},
    {id:"c", title:"P1 no due",   due:"",           priority:true,  labels:[], done:false},
    {id:"d", title:"Labelled",    due:"",           priority:false, labels:["today"], done:false},
    {id:"e", title:"Future plain",due:"2026-12-01", priority:false, labels:[], done:false},
    {id:"f", title:"Done overdue",due:"2026-06-01", priority:false, labels:[], done:true},
  ];
  const r = C.splitTodayPanel(tasks, {today:"2026-06-08", threshold:5});
  const todayIds = r.today.map(t=>t.id).sort();
  assert.deepEqual(todayIds, ["a","c","d"]);   // future-plain & done excluded
  assert.deepEqual(r.overdue.map(t=>t.id), ["b"]); // done-overdue excluded
  assert.equal(r.overdueCount, 1);
  assert.equal(r.overdueCollapsed, false);
});
test("splitTodayPanel: priority sorts first, then due date asc", () => {
  const tasks = [
    {id:"plain", title:"z", due:"2026-06-08", priority:false, labels:[], done:false},
    {id:"p1late",title:"a", due:"2026-06-09", priority:true,  labels:[], done:false},
    {id:"p1nodue", title:"a", due:"",           priority:true,  labels:[], done:false},
  ];
  const r = C.splitTodayPanel(tasks, {today:"2026-06-08"});
  assert.equal(r.today[0].priority, true);     // a priority leads
  assert.equal(r.today[r.today.length-1].id, "plain"); // non-priority last
});
test("splitTodayPanel: overdueCollapsed true past threshold", () => {
  const tasks = [];
  for (let i=0;i<7;i++) tasks.push({id:"o"+i, title:"x", due:"2026-06-0"+(i+1), priority:false, labels:[], done:false});
  const r = C.splitTodayPanel(tasks, {today:"2026-06-08", threshold:5});
  assert.equal(r.overdueCount, 7);
  assert.equal(r.overdueCollapsed, true);
});
test("splitTodayPanel: datetime due compares on date prefix (MCP path)", () => {
  const tasks = [{id:"dt", title:"x", due:"2026-06-08T08:00:00", priority:false, labels:[], done:false}];
  const r = C.splitTodayPanel(tasks, {today:"2026-06-08"});
  assert.deepEqual(r.today.map(t=>t.id), ["dt"]);
  assert.equal(r.overdueCount, 0);
});
test("splitTodayPanel: empty / null inputs -> empty buckets, default threshold 5", () => {
  const r = C.splitTodayPanel(null, {today:"2026-06-08"});
  assert.deepEqual(r.today, []);
  assert.deepEqual(r.overdue, []);
  assert.equal(r.threshold, 5);
  assert.equal(r.overdueCollapsed, false);
});

// ── Group: mergeCalendarEvents (Task 3c, read-only Schedule/Calendar lane) ──
// Helper: a normalized calendar event with sensible defaults (the shape the fetch layer produces).
const CEV = (o) => Object.assign({start:"",end:"",title:"",allDay:false,calendarId:"cal",htmlLink:""}, o);

test("mergeCalendarEvents: flattens multiple calendar arrays into one list", () => {
  const a = [CEV({id:"1", start:"2026-06-08T09:00:00-10:00", title:"A"})];
  const b = [CEV({id:"2", start:"2026-06-08T11:00:00-10:00", title:"B"})];
  const r = C.mergeCalendarEvents([a, b]);
  assert.deepEqual(r.map(e=>e.title), ["A","B"]);
});

test("mergeCalendarEvents: orders by start time ascending", () => {
  const a = [
    CEV({start:"2026-06-08T14:00:00-10:00", title:"afternoon"}),
    CEV({start:"2026-06-08T08:00:00-10:00", title:"morning"}),
  ];
  assert.deepEqual(C.mergeCalendarEvents([a]).map(e=>e.title), ["morning","afternoon"]);
});

test("mergeCalendarEvents: de-dupes an event present in two calendars (same start+title), keeps first", () => {
  const primary = [CEV({id:"x", calendarId:"p", start:"2026-06-08T10:00:00-10:00", title:"Standup"})];
  const work    = [CEV({id:"y", calendarId:"w", start:"2026-06-08T10:00:00-10:00", title:"Standup"})];
  const r = C.mergeCalendarEvents([primary, work]);
  assert.equal(r.length, 1);
  assert.equal(r[0].calendarId, "p");
});

test("mergeCalendarEvents: all-day event sorts before timed events the same day", () => {
  const a = [
    CEV({start:"2026-06-08T08:00:00-10:00", title:"timed"}),
    CEV({start:"2026-06-08", allDay:true, title:"holiday"}),
  ];
  assert.deepEqual(C.mergeCalendarEvents([a]).map(e=>e.title), ["holiday","timed"]);
});

test("mergeCalendarEvents: keeps distinct same-title events at different times", () => {
  const a = [
    CEV({start:"2026-06-08T09:00:00-10:00", title:"Call"}),
    CEV({start:"2026-06-08T15:00:00-10:00", title:"Call"}),
  ];
  assert.equal(C.mergeCalendarEvents([a]).length, 2);
});

test("mergeCalendarEvents: empty / null / sparse inputs -> []", () => {
  assert.deepEqual(C.mergeCalendarEvents(null), []);
  assert.deepEqual(C.mergeCalendarEvents([]), []);
  assert.deepEqual(C.mergeCalendarEvents([null, [], [undefined]]), []);
});

test("mergeCalendarEvents: unparseable start sorts to the end, does not throw", () => {
  const a = [
    CEV({start:"not-a-date", title:"junk"}),
    CEV({start:"2026-06-08T08:00:00-10:00", title:"real"}),
  ];
  assert.deepEqual(C.mergeCalendarEvents([a]).map(e=>e.title), ["real","junk"]);
});

test("mergeCalendarEvents: does not mutate input arrays", () => {
  const a = [CEV({start:"2026-06-08T14:00:00-10:00", title:"b"}), CEV({start:"2026-06-08T08:00:00-10:00", title:"a"})];
  const snapshot = a.map(e=>e.title);
  C.mergeCalendarEvents([a]);
  assert.deepEqual(a.map(e=>e.title), snapshot);
});

// ── Task 5: write helpers (quick-add, idempotency, arg builders) ───────────
test("quickAddProjectId: known area -> its projectId; unknown/global -> 'inbox'", () => {
  const tp = {"Finances":"p-fin","Focus & Work":"p-foc"};
  assert.equal(C.quickAddProjectId("Focus & Work", tp), "p-foc");
  assert.equal(C.quickAddProjectId("Finances", tp), "p-fin");
  assert.equal(C.quickAddProjectId("Nonexistent", tp), "inbox");
  assert.equal(C.quickAddProjectId("", tp), "inbox");
  assert.equal(C.quickAddProjectId(undefined, undefined), "inbox");
});

test("idempotencyKey: prefixed, unique per call", () => {
  const a = C.idempotencyKey("add");
  const b = C.idempotencyKey("add");
  assert.match(a, /^add-/);
  assert.notEqual(a, b);
  assert.match(C.idempotencyKey(), /^cc-/);   // default prefix
});

test("buildQuickAddArgs: maps title+area -> MCP add-tasks args with requestId", () => {
  const tp = {"Focus & Work":"p-foc"};
  const args = C.buildQuickAddArgs("  Pay GET tax  ", "Focus & Work", tp, "req-1");
  assert.deepEqual(args.tasks, [{content:"Pay GET tax", projectId:"p-foc"}]);
  assert.equal(args.requestId, "req-1");
});

test("buildQuickAddArgs: global capture -> inbox; empty title -> null; auto key when omitted", () => {
  assert.equal(C.buildQuickAddArgs("   ", "Focus & Work", {}, "k"), null);
  const g = C.buildQuickAddArgs("idea", "", {});
  assert.equal(g.tasks[0].projectId, "inbox");
  assert.match(g.requestId, /^add-/);
});

test("buildCompleteArgs: wraps id in ids[] with requestId (auto key when omitted)", () => {
  assert.deepEqual(C.buildCompleteArgs("111", "req-2"), {ids:["111"], requestId:"req-2"});
  const a = C.buildCompleteArgs(222);
  assert.deepEqual(a.ids, ["222"]);
  assert.match(a.requestId, /^done-/);
});

test("optimisticRemove: returns a NEW array without the matching id; non-mutating; string-coerced", () => {
  const tasks = [{id:"1",title:"a"},{id:"2",title:"b"},{id:"3",title:"c"}];
  const next = C.optimisticRemove(tasks, 2);            // number id coerced to match "2"
  assert.deepEqual(next.map(t=>t.id), ["1","3"]);
  assert.equal(tasks.length, 3);                         // original untouched (rollback snapshot stays valid)
  assert.notEqual(next, tasks);
});

test("optimisticRemove: unknown id -> shallow copy unchanged; null/empty inputs -> []", () => {
  const tasks = [{id:"1"}];
  const same = C.optimisticRemove(tasks, "999");
  assert.deepEqual(same.map(t=>t.id), ["1"]);
  assert.notEqual(same, tasks);
  assert.deepEqual(C.optimisticRemove(null, "1"), []);
  assert.deepEqual(C.optimisticRemove(undefined, "1"), []);
});

test("optimisticRemove: returns a NEW array without the matching id; non-mutating; string-coerced", () => {
  const tasks = [{id:"1",title:"a"},{id:"2",title:"b"},{id:"3",title:"c"}];
  const next = C.optimisticRemove(tasks, 2);            // number id coerced to match "2"
  assert.deepEqual(next.map(t=>t.id), ["1","3"]);
  assert.equal(tasks.length, 3);                         // original untouched (rollback snapshot stays valid)
  assert.notEqual(next, tasks);
});

test("optimisticRemove: unknown id -> shallow copy unchanged; null/empty inputs -> []", () => {
  const tasks = [{id:"1"}];
  const same = C.optimisticRemove(tasks, "999");
  assert.deepEqual(same.map(t=>t.id), ["1"]);
  assert.notEqual(same, tasks);
  assert.deepEqual(C.optimisticRemove(null, "1"), []);
  assert.deepEqual(C.optimisticRemove(undefined, "1"), []);
});

// ── Task 6: defer pure helpers ─────────────────────────────────────────────
test("withoutTodayLabel: drops 'today', keeps others, non-mutating; missing -> unchanged copy", () => {
  const labels = ["today", "energy-low", "15m"];
  const next = C.withoutTodayLabel(labels);
  assert.deepEqual(next, ["energy-low", "15m"]);
  assert.deepEqual(labels, ["today", "energy-low", "15m"]);
  assert.notEqual(next, labels);
  assert.deepEqual(C.withoutTodayLabel(["energy-low"]), ["energy-low"]);
  assert.deepEqual(C.withoutTodayLabel(undefined), []);
  assert.deepEqual(C.withoutTodayLabel(null), []);
});

test("tomorrowHst: returns today+1 as YYYY-MM-DD via pure date math (no local TZ)", () => {
  assert.equal(C.tomorrowHst("2026-06-08"), "2026-06-09");
  assert.equal(C.tomorrowHst("2026-06-30"), "2026-07-01");
  assert.equal(C.tomorrowHst("2026-12-31"), "2027-01-01");
  assert.equal(C.tomorrowHst("2026-02-28"), "2026-03-01");
  assert.equal(C.tomorrowHst("garbage"), "");
});

test("classifyDefer: recurring -> deep-link regardless of choice", () => {
  const rec = { id:"1", recurring:true, due:"2026-06-10", labels:["today"] };
  assert.equal(C.classifyDefer(rec), "deep-link");
  assert.equal(C.classifyDefer(rec, "not-today"), "deep-link");
  assert.equal(C.classifyDefer(rec, "tomorrow"), "deep-link");
});

test("classifyDefer: choice 'not-today' -> not-today for non-recurring", () => {
  assert.equal(C.classifyDefer({ id:"2", recurring:false, due:"2026-06-10", labels:["today"] }, "not-today"), "not-today");
  assert.equal(C.classifyDefer({ id:"3", recurring:false, due:"", labels:["today"] }, "not-today"), "not-today");
});

test("classifyDefer: default/tomorrow -> dated vs undated by due presence", () => {
  assert.equal(C.classifyDefer({ id:"4", recurring:false, due:"2026-06-10", labels:[] }), "tomorrow-dated");
  assert.equal(C.classifyDefer({ id:"5", recurring:false, due:"", labels:[] }), "tomorrow-undated");
  assert.equal(C.classifyDefer({ id:"6", recurring:false, due:"2026-06-10", labels:[] }, "tomorrow"), "tomorrow-dated");
});

test("classifyDefer: explicit specific-date choice -> deep-link", () => {
  assert.equal(C.classifyDefer({ id:"7", recurring:false, due:"", labels:[] }, "specific"), "deep-link");
  assert.equal(C.classifyDefer({ id:"8", recurring:false, due:"2026-06-10", labels:[] }, "2026-06-20"), "deep-link");
});

test("buildDeferArgs: not-today -> labels-only update (today dropped), no due_date", () => {
  const task = { id:"100", recurring:false, due:"2026-06-10", labels:["today","energy-low"] };
  const a = C.buildDeferArgs(task, "not-today", "2026-06-08", "req-nt");
  assert.deepEqual(a, { tasks:[{ id:"100", labels:["energy-low"] }], requestId:"req-nt" });
  assert.equal("due_date" in a.tasks[0], false);
});

test("buildDeferArgs: tomorrow-dated -> labels dropped + due_date today+1 (based on TODAY not stale due)", () => {
  const overdue = { id:"101", recurring:false, due:"2026-05-01", labels:["today"] };
  const a = C.buildDeferArgs(overdue, "tomorrow", "2026-06-08", "req-d");
  assert.deepEqual(a, { tasks:[{ id:"101", labels:[], due_date:"2026-06-09" }], requestId:"req-d" });
});

test("buildDeferArgs: tomorrow-undated -> labels-only (queue handled by caller), no due_date", () => {
  const task = { id:"102", recurring:false, due:"", labels:["today","15m"] };
  const a = C.buildDeferArgs(task, "tomorrow", "2026-06-08", "req-u");
  assert.deepEqual(a, { tasks:[{ id:"102", labels:["15m"] }], requestId:"req-u" });
  assert.equal("due_date" in a.tasks[0], false);
});

test("buildDeferArgs: deep-link cases (recurring / specific) -> null", () => {
  assert.equal(C.buildDeferArgs({ id:"103", recurring:true, due:"2026-06-10", labels:["today"] }, "tomorrow", "2026-06-08", "k"), null);
  assert.equal(C.buildDeferArgs({ id:"104", recurring:false, due:"", labels:["today"] }, "specific", "2026-06-08", "k"), null);
});
