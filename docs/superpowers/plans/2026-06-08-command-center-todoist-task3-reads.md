# Task 3 — Todoist (+Calendar) Reads — bite-sized TDD block

> Resumes the Phase-1 plan after **CP3** (recurring-completion spike PASSED, commit `f63654e`). Sequencing: **Foundation (split + proxy) → 3a tiles → 3b Today → 3d Inbox → 3c Schedule → 3e Progress(stub)**. Keep the superpowers TDD discipline: pure logic in `cc-data.js` test-first; DOM/fetch wiring verified by build + live. Baseline at start: **109/109 green**, branch `feat/todoist-phase1`.

## Grounding (confirmed live + in source, 2026-06-08)

**Active-task read shape** (`find-tasks` / will be emulated by the proxy):
```json
{ "id":"6gqCXQ3qG6vRFVhW", "content":"McCleary Estate Return (Husband)",
  "description":"[created 2026-05-30] Need to inform Donna… [ccid:1739c150]",
  "dueDate":"2026-10-05",          // ABSENT when no due date
  "recurring":false, "priority":"p1",   // p1 highest … p4 default
  "projectId":"6gqCVgmmffVVc4HW", "labels":[], "checked":false }
```
**Dispatcher** (`src/app.a.js`): `call(name,args)` → browser: `fetch(PROXY_URL,…)`; Cowork: `window.cowork.callMcpTool`. `T` = Notion tool-name→endpoint map; `DBS`, `AREAS` (7). `readState()` merges `obj.databases`→`DBS` and (D9) resolves missing ids; `liveLoad()` reads by State id-arrays; `saveState()` chunk-writes State.
**Render** (`src/app.b.js`): operates on `app.tasks` (normalized model `{id,title,area,priority,done,due,…}`), `CCData.groupTasksByArea(app.tasks,AREAS)`, `taskRowHtml`, tile text in `renderTasks`/`renderTopStats`/`renderTaskSections`. **So if Todoist tasks are normalized into the SAME `app.tasks` shape, the existing render mostly works** — minimizing UI churn.
**Proxy pattern** (`netlify/functions/notion-proxy.js`, `"type":"module"`): server-side token; exported pure helpers; `dispatch({name,args,fetchImpl})`+`handler`; emulates MCP output shapes; `chunkRichText`. Tests in `tests/notion-proxy.test.mjs` inject `fetchImpl` (no live token). **Mirror this exactly.**
**Todoist IDs** (State `todoistProjects`): parent `6gqCVX96r99qp3Vq`; areas — Daily Routines `6gqCVgp6xQ44R2V3`, Focus & Work `6gqCVgmmffVVc4HW`, Health & Sleep `6gqCVgmmg96jc96q`, Finances `6gqCVgwCWhQvhrvQ`, Home & Space `6gqCVgmcWrQfFr2H`, Relationships `6gqCVgmFXX6gJhjJ`, Claude Tasks `6gqCVgmP6rq8wv7G`. Labels in `todoistLabels`.

## ⛔ Chris-input gates (do not guess)
- **G1 — `TODOIST_API_TOKEN` in Netlify env.** Needed for deployed-browser reads AND any live end-to-end verification. Build + unit tests do NOT need it (injected fetch). **Until set: build to fixtures; defer live-verify.**
- **G2 — Google Calendar allow-list (3c).** Which calendar IDs surface on the Schedule lane. Enumerate via `list_calendars` at execution and have Chris pick (multiSelect). Read-only.
- **G3 — Today-panel overdue threshold (3b).** Default **5** (collapse overdue when >5). Chris may tune.

---

## Foundation A — `src/app.c.js` split (precondition; mechanical)
**Files:** new `src/app.c.js`; modify `cc-build.js`.
- [ ] Step 1: Create `src/app.c.js` with the same IIFE wrapper convention as app.a/app.b (shares the closure via concatenation — confirm a/b are concatenated inside one IIFE in build order). New Todoist browser logic lands here.
- [ ] Step 2: In `cc-build.js`, add `"src/app.c.js"` to the size-guard array AND to the `app` concatenation (after app.b.js), preserving order. Keep each input <40KB.
- [ ] Step 3: `node cc-build.js` → built clean; `node --test` → 109/109 (no logic yet). Commit `feat(task3): app.c.js split + cc-build registration`.

