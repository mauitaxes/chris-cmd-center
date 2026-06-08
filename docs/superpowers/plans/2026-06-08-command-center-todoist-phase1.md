# Command Center × Todoist × Calendar — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Command Center dashboard's Notion task list with Todoist (read + add/complete/defer), add a read-only Google Calendar lane, and keep Notion for Wins/Routines/Focus/Daily Log/State — without disturbing the deployed app.

**Architecture:** The app is a single bundled `dist/index.html` built by `cc-build.js` from `src/index.html` + `src/styles.css` + `src/app.a.js` + `src/app.b.js` + `cc-data.js`. `cc-data.js` is a pure UMD logic module (`CCData` in-browser, `require`d by node tests) — **all deterministic logic is TDD'd here.** The DOM/fetch layer lives in `src/app.*.js`. Writes go through the Netlify function `netlify/functions/notion-proxy.js`; Todoist gets a sibling path. This plan covers the pre-cutover spine in full bite-sized detail (Task 0 → 1 → 2) and stops at **CP2** (migration reconciled, before cutover). Tasks 3–10 are a roadmap, expanded after CP2/CP3.

**Tech Stack:** Vanilla JS (ES5-ish, no framework, no root `package.json`). Test runner: `node --test` (node:test + node:assert/strict) over `cc-data.test.js` and `tests/*.mjs` — **91 tests green at HEAD `0936e8b`.** Build: `node cc-build.js`. Deploy: Netlify auto-build of `main` → chris-cmd-center.netlify.app. Connectors: Todoist MCP `b9779bcc-…`, Notion MCP `b47f7667-…`, Google Calendar (read). App-runtime Todoist auth = `TODOIST_API_TOKEN` Netlify secret.

---

## Stack & test-runner confirmation (done 2026-06-08, live repo)

- No root `package.json`. `node --test` auto-discovers `cc-data.test.js` (CJS via `createRequire`) + `tests/notion-proxy.test.mjs` (ESM). Verified: **`# pass 91 / # fail 0`**, node v22.22.0.
- `cc-data.js` exports 22 pure functions via UMD. New pure logic is added here and exported in the bottom `return {…}` block, with tests in `cc-data.test.js`. **This is the TDD surface.**
- `netlify/functions/` is `"type":"module"`; `notion-proxy.js` exports pure helpers + `dispatch({name,args,fetchImpl})` + `handler`. Todoist server-side logic will follow the same injectable-`fetchImpl` pattern so it is node-testable.
- **Build-input size guard is real:** `cc-build.js` aborts if any input > 40 KB (bash mount truncates ~44 KB). `app.a.js` = 25.8 KB, `app.b.js` = 25.1 KB today. Adding Todoist browser code will likely cross 40 KB → **plan splits new browser logic into `src/app.c.js`** and registers it in `cc-build.js` (see Task 3 roadmap). Pre-CP2 work touches mostly `cc-data.js` + an operational migration runner, so the split is not needed to reach CP2.

## Key integration points (confirmed in source)

- `src/app.a.js`: `call(name,args)` MCP dispatcher (browser → `fetch(PROXY_URL,…)`, Cowork → `window.cowork.callMcpTool`); `T` = tool-name map; `DBS` = db-id map; `AREAS` = the 7 areas; `readState()` loads State + merges `obj.databases` into `DBS`; `liveLoad()` reads tasks/routines/wins/caps by State id-arrays; `saveState(updates)` writes State (chunked) + offline-queues on failure; `flushPending()`; `app` in-memory model.
- `cc-data.js`: `mergeState` (taskIds union-merge), `applyOps`, `registerId`, `normalizeTask`, etc.
- `netlify/functions/notion-proxy.js`: `dispatch` switches on `notion-*` tool names; `chunkRichText` (>2000-char split — do not regress).

## Migration idempotency decision (supersedes handoff §5 step 5 mechanism)

Handoff §5 specifies a Sync-API `item_add` with a client-generated `uuid` so Todoist discards already-applied commands. **The Cowork Todoist MCP `add-tasks` does NOT expose a command `uuid`** (confirmed against its schema) and caps at **25 tasks/call** (not 100). So server-side uuid dedup is unavailable in-session. Instead:

