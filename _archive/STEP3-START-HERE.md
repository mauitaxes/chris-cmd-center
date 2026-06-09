# Command Center — Step 3: Diagnose stuck queue op + close the registerId gap (Handoff)

**Run this in a fresh session. Read this file first — it is self-contained.**
**Status when written (2026-06-05 ~17:15 HST):** Step 2 deployed and live; smoke test surfaced one real, reproducible defect. NO fixes applied yet — Chris said diagnose-then-fix next session.

## Where we are

- Step 2 silent-write hardening: ✅ pushed `c53003b..7bde615`, live on https://chris-cmd-center.netlify.app. Tests 65+17 green. Final review: READY TO PUSH (done).
- Manual smoke (Chris, normal browser): brain dump "test smoke through normal browser" → promoted to Claude Tasks → checked complete.

## Verified facts (do not re-derive; checked live in Notion 2026-06-06 ~02:51–03:10 UTC)

1. Capture row `37778f3d-415b-8146-9330-d9a31829a5fb`: Processed `__YES__` ✅
2. Tasks row `37778f3d-415b-81c5-b096-d629bb9db814`: Area "Claude Tasks", Done `__YES__`, Created 2026-06-05 ✅
3. State page (`37478f3d-415b-814c-8c65-dd76b6ab9aa3`) `taskIds` does **NOT** contain `37778f3d-415b-81c5-…`. Last entry is `37678f3d-415b-81fc-8251-cfab8c27db73` (14 ids). ❌ registration never landed. Chris confirmed visually in Notion too.
4. Pill after hard reload on the NEW build: `Live · 14 tasks · … · 1 queued` → `flushPending()` returned 1: **one pending op fails replay on every boot.** This persists across reloads.
5. Reload UX Chris observed: task rendered unchecked first (~cache render + applyLocal), then "became checked" ~3-4s later (post-liveLoad render). Interpretation unconfirmed — liveLoad gates by taskIds, so the final list should NOT contain the unregistered task; what he saw may be the task disappearing/moving in a way that read as "checked." Treat as a UI observation to re-verify, not a fact.

**Net defect:** a completed task exists in Notion but is invisible to the app (unregistered), and one queue op is permanently stuck (replay fails every flush). The new pill honesty is what exposed this — that part works.

## Step 1: Identify the stuck op (do this FIRST — it discriminates the hypotheses instantly)

Have Chris (or guide him) open DevTools on the live app and run:
```js
Object.keys(localStorage)               // find the app's queue key (lsGet/lsPush key — check src/app.a.js ~line 60 for the exact key name)
JSON.parse(localStorage.getItem("<key>")).pending
```
The `pending` array contents decide which hypothesis applies. Then press Sync with the Network tab open and watch the failing `notion-proxy` call: payload + response status/body = root cause.

## Hypotheses, ranked

**H-A (most likely): stuck `{t:"taskAdd",title:"test smoke through normal browser",…}` — promoteCapture partial-response edge.**
`src/app.a.js` ~line 277: success path runs `if(id){ … lsRemove({t:"taskAdd",…}); await saveState({taskIds:registerId(…)}) }` where `id` is parsed from the create response (`toObj(r).pages[0].id`). If the create SUCCEEDED but the response shape didn't parse → task exists in Notion (fact 2 ✓) but: no lsRemove (op stuck ✓), no registerId (fact 3 ✓), and execution continues to mark the capture Processed (fact 1 ✓). One failure explains all three facts. This is the exact "partial-response edge" the final reviewer flagged as pre-existing.
- Open question if H-A: why does the *replay* of taskAdd also fail every boot (pill stays "1 queued") instead of creating duplicates? Check the Network tab — possibly the same response-shape issue makes `call()` throw on an otherwise-successful create (look at `toObj`/`call` error paths), meaning the task may be getting DUPLICATED in Notion on each reload even though the op stays queued. **Check the Tasks DB for duplicate "test smoke through normal browser" rows early** — if duplicates exist, tell Chris and stop replay churn (clear that op) before iterating.

