# Command Center Backend Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Command Center artifact's Notion data layer iron-tight — complete reads, durable writes, concurrency-safe State, no blank render — with a repeatable verification harness, then deploy live-first to both computers.

**Architecture:** Extract the artifact's DOM-free data-layer logic (parsing, normalization, ranking, State merge, offline queue) into a single testable module `cc-data.js` covered by Node unit tests against real captured Notion responses. A tiny build step inlines that module into the single-file artifact between markers. Writes go through one queue-backed wrapper; the State JSON write becomes read-modify-write with anchor-based block replacement and one retry. The 6am scheduled task curates the day and refreshes the embedded snapshot. An agent-run runbook verifies live Notion round-trips that Node cannot exercise (the browser bridge).

**Tech Stack:** Vanilla ES5/ES6 browser JS (single-file HTML artifact), Node 18+ for tests (built-in `node:test` + `node:assert`, no deps), Notion MCP via `window.cowork.callMcpTool`, Cowork `update_artifact` for deployment.

---

## Environment notes (read before starting)

- **Stale bash cache quirk:** `mcp__workspace__bash` serves a stale cached copy of the project folder `Command Center Artifact` (frozen ~44733 bytes; ignores Write/Edit). The **outputs** mount is fresh. Therefore: do all Node test development and test runs inside the outputs working directory; write final deliverables to the project folder with the Write/Edit tools (which use the live path). Verify file contents with the Read tool, never bash, for files in the project folder.
- **Working dir for tests (bash):** `/sessions/<session>/mnt/outputs/cc-build/` — create it, copy sources there, run Node there.
- **Canonical source of truth for files:** project folder `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact\`.
- **Registered Cowork artifact:** id `command-center-v1-2-0`, currently at a OneDrive path (see Task 9 spike). Deploy via `mcp__cowork__update_artifact` so the Notion tools stay declared and the bridge persists.
- **Verified backend IDs:** State page `37478f3d-415b-814c-8c65-dd76b6ab9aa3`; data sources — tasks `fb432308-59b9-4078-92db-a83c6279957d`, wins `f99a9128-9809-48b9-9cb6-870717bd5183`, routines `17f7f036-e24c-40ce-9d41-db5d8a66b618`, capture `35ba4e31-eca6-4ab7-8625-acc41d5341e8`, focusSessions `291cb585-746e-4195-a920-b0ac460fbbf6`.

### Captured real Notion fixture (used by parser tests)

Task page fetch (`notion-fetch` on `37478f3d-415b-810f-b6bb-ddc7cba78f30`) returns an object whose `.text` contains:

```
<page url="https://app.notion.com/p/37478f3d415b810fb6bbddc7cba78f30">
...
<properties>
{"Area":"Focus & Work","Done":"__NO__","Notes":"Need to inform Donna when she returns from Mainland.","Priority":"__NO__","Task":"McCleary Estate Return (Husband)","date:Created:is_datetime":0,"date:Created:start":"2026-05-30","date:Due Date:is_datetime":0,"date:Due Date:start":"2026-10-05","url":"https://app.notion.com/p/37478f3d415b810fb6bbddc7cba78f30"}
</properties>
<blank-page>This page is blank and has no content.</blank-page>
</page>
```

State page fetch returns `.text` containing a fenced block:

```
State store for the Command Center artifact. Do not edit by hand.
```json
{"schemaVersion":"2.0.0","appVersion":"1.2.0","streak":12,...,"taskIds":[...15 ids...],"wins":[],"databases":{...}}
```
```

The browser bridge may return any tool result as the raw object, a JSON string, or `{content:[{type:"text",text:"..."}]}`. The normalizers must handle all three.

---

## File structure

- Create `cc-data.js` — DOM-free data layer: `unwrap`, `deepText`, `toObj`, `parseProps`, `normalizeTask`, `normalizeRoutine`, `normalizeWin`, `rankTasks`, `mergeState`, `replaceStateBlock`, `applyOps`, `assertReadComplete`. Exports via `module.exports` when `typeof module!=="undefined"`, and attaches to `globalThis.CCData` for the browser.
- Create `cc-data.test.js` — Node `node:test` suite with the real fixtures above.
- Create `fixtures.js` — exports the captured fixture strings/objects used by tests.
- Create `build.js` — inlines `cc-data.js` into the artifact HTML between `/*__CC_DATA_START__*/` and `/*__CC_DATA_END__*/`, writes the built `index.html`.
- Modify `command-center-v1.2.0.html` → produce `command-center-v1.3.0.html`: replace inline data-layer fns with markers + a thin call/queue wrapper that uses `CCData`; bump `appVersion` to `1.3.0`; harden `saveState`.
- Create `verify-backend-runbook.md` — agent-run live Notion round-trip checks (the browser-bridge verification Node can't do).
- Modify the scheduled task `command-center-6am-brief` prompt (curate `taskIds` + `routineIds`, roll streak idempotently, rewrite embedded snapshot via `update_artifact`).

All files live in the project folder except the transient `cc-build/` test dir in outputs.

---

## Task 1: Scaffold the test harness and fixtures

**Files:**
- Create: `outputs/cc-build/fixtures.js`
- Create: `outputs/cc-build/cc-data.js` (empty stub with export shim)
- Create: `outputs/cc-build/cc-data.test.js`

- [ ] **Step 1: Create the working dir and fixtures**

Run (bash): `mkdir -p /sessions/$(ls /sessions | head -1)/mnt/outputs/cc-build` — or use the outputs path from your env. Then create `fixtures.js`:

```js
const TASK_TEXT = `<page url="https://app.notion.com/p/37478f3d415b810fb6bbddc7cba78f30">
<properties>
{"Area":"Focus & Work","Done":"__NO__","Notes":"Need to inform Donna when she returns from Mainland.","Priority":"__NO__","Task":"McCleary Estate Return (Husband)","date:Created:is_datetime":0,"date:Created:start":"2026-05-30","date:Due Date:is_datetime":0,"date:Due Date:start":"2026-10-05","url":"https://app.notion.com/p/37478f3d415b810fb6bbddc7cba78f30"}
</properties>
<blank-page>This page is blank and has no content.</blank-page>
</page>`;