- Each migrated task carries a deterministic marker `[ccid:<hash8>]` appended to its description, where `<hash8>` = `CCData.migrationIdKey(notionPageId)`.
- The migration runner **pre-checks** with `find-tasks` (searchText `ccid:<hash8>`) and **skips** any task whose marker already exists. This gives re-runnable-without-duplicates semantics through the MCP. The deterministic hash is the dedup key — enforced client-side instead of server-side.
- This is additive and Notion is untouched, so rollback remains: re-point dashboard at Notion, delete the Command Center Todoist project.

---

## Task 0 — Foundation: D9 runtime ID resolution (blocks everything)

Wire boot-time database-ID resolution so the dashboard never silently renders an empty panel from a stale/missing ID, and register the Daily Log DB. Pure logic is TDD'd in `cc-data.js`; the wiring lives in `readState()`.

**Files:**
- Modify: `cc-data.js` (add `missingDbKeys`, `mergeResolvedDatabases`; export both)
- Test: `cc-data.test.js` (new tests)
- Modify: `src/app.a.js` `readState()` (use the helpers; resolve-by-title + write back; fail loud)

- [ ] **Step 1: Write failing test for `missingDbKeys`**

```js
// cc-data.test.js — append
test("missingDbKeys: returns required keys absent or falsy in the map", () => {
  const dbs = { tasks:"id-t", wins:"", routines:"id-r" };
  assert.deepEqual(
    C.missingDbKeys(dbs, ["tasks","wins","routines","dailyLog"]),
    ["wins","dailyLog"]
  );
});
test("missingDbKeys: empty required -> empty", () => {
  assert.deepEqual(C.missingDbKeys({tasks:"x"}, []), []);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test 2>&1 | grep -E "missingDbKeys|# (pass|fail)"`
Expected: FAIL — `C.missingDbKeys is not a function`.

- [ ] **Step 3: Implement `missingDbKeys` in `cc-data.js`**

```js
// add near Group 6 helpers
function missingDbKeys(dbs, required){
  dbs=dbs||{};
  return (required||[]).filter(function(k){ return !dbs[k]; });
}
```
Add `missingDbKeys: missingDbKeys,` to the `return {…}` export block.

- [ ] **Step 4: Run it, verify pass**

Run: `node --test 2>&1 | grep -E "# (pass|fail)"`
Expected: `# pass 93 # fail 0` (91 prior + 2 new).

- [ ] **Step 5: Write failing test for `mergeResolvedDatabases`**

```js
test("mergeResolvedDatabases: adds resolved ids, never overwrites existing", () => {
  const base = { tasks:"id-t" };
  const out = C.mergeResolvedDatabases(base, { dailyLog:"id-dl", tasks:"WRONG" });
  assert.equal(out.tasks, "id-t");      // existing kept
  assert.equal(out.dailyLog, "id-dl");  // new added
  assert.notEqual(out, base);            // pure: new object
});
```

- [ ] **Step 6: Run it, verify it fails**

Run: `node --test 2>&1 | grep -E "mergeResolvedDatabases|# fail"`
Expected: FAIL — not a function.

- [ ] **Step 7: Implement `mergeResolvedDatabases`**

```js
function mergeResolvedDatabases(databases, resolved){
  var out={}; var k;
  for(k in (databases||{})){ if(Object.prototype.hasOwnProperty.call(databases,k)) out[k]=databases[k]; }
  for(k in (resolved||{})){ if(Object.prototype.hasOwnProperty.call(resolved,k) && !out[k]) out[k]=resolved[k]; }
  return out;
}
```
Add `mergeResolvedDatabases: mergeResolvedDatabases,` to exports.

- [ ] **Step 8: Run tests, verify pass**

Run: `node --test 2>&1 | grep -E "# (pass|fail)"`
Expected: `# pass 95 # fail 0`.

- [ ] **Step 9: Wire D9 into `readState()` (src/app.a.js)**

