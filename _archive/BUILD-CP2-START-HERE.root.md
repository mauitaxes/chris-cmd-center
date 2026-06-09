# BUILD-CP2-START-HERE — resume the Todoist build (Task 0-wiring → 1 → 2 → CP2)

**Purpose:** Seed a **fresh Cowork session** to execute the heavy/live part of the Command Center × Todoist build. The plan is written and committed; Task 0's pure logic is done and tested. This session stops at **CP2** (migration reconciled, before cutover). Don't re-litigate design — it's settled in handoff v4 and the committed plan.

**Prepared:** 2026-06-08 · **Owner:** Chris · **Status:** Paused after Task 0 pure logic. Ready to resume the live work.

**Start command for the fresh session:**
> "Read BUILD-CP2-START-HERE.md, then resume the Todoist build on branch `feat/todoist-phase1`: do the Task 0 readState wiring, Task 1 (live Todoist structure), and Task 2 (migration + reconcile). Stop at CP2."

---

## 1. Where things stand (branch `feat/todoist-phase1`)

The build runs in an **isolated git worktree** so `main` (the deployed app) is never touched.
- Worktree path (bash): `/sessions/<session>/mnt/Command Center Artifact/.worktrees/todoist-phase1`
- Worktree path (Windows): `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact\.worktrees\todoist-phase1`
- If the worktree is gone in the new session, recreate it: `git worktree add .worktrees/todoist-phase1 feat/todoist-phase1` (the branch persists).

**Commits on the branch (on top of `main` HEAD `0936e8b`):**
- `5d805d7` — docs: the full Phase-1 implementation plan.
- `8a4a2cb` — feat(task0): D9 pure resolver helpers + TDD.

**Test baseline: 96/96 green** (`node --test` → cc-data.test.js 74 + notion-proxy.test.mjs 22). Run from the worktree root.

**The plan is the spec — read it first:**
`docs/superpowers/plans/2026-06-08-command-center-todoist-phase1.md` (committed). It has bite-sized, no-placeholder TDD steps for Task 0, 1, 2 and a roadmap for 3–10. Also keep `command-center-todoist-calendar-handoff-v4.md` (the *why*) handy.

**What's DONE (Task 0 pure logic, committed):** in `cc-data.js`, two exported helpers with tests in `cc-data.test.js`:
- `missingDbKeys(dbs, required)` → required keys absent/falsy.
- `mergeResolvedDatabases(databases, resolved)` → merge resolved ids without overwriting existing.

**What REMAINS to reach CP2:** (1) Task 0 readState **wiring** (browser code — see §4); (2) Task 1 live Todoist structure; (3) Task 2 migration + reconcile → **stop at CP2**.

---

## 2. ⚠️ Environment workflow — READ THIS, it will save you an hour

This mount is hostile in specific, now-understood ways. Follow these rules exactly:

1. **Edit existing source files via BASH ONLY — never the Read/Write/Edit tools on a file that already exists in the worktree.** The Windows-side Edit tool and the bash mount are **incoherent** for existing tracked files in the `.worktrees/` subdir: an Edit-tool write may not reach bash for many calls, then land late and **corrupt** a concurrent bash write (observed this session — a test file ended truncated mid-statement). Pick ONE channel; bash is the source of truth node/git read.
   - **Append:** `cat >> file <<'EOF' … EOF`.
   - **Insert / replace mid-file:** a tiny node script (`readFileSync` → string replace → `writeFileSync`). This overwrites **in place** (truncate, no unlink).
   - After every edit, **verify stability**: run the test 2–3× and confirm byte count + counts are identical (catches partial/racy reads).
2. **The mount denies `unlink`** by default → `rm`, `git checkout`, and `git commit`'s lock cleanup all fail with "Operation not permitted". **Fix already applied this session:** `mcp__cowork__allow_cowork_file_delete` was approved folder-wide, so `rm` works now. If a new session hits EPERM on `rm`/locks, call that tool again. With delete enabled, normal `git add` / `git commit` work — if a stale `*.lock` blocks a commit, just `rm` it (or sweep: `find .git -name '*.lock' -delete`).
3. **To restore a file to pristine** without the (unlink-using) `git checkout`: `git show HEAD:path > path` (in-place truncate-write).
4. **Reads:** large files (>~44 KB) truncate unpredictably in bash readers — use the **Read tool** for those. All current source files are small (cc-data.js ~10 KB, app.a/b ~25 KB) so bash reads are fine, but keep every `cc-build.js` input **< 40 KB** (the build aborts otherwise).
5. **Build:** `node cc-build.js` → `dist/index.html`. **Test:** `node --test`. Both from the worktree root.

---

## 3. Migration idempotency — design change from handoff §5 (already in the plan)

Handoff §5 specifies a Sync-API `item_add` with a client `uuid` for dedup. **The Cowork Todoist MCP `add-tasks` does NOT expose a `uuid`** and caps at **25 tasks/call** (not 100). So:
- Each migrated task gets a deterministic marker `[ccid:<hash8>]` in its description (`CCData.migrationIdKey(notionPageId)`, already specced in the plan/Task 2).
- Before adding, `find-tasks` (searchText `ccid:<hash8>`); **skip if it already exists** → re-runnable without duplicates through the MCP.