const TASK_OBJ = { metadata:{type:"page"}, title:"McCleary Estate Return (Husband)", url:"x", text: TASK_TEXT };
const TASK_STRING = JSON.stringify(TASK_OBJ);
const TASK_CONTENT = { content:[{ type:"text", text: TASK_OBJ.text }] };

const STATE_TEXT = 'State store. Do not edit by hand.\n```json\n{"schemaVersion":"2.0.0","appVersion":"1.2.0","streak":12,"lastCompleted":"2026-06-03","taskIds":["a","b"],"wins":[],"databases":{"tasks":"fb432308-59b9-4078-92db-a83c6279957d"}}\n```\n';

module.exports = { TASK_TEXT, TASK_OBJ, TASK_STRING, TASK_CONTENT, STATE_TEXT };
```

- [ ] **Step 2: Create the cc-data.js export shim**

```js
/*__CC_DATA_START__*/
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CCData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";
  // functions added in later tasks
  return {};
});
/*__CC_DATA_END__*/
```

- [ ] **Step 3: Create an empty test file that loads the module**

```js
const test = require("node:test");
const assert = require("node:assert");
const F = require("./fixtures");
const CC = require("./cc-data");

test("module loads", () => { assert.ok(CC); });
```

- [ ] **Step 4: Run the suite to verify it passes (green baseline)**

Run (bash, in cc-build): `node --test`
Expected: 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add cc-build/fixtures.js cc-build/cc-data.js cc-build/cc-data.test.js
git commit -m "test: scaffold cc-data harness with real Notion fixtures"
```

---

## Task 2: `unwrap` and `deepText` — tolerate every bridge wrapper shape

**Files:**
- Modify: `cc-data.js` (inside the factory)
- Modify: `cc-data.test.js`

- [ ] **Step 1: Write failing tests**