Replace the `if(obj.databases){…}` line in `readState()` with logic that: (a) merges `obj.databases` into `DBS`; (b) computes `CCData.missingDbKeys(DBS, REQUIRED_DBS)` where `REQUIRED_DBS=["tasks","wins","routines","capture","focusSessions","dailyLog"]`; (c) for each missing key, `searchIds`-by-title under the parent page using a `DB_TITLES` map (titles confirmed live at execution); (d) on resolve, `DBS[k]=found.id` and accumulate `resolvedPairs`; (e) if any required key is still unresolved, call a new `fatalConfig(msg)` that renders a visible banner (reuse `setSync("config", …)`) instead of leaving panels empty; (f) if `resolvedPairs` non-empty, `await saveState({databases: CCData.mergeResolvedDatabases(obj.databases||{}, resolvedPairs)})`.

```js
// inside readState(), replacing: if(obj.databases){for(var k in obj.databases)DBS[k]=obj.databases[k];}
if(obj.databases){ for(var k in obj.databases) DBS[k]=obj.databases[k]; }
var REQUIRED_DBS=["tasks","wins","routines","capture","focusSessions","dailyLog"];
var DB_TITLES={tasks:"Tasks",wins:"Wins",routines:"Routines",capture:"Capture",focusSessions:"Focus Sessions",dailyLog:"Daily Log"}; // titles confirmed live in Step 10
var missing=CCData.missingDbKeys(DBS, REQUIRED_DBS), resolvedPairs={};
for(var mi=0; mi<missing.length; mi++){
  var mk=missing[mi]; var hits=await searchIds(null /*workspace*/, DB_TITLES[mk], 5);
  var hit=(hits||[]).filter(function(h){return (h.title||"").trim()===DB_TITLES[mk];})[0];
  if(hit){ DBS[mk]=hit.id; resolvedPairs[mk]=hit.id; }
}
var stillMissing=CCData.missingDbKeys(DBS, REQUIRED_DBS);
if(stillMissing.length){ setSync("config","Missing DB: "+stillMissing.join(", ")); }
if(Object.keys(resolvedPairs).length){ await saveState({databases:CCData.mergeResolvedDatabases(obj.databases||{}, resolvedPairs)}); }
```
Note: `searchIds(dsKey,q,n)` currently keys off `DBS[dsKey]` for a data-source scope; for title resolution we need a workspace-wide search under the parent. Confirm `searchIds` can take a null scope (workspace_search mode it already uses) at execution; if not, add a thin `searchWorkspace(title,n)` wrapper. **This is the one place to verify against the live MCP before relying on it.**

- [ ] **Step 10: Confirm DB titles + Daily Log id live, then build**

Via Notion MCP, fetch the parent page `27268b77-7a95-4cd0-a94c-82bb12188b9a` and confirm the exact child-DB titles; confirm Daily Log id `5c892f50-2d01-4731-9b04-ed3ac02defcf`. Adjust `DB_TITLES` to match exactly. Then:
Run: `node cc-build.js`
Expected: `built dist/index.html <size> bytes` (no abort).

- [ ] **Step 11: Commit**

```bash
git add cc-data.js cc-data.test.js src/app.a.js dist/index.html
git commit -m "feat(task0): D9 runtime DB-id resolution + Daily Log registration + fail-loud on missing DB"
```

**0c (optional, Chris-gated, non-blocking):** archive stray `Routine` DB `28aa34d3…` and delete `[DUPLICATE…]` page `37778f3d…81c3` to remove title-resolution ambiguity. The Notion MCP cannot delete — these are Chris's 2-click manual actions. Skip if not yet done; D9 title-match is exact-string so the dup page (different title) does not collide.

---

## Task 1 — Todoist structure (blocks migration + reads)

Create the Command Center project tree + label set once, via the Todoist MCP, and store the returned IDs in State. Pure spec + State-payload builder are TDD'd; the create calls are operational.

**Files:**
- Modify: `cc-data.js` (add `ccTodoistSpec`, `buildTodoistStatePayload`; export)
- Test: `cc-data.test.js`
- Operational: Todoist MCP `add-projects` / `add-labels`; `saveState` of returned IDs