**H-B: stuck `{t:"state",updates:{taskIds:[…15 ids]}}` — registration saveState failed and its replay keeps failing.**
Would mean `writeStateNow` persistently fails for this payload (old_str mismatch in `update_content`? State-page md drift?). Less likely — other state writes (streak 14, lastCompleted/lastResetDate 2026-06-05, focusMinutesToday 50) landed today via the same mechanics. If `pending` shows a `state` op, capture the exact proxy request/response to see why.

## Fix scope (after diagnosis, plan-then-execute; keep YAGNI)

1. **Whichever op is stuck:** make its failure mode impossible or self-healing:
   - H-A: harden promoteCapture's success path — parse the create response defensively; if create succeeded but id can't be parsed, do NOT leave taskAdd queued for blind replay (and never re-create — consider replay-side dedupe by title+date or tmpid check before create).
   - H-B: fix writeStateNow / proxy update_content mismatch for the State page.
2. **Step 3 seed (already on the books, same area):** `flushPending`'s `taskAdd` replay (`src/app.a.js` ~line 209) creates the Notion page but never `registerId`s it into `state.taskIds` → replayed tasks vanish on reload (same class as the v1.4.0 addRoutine bug). Fix replay to register the new id (mirror the live addTask path).
3. **One-time data repair (manual, do with Chris's approval):** append `37778f3d-415b-81c5-b096-d629bb9db814` to State.taskIds (Notion MCP `notion-update-page`/update_content on the State page, or via the app once fixes land), and clear the stuck op from his browser queue (Sync after fix should drain it; otherwise DevTools `localStorage` edit). Delete any duplicate smoke tasks found.

## Non-negotiable mechanics (same as Step 2 — violating these has burned us)

- READ files with the Read tool at `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact\…`; NEVER read source via bash (stale mount — it served truncated app.b.js last session). Edit with Edit/Write tools; if the mount won't sync, write-through via bash python/heredoc with assert checks, then re-verify via Read.
- Bash ONLY for node/git/builds at `/sessions/<your-session>/mnt/Command Center Artifact/` (session mount name changes every session — check yours; last session was magical-cool-shannon).
- If git commits fail on orphan `.git/*.lock` files: use `allow_cowork_file_delete` then `rm`; plumbing (write-tree/commit-tree) as last resort.
- Build: `node cc-build.js` → `dist/index.html`; every input <40KB; after build, grep dist for a string added in the fix to detect stale mount.
- Tests: `node --test cc-data.test.js` (65 now; add tests for any new pure logic) and `node --test tests/notion-proxy.test.mjs` (17 — proxy untouched unless H-B diagnosis proves a proxy bug; if so STOP and ask Chris first).
- Commits local; **Chris pushes**. `NOTION_TOKEN` never in repo/client/chat/memory.
- Usage-aware: diagnosis first (cheap), checkpoint with Chris before writing the fix plan.

## Definition of done

1. Stuck op identified with evidence (queue contents + failing request/response captured).
2. Root cause fixed + tests green (65+ and 17) + build clean + dist committed; Chris pushes.
3. Data repaired: smoke task registered (visible in app after reload), queue drained (pill shows no "queued"), any duplicates removed.
4. Re-run the same smoke flow end-to-end: brain dump → promote → complete → hard reload → task survives, checked, pill clean.
5. Memory updated (`command-center-step2-audit.md` or successor) + MEMORY.md index line.

## Key ids (verified)

- State page: `37478f3d-415b-814c-8c65-dd76b6ab9aa3`
- Smoke task (Tasks DB): `37778f3d-415b-81c5-b096-d629bb9db814`
- Smoke capture: `37778f3d-415b-8146-9330-d9a31829a5fb`
- Tasks DB data source: `collection://fb432308-59b9-4078-92db-a83c6279957d`
- Capture DB data source: `collection://35ba4e31-eca6-4ab7-8625-acc41d5341e8`
- Repo: `mauitaxes/chris-cmd-center` (private), HEAD = `7bde615`, live at https://chris-cmd-center.netlify.app