```js
test("unwrap handles string, {text}, {content[]}, array, {result}", () => {
  assert.equal(CC.unwrap("hi"), "hi");
  assert.equal(CC.unwrap({text:"hi"}), "hi");
  assert.equal(CC.unwrap({content:[{text:"a"},{text:"b"}]}), "a\nb");
  assert.equal(CC.unwrap(["a","b"]), "a\nb");
  assert.equal(CC.unwrap({result:"r"}), "r");
});

test("deepText peels a JSON-string-wrapped {text}", () => {
  const wrapped = JSON.stringify({ text: JSON.stringify({ text: "deep" }) });
  assert.equal(CC.deepText(wrapped), "deep");
});

test("deepText returns plain markdown unchanged", () => {
  assert.ok(CC.deepText(F.TASK_TEXT).includes("<properties>"));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test`
Expected: FAIL — `CC.unwrap is not a function`.

- [ ] **Step 3: Implement `unwrap` and `deepText` in the factory**

```js
function unwrap(r){
  if(r==null)return"";
  if(typeof r==="string")return r;
  if(Array.isArray(r.content))return r.content.map(function(c){return typeof c==="string"?c:(c&&c.text)||"";}).join("\n");
  if(Array.isArray(r))return r.map(function(c){return typeof c==="string"?c:(c&&c.text)||"";}).join("\n");
  if(typeof r.text==="string")return r.text;
  if(typeof r.result==="string")return r.result;
  if(r.result&&typeof r.result==="object")return unwrap(r.result);
  if(r.data&&typeof r.data==="object")return unwrap(r.data);
  try{return JSON.stringify(r);}catch(e){return String(r);}
}
function deepText(r){
  var s=unwrap(r);
  for(var i=0;i<6;i++){var t=(s||"").trim();
    if(t.charAt(0)==="{"||t.charAt(0)==="["){var o=null;try{o=JSON.parse(t);}catch(e){break;}
      if(o&&typeof o==="object"){if(typeof o.text==="string"){s=o.text;continue;}if(Array.isArray(o.content)){s=o.content.map(function(c){return(c&&c.text)||"";}).join("\n");continue;}}break;}
    break;}
  return s||"";
}
```

Add `unwrap, deepText` to the returned object.

- [ ] **Step 4: Run to verify pass**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cc-build/cc-data.js cc-build/cc-data.test.js
git commit -m "feat: cc-data unwrap/deepText tolerate all bridge wrapper shapes"
```

---

## Task 3: `parseProps` + `normalizeTask` — complete, correct task rows

**Files:**
- Modify: `cc-data.js`, `cc-data.test.js`

- [ ] **Step 1: Write failing tests (use the real fixture in all 3 wrapper shapes)**

```js
test("parseProps extracts the <properties> JSON from raw text", () => {
  const p = CC.parseProps(F.TASK_TEXT);
  assert.equal(p.Task, "McCleary Estate Return (Husband)");
  assert.equal(p.Done, "__NO__");
  assert.equal(p["date:Due Date:start"], "2026-10-05");
});

test("parseProps works through object / string / content wrappers", () => {
  for (const r of [F.TASK_OBJ, F.TASK_STRING, F.TASK_CONTENT]) {
    const p = CC.parseProps(r);
    assert.equal(p.Area, "Focus & Work");
  }
});