## Foundation B — `netlify/functions/todoist-proxy.js` (testable, token server-side)
**Files:** new `netlify/functions/todoist-proxy.js`; new `tests/todoist-proxy.test.mjs`; modify `src/app.a.js` (`call()` routing + a `TT` Todoist tool map + `TODOIST_PROXY_URL`).
- REST base `https://api.todoist.com/api/v1` (active tasks, complete, quick-add). **Activity log** (completed events incl. recurring — the CP3 source) is the **Sync** endpoint `POST /sync/v9/activity/get` (or v1 equivalent) — Pro-gated; build the proxy to support it for Task 7/8 even though Task 3 reads only need active tasks.
- [ ] Step 1 (test-first): `tests/todoist-proxy.test.mjs` — `dispatch({name:"todoist-find-tasks",args:{projectId},fetchImpl})` returns the emulated MCP shape from a stubbed REST payload; asserts Bearer auth header + URL built from args. Also a `todoist-find-activity` case returning the `{eventType,parentProjectId,eventDate,extraData}` shape.
- [ ] Step 2: Implement pure helpers (`buildTaskQuery`, `normalizeRestTask`→MCP shape, `authHeaders`) + `dispatch` switch + `handler` reading `process.env.TODOIST_API_TOKEN`. Mirror notion-proxy structure.
- [ ] Step 3: Wire `call()` in app.a.js: route `todoist-*` names → `TODOIST_PROXY_URL` in browser, `callMcpTool` in Cowork. Add `TT={findTasks:"todoist-find-tasks",findActivity:"todoist-find-activity",complete:"todoist-complete-tasks",quickAdd:"todoist-add-tasks",…}`.
- [ ] Step 4: `node --test` green; build clean. Commit `feat(task3): testable Todoist proxy + call() routing`.

## 3a — Task tiles [pure, TDD]
**Files:** `cc-data.js` (+`normalizeTodoistTask`, `todoistTileCounts`), `cc-data.test.js`; wire in app.c.js + renderTopStats.
- [ ] Test `normalizeTodoistTask(raw, areaByProjectId)` → `{id,title,area,priority:(raw.priority==="p1"),done:false,due:raw.dueDate||"",labels:raw.labels||[],notes:<description with [ccid]/[created] markers stripped>}` (same model `app.tasks` uses so render + `groupTasksByArea` work unchanged).
- [ ] Test `todoistTileCounts(tasks)` → `{open, p1, areasActive, byArea:{area:count}}`.
- [ ] Implement, export, green. Wire app.c.js `loadTodoistTasks()` → `call(TT.findTasks,…)` per area (or one call + group) → `app.tasks = raw.map(normalizeTodoistTask)` → `renderAll()`. Build, commit.

## 3b — Today panel [pure + wiring]
- Saved Todoist filter scoped to the CC tree: `(@today | today | overdue)` AND under Command Center. Confirm filter syntax via `find-tasks {filter}` live; prefer a saved filter (`add-filters`) referenced by name for stability.
- [ ] Pure `splitTodayPanel(tasks, {threshold:5})` → `{today:[…], overdueCount, overdueCollapsed:overdueCount>threshold}`. TDD. Wire a Today card in app.c.js. Threshold = **G3**.

## 3d — Inbox chip [wiring]
- [ ] `call(TT.findTasks,{projectId:"inbox"})` count → small triage chip; click deep-links to Todoist Inbox. (Note: Inbox holds 1 pre-existing non-ccid task + future captures.)

## 3c — Schedule lane (Google Calendar, read-only) [wiring; **G2**] — DONE (commit `dc904e4`)
- [x] Enumerate `list_calendars`; allow-list decided = `["mauitaxes@gmail.com"]` (primary only; Holidays declined). Persisted to State `calendarAllowList[]`, read back on boot, not re-prompted.
- [x] `list_events` (today, HST window via `hstDayUtcWindow`) per allowed calendar → normalize `{start,end,title,allDay,calendarId,htmlLink}` (all-day uses `start.date`, timed uses `start.dateTime`; `status:"cancelled"` filtered) → `CCData.mergeCalendarEvents(eventsArrays)` (pure, TDD'd, 8 tests: time-ordered, de-duped across calendars, all-day-first, unparseable-last). Read-only "Schedule · Today" card; appointments NOT deferrable — row shows time + "open in calendar" (`htmlLink`). 135/135 green; build clean.
- **Scope decision (2026-06-08, Chris):** ship **MCP-only**. Lane populates via the Google Calendar MCP in Cowork; deployed Netlify site shows a graceful empty state (no calendar proxy yet). The deployed path is tracked as **Task 3c-proxy (deferred)** in the phase-1 plan roadmap — build `netlify/functions/calendar-proxy.js` (Google OAuth, injectable-`fetchImpl`, mirror todoist-proxy) when the deployed calendar lane is wanted.

## 3e — Today's Progress [stub until Task 7]
- Numerator = `completedInTreeOnDay(activityEvents, areaIds, since, until)` (already built, CP3). Denominator = frozen `plannedToday[]` snapshot — **owned by Task 7 nightly job**. Until then: stub denominator (e.g., current open+done count) behind a `progressDenominatorReady` flag; bar may exceed 100% by design; never retreats. Mark blocked-on-7.

## Verification (fresh subagent, after G1 set)
Against live Todoist: every tile number matches Todoist; Today panel respects threshold + overdue collapse; Inbox count correct; no calendar double-show within the allow-list; deep-links open the right task; reads work in BOTH deployed-browser (proxy) and Cowork (MCP) paths. Progress numerator uses `find-activity` (NOT `find-completed-tasks`, per CP3). Do not claim done without live evidence.

## Gating
- This block does **not** cut the dashboard over by itself — it adds read panels alongside the existing Notion-backed ones. Cutover (removing Notion task reads) stays gated to a later checkpoint with Chris.
- Writes (Task 5), Defer (Task 6), Nightly job (Task 7), Streak (Task 8) remain after this. Branch stays unpushed/unmerged until CP4.