- [ ] **Step 1: Write failing test for `ccTodoistSpec`**

```js
test("ccTodoistSpec: parent + 7 areas + full label set", () => {
  const s = C.ccTodoistSpec();
  assert.equal(s.parent, "Command Center");
  assert.deepEqual(s.areas, ["Daily Routines","Focus & Work","Health & Sleep","Finances","Home & Space","Relationships","Claude Tasks"]);
  assert.deepEqual(s.labels, ["today","energy-low","energy-med","energy-high","5m","15m","30m","1h","2h"]);
});
```

- [ ] **Step 2: Run, verify fail.** `node --test 2>&1 | grep ccTodoistSpec` → FAIL.

- [ ] **Step 3: Implement `ccTodoistSpec`**

```js
function ccTodoistSpec(){
  return {
    parent:"Command Center",
    areas:["Daily Routines","Focus & Work","Health & Sleep","Finances","Home & Space","Relationships","Claude Tasks"],
    labels:["today","energy-low","energy-med","energy-high","5m","15m","30m","1h","2h"]
  };
}
```
Export it. (Label names are stored without the `@` — Todoist labels are referenced bare; `@` is only display syntax.)

- [ ] **Step 4: Run, verify pass.** `node --test 2>&1 | grep -E "# (pass|fail)"` → `# pass 96`.

- [ ] **Step 5: Write failing test for `buildTodoistStatePayload`**

```js
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
```

- [ ] **Step 6: Run, verify fail.**

- [ ] **Step 7: Implement `buildTodoistStatePayload`**

```js
function buildTodoistStatePayload(parentId, areaProjects, labels){
  var projects={}, labelMap={};
  (areaProjects||[]).forEach(function(p){ if(p&&p.name) projects[p.name]=p.id; });
  (labels||[]).forEach(function(l){ if(l&&l.name) labelMap[l.name]=l.id; });
  return { todoistParentId:parentId||"", todoistProjects:projects, todoistLabels:labelMap };
}
```
Export it.

- [ ] **Step 8: Run tests, verify pass.** `# pass 98`.

- [ ] **Step 9: Commit the pure helpers**

```bash
git add cc-data.js cc-data.test.js
git commit -m "feat(task1): Todoist structure spec + State-payload builder (pure)"
```

- [ ] **Step 10: Operationally create the structure (Todoist MCP)**

1. `find-projects` to confirm the space is still fresh (Inbox + default only). If a `Command Center` parent already exists, reuse its id (idempotent restart).
2. `add-projects` → `Command Center` (color e.g. `charcoal`). Capture returned id = PARENT.
3. `add-projects` (one call, up to 7) → the 7 areas, each `parentId: PARENT`. Capture id per area.
4. `add-labels` → the 9 labels from `ccTodoistSpec().labels` (skip any that already exist; `find-labels` first). Capture id per label.
5. Confirm Inbox is the capture target (`projectId:"inbox"` works in `add-tasks` — schema-confirmed).

- [ ] **Step 11: Persist returned IDs to State**

Build `CCData.buildTodoistStatePayload(PARENT, areaProjects, labels)` and `saveState(payload)` so `app.state.todoistProjects` / `todoistLabels` / `todoistParentId` exist for reads + migration. Verify by re-fetching the State page and confirming the JSON block contains all 7 project ids + 9 label ids.

- [ ] **Step 12: Commit a structure record (no code)** — append the resolved id table to this plan or a `docs/` note for traceability (optional).

---

## Task 2 — Migration (one-shot, idempotent, NOT TDD for I/O) → **CP2**

Move open Notion Tasks + untriaged Captures into Todoist once, verified by reconciliation. Pure transforms are TDD'd; the import + reconcile is operational. **Stop at CP2 — do not cut the dashboard over to Todoist.**