test("normalizeTask maps props to the UI shape", () => {
  const t = CC.normalizeTask("id1", CC.parseProps(F.TASK_OBJ));
  assert.deepEqual(t, { id:"id1", title:"McCleary Estate Return (Husband)", area:"Focus & Work",
    done:false, priority:false, due:"2026-10-05", energy:"", time:"" });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test` → FAIL (`parseProps`/`normalizeTask` not defined).

- [ ] **Step 3: Implement**

```js
function parseProps(r){
  var t=deepText(r);
  var m=t.match(/<properties>\s*([\s\S]*?)<\/properties>/);
  if(m){try{return JSON.parse(m[1]);}catch(e){try{return JSON.parse(m[1].replace(/\\"/g,'"').replace(/\\\\/g,'\\'));}catch(e2){return null;}}}
  return null;
}
function normalizeTask(id, p){
  p=p||{};
  return { id:id, title:p.Task||p.title||"(task)", area:p.Area||"",
    done:p.Done==="__YES__", priority:p.Priority==="__YES__",
    due:p["date:Due Date:start"]||"", energy:p.Energy||"", time:p["Time Estimate"]||"" };
}
```

Export both.

- [ ] **Step 4: Run to verify pass** — `node --test` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: cc-data parseProps + normalizeTask against real fixture"
```

---

## Task 4: `normalizeRoutine`, `normalizeWin`, `rankTasks`

**Files:** Modify `cc-data.js`, `cc-data.test.js`

- [ ] **Step 1: Write failing tests**

```js
test("normalizeRoutine maps props, skips inactive via caller", () => {
  const r = CC.normalizeRoutine("r1", { Routine:"Water", Active:"__YES__", "Done Today":"__NO__",
    "Time Of Day":"Morning", Mins:2, Why:"Hydrate", Order:1 });
  assert.deepEqual(r, { id:"r1", name:"Water", done:false, when:"Morning", mins:2, why:"Hydrate", order:1, active:true });
});

test("normalizeWin maps title + date", () => {
  const w = CC.normalizeWin("w1", { Win:"Shipped", "date:Date:start":"2026-06-02" });
  assert.deepEqual(w, { id:"w1", title:"Shipped", date:"2026-06-02" });
});

test("rankTasks: done last, priority first, due<=today earlier", () => {
  const today = "2026-06-03";
  const tasks = [
    { id:"d", done:true,  priority:false, due:"" },
    { id:"p", done:false, priority:true,  due:"" },
    { id:"o", done:false, priority:false, due:"" },
    { id:"due", done:false, priority:false, due:"2026-06-01" },
  ];
  const order = CC.rankTasks(tasks.slice(), today).map(t=>t.id);
  assert.deepEqual(order, ["p","due","o","d"]);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test` → FAIL.

- [ ] **Step 3: Implement**

```js
function normalizeRoutine(id, p){
  p=p||{};
  return { id:id, name:p.Routine||p.title||"(routine)", done:p["Done Today"]==="__YES__",
    when:p["Time Of Day"]||"", mins:+p.Mins||0, why:p.Why||"", order:+p.Order||99,
    active:p.Active!=="__NO__" };
}
function normalizeWin(id, p){ p=p||{}; return { id:id, title:p.Win||p.title||"(win)", date:p["date:Date:start"]||"" }; }
function rankTasks(tasks, todayISO){
  function rank(t){ if(t.done)return 100; var s=0; if(t.priority)s-=4; if(t.due&&t.due<=todayISO)s-=3; return s; }
  return tasks.sort(function(a,b){ return rank(a)-rank(b); });
}
```

Export all three.

- [ ] **Step 4: Run to verify pass** — `node --test` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: cc-data normalizeRoutine/Win + rankTasks"
```

---

## Task 5: `mergeState` + `replaceStateBlock` — concurrency-safe State write

**Files:** Modify `cc-data.js`, `cc-data.test.js`

This is the core fix for the fragile State write. `mergeState` field-merges so a concurrent machine's unrelated fields are never clobbered. `replaceStateBlock` swaps the fenced ```json block by anchor, not by exact prior bytes, so it survives content drift.

- [ ] **Step 1: Write failing tests**

```js
test("mergeState merges fields and preserves unknown ones", () => {
  const cur = '{"streak":12,"lastWinDate":"2026-06-02","databases":{"tasks":"x"}}';
  const out = CC.mergeState(cur, { lastWinDate:"2026-06-03", focusMinutesToday:25 });
  const o = JSON.parse(out);
  assert.equal(o.streak, 12);
  assert.equal(o.lastWinDate, "2026-06-03");
  assert.equal(o.focusMinutesToday, 25);
  assert.deepEqual(o.databases, { tasks:"x" });
});

test("replaceStateBlock swaps the json fence regardless of old content", () => {
  const md = CC.replaceStateBlock(F.STATE_TEXT, '{"streak":13}');
  assert.ok(md.includes('```json\n{"streak":13}\n```'));
  assert.ok(!md.includes('"streak":12'));
  assert.ok(md.startsWith("State store")); // surrounding prose preserved
});

test("replaceStateBlock is idempotent-safe when no fence exists (appends)", () => {
  const md = CC.replaceStateBlock("no fence here", '{"a":1}');
  assert.ok(md.includes('```json\n{"a":1}\n```'));
});
```

- [ ] **Step 2: Run to verify failure** — `node --test` → FAIL.

- [ ] **Step 3: Implement**

```js
function mergeState(currentJson, updates){
  var base={}; try{ base=JSON.parse(currentJson)||{}; }catch(e){ base={}; }
  for(var k in updates){ if(Object.prototype.hasOwnProperty.call(updates,k)) base[k]=updates[k]; }
  return JSON.stringify(base);
}
function replaceStateBlock(pageMarkdown, newJson){
  var fence="```json\n"+newJson+"\n```";
  var re=/```json\s*[\s\S]*?```/;
  if(re.test(pageMarkdown)) return pageMarkdown.replace(re, fence);
  return (pageMarkdown.replace(/\s*$/,"")+"\n"+fence+"\n");
}
```

Export both.

- [ ] **Step 4: Run to verify pass** — `node --test` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: cc-data mergeState + anchor-based replaceStateBlock"
```

---

## Task 6: `applyOps` (offline overlay/flush) + `assertReadComplete`

**Files:** Modify `cc-data.js`, `cc-data.test.js`

`applyOps` deterministically replays the localStorage queue onto in-memory state — used both for the offline overlay and to reason about flush order. `assertReadComplete` powers the read-completeness guarantee.

- [ ] **Step 1: Write failing tests**

```js
test("applyOps: done idempotent, add prepends, prio + win + focus apply", () => {
  const base = { tasks:[{id:"t1",done:false,priority:false}], wins:[], caps:[], focusMinutesToday:0 };
  const ops = [
    {t:"task",id:"t1",done:true},
    {t:"task",id:"t1",done:true},               // idempotent
    {t:"prio",id:"t1",priority:true},
    {t:"taskAdd",tmpid:"tmp1",title:"New"},
    {t:"win",title:"W",date:"2026-06-03"},
    {t:"focus",min:25},
  ];
  const s = CC.applyOps(base, ops);
  assert.equal(s.tasks.find(x=>x.id==="t1").done, true);
  assert.equal(s.tasks.find(x=>x.id==="t1").priority, true);
  assert.equal(s.tasks[0].id, "tmp1");          // prepended
  assert.equal(s.wins[0].title, "W");
  assert.equal(s.focusMinutesToday, 25);
});

test("assertReadComplete reports missing ids", () => {
  const r = CC.assertReadComplete(["a","b","c"], [{id:"a"},{id:"c"}]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["b"]);
  const r2 = CC.assertReadComplete(["a"], [{id:"a"}]);
  assert.equal(r2.ok, true);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test` → FAIL.

- [ ] **Step 3: Implement**

```js
function applyOps(base, ops){
  var s = JSON.parse(JSON.stringify(base));
  s.tasks=s.tasks||[]; s.wins=s.wins||[]; s.caps=s.caps||[];
  (ops||[]).forEach(function(op){
    if(op.t==="task"){var x=s.tasks.filter(function(z){return z.id===op.id;})[0]; if(x)x.done=op.done;}
    else if(op.t==="prio"){var xp=s.tasks.filter(function(z){return z.id===op.id;})[0]; if(xp)xp.priority=op.priority;}
    else if(op.t==="routine"){s.routines=s.routines||[]; var r=s.routines.filter(function(z){return z.id===op.id;})[0]; if(r)r.done=op.done;}
    else if(op.t==="taskAdd"){ if(!s.tasks.some(function(z){return z.id===op.tmpid;})) s.tasks.unshift({id:op.tmpid,title:op.title,area:"Focus & Work",done:false,priority:false,due:"",energy:"",time:""}); }
    else if(op.t==="win"){ s.wins.unshift({title:op.title,date:op.date}); }
    else if(op.t==="cap"){ s.caps.unshift({id:null,item:op.item}); }
    else if(op.t==="focus"){ s.focusMinutesToday=(+s.focusMinutesToday||0)+op.min; }
  });
  return s;
}
function assertReadComplete(ids, rows){
  var have={}; (rows||[]).forEach(function(r){ have[r.id]=1; });
  var missing=(ids||[]).filter(function(id){ return !have[id]; });
  return { ok: missing.length===0, missing: missing };
}
```

Export both.

- [ ] **Step 4: Run to verify pass** — `node --test` → PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: cc-data applyOps + assertReadComplete"
```

---

## Task 7: Build step — inline `cc-data.js` into the artifact

**Files:**
- Create: `build.js` (in project folder + copy in cc-build for running)
- Create from source: `command-center-v1.3.0.html` (start as a copy of `command-center-v1.2.0.html`)

- [ ] **Step 1: Prepare v1.3.0 source with markers and the thin wrapper**

In `command-center-v1.3.0.html`: (a) bump the title and the `appVersion`/badge to `1.3.0`; (b) delete the inline `unwrap/deepText/toObj/parseProps` definitions and the inline `clone`-based normalization inside `liveLoad`; (c) insert the marker pair `/*__CC_DATA_START__*/ ... /*__CC_DATA_END__*/` at the top of the IIFE where `cc-data.js` content will be inlined; (d) rewrite `liveLoad` to build rows via `CCData.normalizeTask/Routine/Win` and `CCData.rankTasks`, and assert `CCData.assertReadComplete` (log shortfall to the diagnostic); (e) leave a placeholder `globalThis.CCData` reference — at runtime the inlined block defines it.

- [ ] **Step 2: Write `build.js`**

```js
const fs = require("fs");
const path = require("path");
const SRC = process.argv[2];          // command-center-v1.3.0.html
const DATA = process.argv[3];         // cc-data.js
const OUT = process.argv[4];          // index.html (built)
const html = fs.readFileSync(SRC, "utf8");
const data = fs.readFileSync(DATA, "utf8");
const re = /\/\*__CC_DATA_START__\*\/[\s\S]*?\/\*__CC_DATA_END__\*\//;
if (!re.test(html)) { console.error("MARKERS NOT FOUND"); process.exit(1); }
const out = html.replace(re, data.trim());
fs.writeFileSync(OUT, out);
console.log("built", OUT, out.length, "bytes");
```

- [ ] **Step 3: Run the build in cc-build**

Run (bash): `node build.js command-center-v1.3.0.html cc-data.js index.html`
Expected: `built index.html <N> bytes` and no `MARKERS NOT FOUND`.

- [ ] **Step 4: Smoke-test the built file loads CCData under Node-like check**

Run (bash): `node -e "const h=require('fs').readFileSync('index.html','utf8'); if(!h.includes('CCData')) {console.error('NO CCDATA');process.exit(1)} console.log('ok')"`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add build.js command-center-v1.3.0.html
git commit -m "build: inline cc-data into single-file artifact v1.3.0"
```

---

## Task 8: Harden the runtime wrapper (call/queue/saveState) in the artifact

**Files:** Modify `command-center-v1.3.0.html` (script section)

- [ ] **Step 1: Replace `saveState` with read-modify-write + retry**

```js
async function saveState(updates){
  Object.assign(app.state, updates);
  if(app.mode!=="live")return;            // queued via per-op localStorage; flush re-applies
  for(var attempt=0; attempt<2; attempt++){
    try{
      var fresh=await call(T.fetch,{id:STATE_PAGE});
      var md=CCData.deepText(fresh);
      var m=md.match(/```json\s*([\s\S]*?)```/);
      var curJson=m?m[1].trim():JSON.stringify(app.state);
      var newJson=CCData.mergeState(curJson, updates);
      var newMd=CCData.replaceStateBlock(md, newJson);
      await call(T.update,{page_id:STATE_PAGE,command:"update_content",content_updates:[{old_str:md,new_str:newMd}]});
      app.stateJson=newJson; app.state=JSON.parse(newJson);
      return;
    }catch(e){ if(attempt===1){ DIAG.err="saveState failed: "+((e&&e.message)||e); } }
  }
}
```

- [ ] **Step 2: Route every write through one wrapper that always queues then attempts live**

Confirm `toggleTask`, `togglePriority`, `toggleRoutine`, `addTask`, `addCapture`, `addWin`, `logFocus` each: (a) update UI optimistically, (b) `lsPush(op)`, (c) if live, attempt the Notion call, (d) on success remove that op from the queue (extend `lsClear` to a per-op `lsRemove(op)`), (e) on failure leave it queued. Add `lsRemove`:

```js
function lsRemove(op){var o=lsGet();o.pending=(o.pending||[]).filter(function(p){return JSON.stringify(p)!==JSON.stringify(op);});lsSet(o);}
```

- [ ] **Step 3: Reduce bridge poll to 5s and assert read completeness in `liveLoad`**

In `liveLoad`, after tasks load: `var chk=CCData.assertReadComplete(ids,app.tasks); if(!chk.ok){DIAG.err="missing tasks: "+chk.missing.join(",");}`. In `boot`, change `waitBridge(12000)` to `waitBridge(5000)`.

- [ ] **Step 4: Rebuild and smoke-test**

Run (bash): `node build.js command-center-v1.3.0.html cc-data.js index.html && node -e "require('fs').readFileSync('index.html','utf8').includes('saveState')||process.exit(1);console.log('ok')"`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: concurrency-safe saveState + per-op queue flush + read assertion"
```

---

## Task 9: Google Drive deployment spike + deploy

**Files:** Create `verify-backend-runbook.md` (deployment section), update registered artifact

This is the one genuine unknown. Resolve empirically, then deploy.

- [ ] **Step 1: Inspect how the artifact is registered**

Call `mcp__cowork__list_artifacts`. Record the current `path` (OneDrive) and `id` (`command-center-v1-2-0`). Read the file at that path with the Read tool to confirm it is the live HTML.

- [ ] **Step 2: Determine whether `update_artifact` accepts a target path / `mcp_tools`**

Load `mcp__cowork__update_artifact` via ToolSearch and read its schema. Note whether it supports (a) declaring `mcp_tools` (needed so the Notion bridge stays bound) and (b) any path/location parameter. Capture findings in `verify-backend-runbook.md`.

- [ ] **Step 3: Decide deployment location**

If `update_artifact`/`create_artifact` cannot target Google Drive directly, document the fallback: keep canonical `command-center-v1.3.0.html` in this project folder, and also write a deployed copy into the Google Drive "Claude Documents Folder" (`1b3UssAXoqoyi6yQvDuLuN42cfUkPwxVK`, owner `mauitaxes@gmail.com`) via the Google Drive connector (`create_file`/`copy_file`). Note explicitly that the bridge is provided by the Cowork artifact viewer, so the *registered* artifact (not a raw Drive HTML opened via file://) is what must exist on each machine. Record the exact open/registration procedure for both home and office.

- [ ] **Step 4: Deploy the built `index.html` to the registered artifact**

Call `mcp__cowork__update_artifact` with id `command-center-v1-2-0`, the new HTML body, and `mcp_tools` including the Notion server tools (`notion-fetch`, `notion-search`, `notion-update-page`, `notion-create-pages`). This is the step that keeps the bridge functional.

- [ ] **Step 5: Commit the runbook**

```bash
git add verify-backend-runbook.md
git commit -m "docs: GDrive deployment spike findings + deploy procedure"
```

---

## Task 10: Update the 6am scheduled task (curator + snapshot refresher)

**Files:** Update scheduled task `command-center-6am-brief` via `mcp__scheduled-tasks__update_scheduled_task`

- [ ] **Step 1: Read the current task**

Call `mcp__scheduled-tasks__list_scheduled_tasks`, find `command-center-6am-brief`, capture its current prompt and `cronExpression` (`0 6 * * *` HST).

- [ ] **Step 2: Rewrite the prompt to be idempotent and snapshot-refreshing**

The new prompt must instruct the agent to, in order: (1) read State; (2) if `routineResetDate` !== today HST → reset all routines' `Done Today` to `__NO__` and set `routineResetDate`; else skip (idempotent); (3) curate today's `taskIds` (incomplete + priority + due) and write the list to State; (4) populate `routineIds` (all active routines) into State; (5) roll the streak only if `lastStreakDate` !== today AND both `lastCompleted`===today and `lastWinDate`===today; (6) write a short brief string into State; (7) rebuild the embedded `SNAPSHOT` object from live Notion data and update the registered artifact's HTML via `update_artifact` (replace the `var SNAPSHOT={...};` block). All writes via the same merge/anchor approach.

- [ ] **Step 3: Update the task**

Call `mcp__scheduled-tasks__update_scheduled_task` with the new prompt, keeping the cron unchanged.

- [ ] **Step 4: Dry-run once now**

Trigger the task once (or run its prompt inline) and verify: State `routineResetDate`/`taskIds`/`routineIds` updated, snapshot block in the artifact refreshed, no double-roll of streak on a second run.

- [ ] **Step 5: Commit any related doc updates**

```bash
git commit -am "feat: 6am task curates ids, rolls streak idempotently, refreshes snapshot"
```

---

## Task 11: Agent-run live verification harness (browser-bridge round-trips)

**Files:** Create `verify-backend-runbook.md` (verification section)

Node covers the logic; this runbook covers what only a live Notion round-trip can prove. The agent executes it and records evidence.

- [ ] **Step 1: Read completeness (live)**

Fetch all State `taskIds` by ID via `notion-fetch`; assert count equals `taskIds.length` and each parsed row has Task/Done/Area. Repeat for `routineIds`. Record pass/fail + one captured raw sample.

- [ ] **Step 2: Write round-trip per type**

For each: Task Done toggle, Priority toggle, routine Done Today, add+delete task, add+delete win, add+delete capture, focus-session create — write a sentinel via the Notion MCP, re-read by ID, assert it landed, then revert/delete. Record results.

- [ ] **Step 3: State concurrency**

Read State, compute newJson A (set field A). Independently read State, compute newJson B (set field B) from the *original* markdown (stale). Apply A, then apply B via `replaceStateBlock` after a fresh re-read; assert both A and B survive (the retry/re-read path). Record result.

- [ ] **Step 4: Browser-side confirmation**

Ask Chris to make one edit in the deployed artifact on each machine (home + office); agent re-reads Notion and confirms it landed from both. Record the two confirmations. (Mirrors the 2026-06-03 bridge test.)

- [ ] **Step 5: No-blank invariant**

Confirm in the built HTML that `boot()` calls `loadSnapshot()`+`renderAll()` before `waitBridge`, and that a live-load failure path calls `renderAll()` in the catch. Record the line evidence.

- [ ] **Step 6: Commit**

```bash
git commit -am "docs: completed live verification harness with evidence"
```

---

## Self-review (completed by plan author)

- **Spec coverage:** §3 live-first → Tasks 7,8 (boot/poll, snapshot cold-start) + Task 11.5. §4 read contract → Tasks 3,4,6 (+ `routineIds` in Task 10). §5 writes/State → Tasks 5,8,11.2,11.3. §6 cross-device → Tasks 9,10,11.4. §7 storage/GDrive → Task 9. §8 harness → Tasks 1–6 (Node) + Task 11 (live). §9 acceptance criteria → mapped across Tasks 8–11. All sections have at least one task.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output.
- **Type consistency:** task shape `{id,title,area,done,priority,due,energy,time}` is identical in `normalizeTask` (Task 3), `applyOps` (Task 6), and the artifact wrapper (Task 8). State write helpers `mergeState`/`replaceStateBlock` are referenced consistently in Tasks 5 and 8. `lsRemove` defined in Task 8.2 and used in 8.2.
- **Known open item (not a placeholder):** Task 9 is a deliberate spike — its outcome (whether `update_artifact` can target Google Drive) is recorded in the runbook, with a documented fallback either way.
