# Step 3 — COMPLETE overnight 2026-06-05. One action needed: `git push` FIRST THING

**Push BEFORE using the app.** State JSON is now 2012 chars; the OLD live build fails every state write (400) until the fixed proxy deploys. Post-push, anything queued meanwhile self-heals (additive replay).

## What was found
1. **Root cause (H-B):** stuck op was `{t:"state",updates:{taskIds:[…15]}}`. Notion caps one rich_text element at 2000 chars; the proxy wrote the State JSON code block as a single element → 2012 chars → 400 on every replay. Captured live: request + `content.length should be ≤ 2000, instead was 2012`.
2. **Duplicate-row cause:** `lsPush({t:"taskAdd",…,area})` vs `lsRemove({…no area})` — identity never matches (v1.4.0 regression) → every added task left a stale op that re-created the row on next boot.

## What was fixed (commit `0936e8b`, local — your push deploys it)
- Proxy: `chunkRichText()` splits code-block + rich_text writes into ≤2000-char segments (reads already join).
- app.a.js: op-identity fix; taskAdd replay now dedupes by title + registers id; live addTask now registers id too (it never did).
- cc-data.js: mergeState unions taskIds (stale snapshots can't drop ids); routineIds unchanged.
- Tests: 69 + 22 green (was 65 + 17). Build clean, dist committed, independently verified.

## Data repaired (verified live in your browser)
- Smoke task registered → State.taskIds now 15 ids; app shows it checked, pill clean, queue empty.
- Duplicate smoke row moved out of Tasks DB → "[DUPLICATE — safe to delete]…" under Claude Workspace — trash it when convenient.
- 3 older unregistered test rows remain in Tasks DB (invisible to app), delete at leisure: "Test Task through brain dump for Claude Review" ×2, "Testing Brain Dump -> Task path" ×1 dup.

## After push
Re-run the smoke flow on the new build (brain dump → promote → complete → hard reload → survives, pill clean) — or ask me and I'll run it.