**Files:**
- Modify: `cc-data.js` (add `migrationIdKey`, `notionTaskToTodoist`, `notionCaptureToTodoist`, `reconcileCounts`; export)
- Test: `cc-data.test.js`
- Operational: a node runner `scripts/migrate.mjs` (NOT a build input — lives outside `cc-build.js`) that requires `cc-data.js`, reads Notion via MCP results passed in, and issues `add-tasks`

- [ ] **Step 1: Write failing test for `migrationIdKey` (deterministic)**

```js
test("migrationIdKey: deterministic 8-char hash of a notion page id", () => {
  const a = C.migrationIdKey("27268b77-7a95-4cd0-a94c-82bb12188b9a");
  const b = C.migrationIdKey("27268b77-7a95-4cd0-a94c-82bb12188b9a");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(a, C.migrationIdKey("different-id"));
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `migrationIdKey` (FNV-1a, no deps)**

```js
function migrationIdKey(pageId){
  var s=String(pageId||""), h=0x811c9dc5;
  for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
  return ("0000000"+h.toString(16)).slice(-8);
}
```
Export it.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Write failing test for `notionTaskToTodoist`**

```js
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
```

- [ ] **Step 6: Run, verify fail.**

- [ ] **Step 7: Implement `notionTaskToTodoist`**

```js
function notionTaskToTodoist(task, opts){
  task=task||{}; opts=opts||{};
  var projectId=(opts.projectByArea&&task.area&&opts.projectByArea[task.area])||opts.parentId||"";
  var labels=[];
  var el=opts.energyLabelMap&&task.energy&&opts.energyLabelMap[task.energy]; if(el) labels.push(el);
  var tl=opts.timeLabelMap&&task.time&&opts.timeLabelMap[task.time]; if(tl) labels.push(tl);
  var marker="[ccid:"+migrationIdKey(task.id)+"]";
  var notes=String(task.notes||"");
  var created=task.created?("[created "+String(task.created).slice(0,10)+"] "):"";
  var description=(created+notes).trim();
  description=(description?description+" ":"")+marker;
  var out={ content:String(task.title||"(task)"), projectId:projectId,
            priority:task.priority?"p1":"p4", labels:labels, description:description };
  if(task.due) out.dueString=String(task.due).slice(0,10);
  return out;
}
```
Export it.

- [ ] **Step 8: Run, verify pass.**

- [ ] **Step 9: Write failing test for `notionCaptureToTodoist`**

```js
test("notionCaptureToTodoist: inbox + marker", () => {
  const out = C.notionCaptureToTodoist({id:"CAP1",item:"call plumber",notes:""});
  assert.equal(out.projectId, "inbox");
  assert.equal(out.content, "call plumber");
  assert.match(out.description, /\[ccid:[0-9a-f]{8}\]/);
});
```

- [ ] **Step 10: Run fail → Step 11 implement → Step 12 pass**

```js
function notionCaptureToTodoist(cap){
  cap=cap||{};
  var marker="[ccid:"+migrationIdKey(cap.id)+"]";
  var notes=String(cap.notes||"");
  var description=(notes?notes+" ":"")+marker;
  return { content:String(cap.item||"(note)"), projectId:"inbox", description:description };
}
```
Export. Run: `node --test` → all pass.

- [ ] **Step 13: Write failing test for `reconcileCounts`**

```js
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
```

- [ ] **Step 14: Run fail → Step 15 implement → Step 16 pass**

```js
function reconcileCounts(expected, actual){
  expected=expected||{}; actual=actual||{};
  var keys={}, k; for(k in expected) keys[k]=1; for(k in actual) keys[k]=1;
  var rows=[], allOk=true;
  Object.keys(keys).forEach(function(key){
    var e=+expected[key]||0, a=+actual[key]||0, ok=(e===a);
    if(!ok) allOk=false;
    rows.push({key:key, expected:e, actual:a, ok:ok});
  });
  return { ok:allOk, rows:rows };
}
```
Export. Run: `node --test 2>&1 | grep -E "# (pass|fail)"` → all green.

- [ ] **Step 17: Commit pure migration helpers**

```bash
git add cc-data.js cc-data.test.js
git commit -m "feat(task2): pure migration transforms (idKey, task/capture->todoist, reconcileCounts)"
```

- [ ] **Step 18: Freeze + export live Notion data**

Tell Chris to add nothing during the run. Via Notion MCP, re-fetch open Tasks (`Done=false`) from `fb432308…` and untriaged Captures (`Processed=false`) from `35ba4e31…`. Record the **source-of-truth counts**: total open tasks, count per Area, count with Priority=true (→ "P1"), untriaged capture count (→ "Inbox"). **Inspect distinct `Energy` and `Time Estimate` select values** in the live data and finalize `energyLabelMap` / `timeLabelMap` to match the actual option strings (do not assume).

**Export shape note:** `notionTaskToTodoist` reads `task.notes` and `task.created`, which `CCData.normalizeTask` does NOT extract. The migration runner must build task objects directly from `CCData.parseProps(page)` — `{ id, title:p.Task, area:p.Area, priority:p.Priority==="__YES__", due:p["date:Due Date:start"], energy:p.Energy, time:p["Time Estimate"], notes:p.Notes||"", created:p["date:Created:start"]||"" }` — i.e. a richer shape than `normalizeTask` returns. Likewise captures: `{ id, item:p.Item, notes:p.Notes||"" }`. (Optionally extend `normalizeTask` with `notes`/`created` under TDD instead — but the operational runner building its own shape keeps the dashboard's normalizeTask untouched, which is lower-risk pre-cutover.)

- [ ] **Step 19: Idempotent import via `add-tasks` (≤25/call)**

For each open task: compute `CCData.notionTaskToTodoist(task, opts)`. Before adding, `find-tasks` with `searchText:"ccid:"+migrationIdKey(task.id)`; **skip if a match exists** (re-run safety). Batch the remainder ≤25/call. Repeat for captures with `notionCaptureToTodoist` (projectId `inbox`). Map `dueString` (date-only string) straight through.

- [ ] **Step 20: Reconcile (do not skip)**

Via `find-tasks` per area project (and `filter:"p1"`, and `projectId:"inbox"`), count actual Todoist tasks. Build `actual{}` and the `expected{}` from Step 18; run `CCData.reconcileCounts(expected, actual)`. Spot-check **5 tasks end-to-end** (title, due, priority, labels, notes) by fetching them back. Confirm P1 count and Inbox count match.

- [ ] **Step 21: 🛑 CP2 — STOP for Chris**

Present the reconciliation table (`reconcileCounts` rows) + the 5 spot-checks. **Do not cut the dashboard over to Todoist.** Notion Tasks/Capture DBs stay intact as the rollback net. Await sign-off before any Task 3+ work or cutover.

---

## Tasks 3–10 — Roadmap (expanded into bite-sized steps after CP2/CP3)

These are deliberately not yet broken to step granularity: Task 3 reads depend on the migrated tree, Task 4 is a hard gate whose endpoint response shape is an open item (§13.1), and several need Chris inputs (calendar allow-list, D3 thresholds). Each becomes its own TDD task block when we resume.

- **Browser-code split (precondition for Task 3/5/6):** new Todoist read/write/defer browser logic goes in a new `src/app.c.js`; register it in `cc-build.js`'s input array and concatenation, keeping every input < 40 KB. Add a Todoist branch to `netlify/functions/notion-proxy.js` (or a sibling `todoist-proxy.js`) using `TODOIST_API_TOKEN` server-side and the injectable-`fetchImpl` test pattern; tests in `tests/`.
- **Task 3 — Reads [P after 1]:** 3a task tiles (Open/P1/Active areas/per-area); 3b Today's panel (saved filter `(@today | today | overdue)` scoped to CC tree, overdue collapsible, threshold 5 — Chris to tune); 3c Schedule panel (allow-listed Google Calendar IDs — Chris to provide, read-only, time-ordered); 3d Inbox chip; 3e Today's Progress (§6: frozen `plannedToday[]` denominator, forward-only, may exceed 100%, completed-by-completion-date HST→UTC window — depends on Task 7 snapshot; stub denominator until 7).
- **Task 4 — Recurring-completion spike [S] → CP3 gate:** complete a recurring task, query completed-by-completion-date, confirm it appears + capture response shape + tree scoping. **Do not flip the streak until this passes.**
- **Task 5 — Writes [S after 1]:** quick-add (Area→sub-project, global→Inbox); optimistic check-off w/ rollback; stable idempotency key per write (X-Request-Id on REST). Everything else deep-links to Todoist.
- **Task 6 — Defer [S after 5]:** 3-way (Not today: drop `@today`; Tomorrow: dated→snooze +1 & clear `@today`, undated→clear `@today` + queue `retagTomorrow[]`; specific/recurring→deep-link). Cover overdue/undated edges.
- **Task 7 — Nightly Netlify Scheduled Function (`0 10 * * *` = 00:00 HST):** ordered & non-negotiable — (1) evaluate+record streak, (2) save brief/progress to State and/or Daily Log, (3) clear all `@today` + apply `retagTomorrow[]` (one batched Sync), (4) reset morning routine, (5) snapshot `plannedToday[]`, (6) stamp `lastRefreshDate`. Dashboard warns if `lastRefreshDate` ≠ today. Confirm Netlify plan supports Scheduled Functions + server secrets reach Todoist + Notion (§13.8).
- **Task 8 — Streak [S after 4+7]:** dashboard-composed, evaluated only in the nightly job; Win AND task-completed-today AND routine ≥80%; `streakGraceUntil` for cutover day; zero-routine-steps → skip condition 3 + warn; dashboard only displays stored value.
- **Task 9 — Offline queue [P]:** local capture queue, idempotent UUID flush to Inbox on reconnect (reuse existing `lsPush`/`flushPending` plumbing).
- **Task 10 — Refresh/sync plumbing [S]:** parallel on-load fetch (Todoist active + completed-today, Calendar, Notion); ~2–5 min poll + manual Sync; cached reads; stale indicator; missed-refresh banner; 429 backoff + Retry-After.

**Sequential spine:** 0 → 1 → 2 → **CP2** → (4 gate, **CP3**) → 3 → 5 → 6 → 7 → 8 → 10. **Parallel cluster:** 3a/3b/3c/3d, 9.

## Phase 5 verification (fresh subagent, evidence before claims)

Against live Todoist: every tile number; Progress denominator == `plannedToday[]`, bar never retreats, overrun renders; no appointment double-shows (allow-list); offline capture→reconnect→no dupes; migration re-run→no dupes; check-off rollback; all 3 defer paths incl. overdue/undated; deep-links open correct task; nightly job runs server-side + missed-refresh banner fires; streak holds only when all 3 inputs met, respects grace window, survives zero-routine-steps. Graded by a subagent, not the code that wrote it.

## Checkpoints

- **CP1 — done:** plan review + Notion cleanup go + Chris's manual checklist (handoff §B).
- **CP2:** after migration reconciliation, before cutover (Task 2 Step 21). **← this session stops here.**
- **CP3:** after the recurring-completion spike (Task 4), before flipping the streak live.
- **CP4:** Phase 4 code review + Phase 6 integration/deploy decision.

## Standing rules (do not relearn the hard way)

- Read files with the **Read tool** (offset/limit), not bash `cat` — the mount truncates ~44 KB. Use bash only for node/git/builds.
- Keep every `cc-build.js` input **< 40 KB** (the build aborts otherwise). Split into new `app.*.js` parts as needed.
- `liveLoad` gates by State id-arrays — **register every new entity id** in the right id-array via `saveState` or it vanishes on reload.
- State JSON is one Notion code block > 2 KB; the chunking proxy (`0936e8b`) splits rich_text ≤2000 chars — do not regress.
- One stable idempotency key per write; reuse on retry. For the MCP migration, idempotency = `[ccid:<hash>]` marker + `find-tasks` pre-check (Sync uuid unavailable via MCP).
- One timezone everywhere: Pacific/Honolulu (UTC−10, no DST). Compute HST day windows, convert to UTC for completed-by-completion-date queries.