---

## 4. Task 0 readState wiring — the one remaining piece of Task 0 (do first)

Browser/integration code in `src/app.a.js` `readState()` — not unit-testable, so it's verified by build + live behavior. Full code is in the plan (Task 0, Step 9). In short:
- After merging `obj.databases` into `DBS`, compute `CCData.missingDbKeys(DBS, REQUIRED_DBS)` where `REQUIRED_DBS=["tasks","wins","routines","capture","focusSessions","dailyLog"]`.
- For each missing key, resolve by title under the 🤖 Claude Workspace parent page and write back via `saveState({databases: CCData.mergeResolvedDatabases(...)})`.
- **Live confirm before relying on it (plan Step 10):** fetch parent `27268b77-7a95-4cd0-a94c-82bb12188b9a` and confirm the exact child-DB **titles** + Daily Log id `5c892f50-2d01-4731-9b04-ed3ac02defcf`; set `DB_TITLES` to match exactly. Also confirm `searchIds` can do a workspace-scoped title search (or add a thin `searchWorkspace(title,n)` wrapper).
- Fail loud (visible banner via `setSync("config",…)`) on any still-unresolved required DB — never a silent empty panel.
- Then `node cc-build.js` (expect "built dist/index.html …"), and commit `cc-data.js`(unchanged) + `src/app.a.js` + `dist/index.html`.

---

## 5. Then Task 1 → Task 2 → CP2 (full steps in the plan)

- **Task 1 (plan §Task 1):** pure helpers `ccTodoistSpec()` + `buildTodoistStatePayload()` are specced test-first; then operationally create via Todoist MCP: parent **Command Center**, 7 area sub-projects (`Daily Routines, Focus & Work, Health & Sleep, Finances, Home & Space, Relationships, Claude Tasks`), 9 labels (`today, energy-low/med/high, 5m/15m/30m/1h/2h`). `find-projects`/`find-labels` first for idempotent restart. Persist returned IDs to State via `buildTodoistStatePayload` → `saveState`.
- **Task 2 (plan §Task 2):** pure transforms test-first (`migrationIdKey`, `notionTaskToTodoist`, `notionCaptureToTodoist`, `reconcileCounts`). **Export shape note:** build task objects from `CCData.parseProps(page)` including `notes`(=p.Notes) and `created`(=p["date:Created:start"]) — `normalizeTask` does NOT carry those. **Inspect live distinct `Energy` / `Time Estimate` select values** to finalize `energyLabelMap`/`timeLabelMap`. Freeze (Chris adds nothing), import idempotently (≤25/call, `[ccid]` pre-check), then **reconcile counts per Area + P1 + Inbox** and spot-check 5.
- **🛑 CP2:** present the reconciliation table + 5 spot-checks. **Do NOT cut the dashboard over to Todoist.** Notion stays as the rollback net. Await Chris's sign-off.

---

## 6. Connector + ID reference

- **Todoist MCP** `b9779bcc-3581-4f0e-bef4-401bb840378a` — `add-tasks` (≤25, no uuid), `find-tasks`, `add-projects`, `add-labels`, `find-projects`, `find-labels`, `user-info`. Account: Chris K. Simon, Pro, TZ Pacific/Honolulu (already set). App-runtime auth = `TODOIST_API_TOKEN` Netlify secret (separate from the MCP).
- **Notion MCP** `b47f7667-3cb0-4d8e-bbaf-fa1fca4c39c7` — can move/rename, **cannot delete**. Parent 🤖 Claude Workspace `27268b77-7a95-4cd0-a94c-82bb12188b9a`. State page `37478f3d-415b-814c-8c65-dd76b6ab9aa3`. DB ids: tasks `fb432308-59b9-4078-92db-a83c6279957d` · wins `f99a9128-9809-48b9-9cb6-870717bd5183` · routines `17f7f036-e24c-40ce-9d41-db5d8a66b618` · capture `35ba4e31-eca6-4ab7-8625-acc41d5341e8` · focusSessions `291cb585-746e-4195-a920-b0ac460fbbf6` · **dailyLog** `5c892f50-2d01-4731-9b04-ed3ac02defcf` (not yet in State databases map).
- **Google Calendar** connected (read-only). Allow-list IDs to come from Chris (Task 3, post-CP2).
- **Repo/deploy:** GitHub `mauitaxes/chris-cmd-center` (private) → Netlify auto-builds `main`. Chris pushes; the build branch is `feat/todoist-phase1` (do NOT merge to main before CP4).

---

## 7. Standing rules (also in the plan)

- One timezone everywhere: Pacific/Honolulu (UTC−10, no DST). HST day windows → UTC for completed-by-completion-date.
- `liveLoad` gates by State id-arrays — **register every new entity id** via `saveState` or it vanishes on reload.
- State JSON is one Notion code block > 2 KB; the chunking proxy (`0936e8b`) splits rich_text ≤2000 chars — don't regress.
- New Todoist browser logic (Task 3/5/6, post-CP2) goes in a new `src/app.c.js` (registered in `cc-build.js`) to stay under 40 KB/input.
- Superpowers chain continues: subagent-driven + TDD for code; the migration is a verified-by-reconciliation one-shot, not TDD.
