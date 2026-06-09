# BUILD-START-HERE — Command Center × Todoist × Calendar

**Purpose:** Seed a **fresh Cowork session** to execute the build via the superpowers chain. Phase 0 (preconditions) is **complete and verified**. This doc is standalone — read it + the full plan, then start at the superpowers chain. Don't re-litigate the design; it's settled in handoff v4.

**Prepared:** 2026-06-08 · **Owner:** Chris · **Status:** Ready to build. All preconditions GREEN.

**Read these two files (same folder) before starting:**
1. `command-center-todoist-PHASE1-PLAN.md` — the executable, checkpointed task plan (the real build spec).
2. The original design handoff v4 (`command-center-todoist-calendar-handoff-v4.md.docx`) — the *why* behind every decision (D1–D11, §1–§13).

---

## 1. TL;DR — where things stand

The Command Center is a deployed vanilla-JS dashboard on Netlify (`chris-cmd-center.netlify.app`), backed by Notion. This project replaces the **Notion task list with Todoist** (read+write: add/complete/defer only) and adds a **read-only Google Calendar** appointments lane. Notion keeps Wins/Routines/Focus/Daily Log/State + the dashboard-composed streak. Heavy task management deep-links to Todoist.

Phase 0 is done. Nothing in the live app or backend has been changed except: the hotfix is deployed, and two dead Notion objects were renamed/flagged for deletion. The build has **not** started.

---

## 2. Preconditions — ALL VERIFIED GREEN (2026-06-08)

| # | Precondition | Status |
|---|---|---|
| 1 | Hotfix `0936e8b` (rich_text chunking) deployed + live | ✅ Verified — State took a >2KB write today; app serves v1.5.0 |
| 2 | Notion schema matches handoff §3 | ✅ Verified — all 5 mapped DB IDs exact |
| 3 | Todoist connector authorized | ✅ Live — Chris K. Simon, **Todoist Pro**, project space fresh (Inbox + default only) |
| 4 | Todoist account TZ = Pacific/Honolulu | ✅ Already set (confirmed via user-info) |
| 5 | `TODOIST_API_TOKEN` in Netlify env (app runtime) | ✅ Set as a **secret** value |
| 6 | Google Calendar (read) + Notion connectors | ✅ Connected |
| 7 | Notion cleanup (stray DB + dup page) | ✅ Flagged + D9-safe (permanent delete = Chris's manual 2-click; not blocking) |

**No remaining blockers to start.** Two inputs are still needed from Chris *during* the build, not before it (see §6).

---

## 3. Connector + ID reference card

**Todoist** — MCP server uuid `b9779bcc-3581-4f0e-bef4-401bb840378a` (tools: `add-tasks`, `complete-tasks`, `find-tasks`, `add-projects`, `add-labels`, `find-projects`, `user-info`, etc.). Scope: data read+write. Account: userId `59362469`, mauitaxes@gmail.com, Pro. App-runtime auth = `TODOIST_API_TOKEN` Netlify secret (separate from the MCP).

**Notion** — MCP uuid `b47f7667-3cb0-4d8e-bbaf-fa1fca4c39c7`. ⚠️ This connector can move/rename but **cannot archive/trash/delete**.
- Parent page 🤖 Claude Workspace: `27268b77-7a95-4cd0-a94c-82bb12188b9a`
- ⚙️ Command Center State page: `37478f3d-415b-814c-8c65-dd76b6ab9aa3` (single JSON code block — "Do not edit by hand")
- State `databases` map (runtime source of truth, D9): tasks `fb432308-59b9-4078-92db-a83c6279957d` · wins `f99a9128-9809-48b9-9cb6-870717bd5183` · routines `17f7f036-e24c-40ce-9d41-db5d8a66b618` · capture `35ba4e31-eca6-4ab7-8625-acc41d5341e8` · focusSessions `291cb585-746e-4195-a920-b0ac460fbbf6`
- **Daily Log** `5c892f50-2d01-4731-9b04-ed3ac02defcf` — exists under parent but **NOT in the databases map** → Build Task 0b registers it.
- Flagged for deletion (ignore): `[OLD — SAFE TO DELETE] Routine` DB `28aa34d3-…`; `[DUPLICATE — safe to delete]` page `37778f3d-…-81c3`. (Valid smoke task = `37778f3d-…-81c5`, different id.)

**Google Calendar** — connected (read-only). Allow-list of calendar IDs to come from Chris (D6a).

**Repo / deploy** — GitHub `mauitaxes/chris-cmd-center` (private), Netlify auto-builds `main` → `chris-cmd-center.netlify.app`. Build = `cc-build.js` bundling split inputs (`app.a.js`, `cc-data.js`, …) into `dist/`.

---

## 4. First moves in the fresh session (superpowers chain)

Brainstorming is done (handoff v4 is its output). Start at planning:

1. **Load `superpowers:using-superpowers`** first so the session can discover/invoke the rest of the chain.
2. **`superpowers:writing-plans`** — adopt `command-center-todoist-PHASE1-PLAN.md` as the base; inspect the repo to confirm the **actual stack + test runner** (don't impose a new framework — the app has a node test suite, ~69+22 tests). Convert the plan into the session's executable checklist. **Wire D9 runtime ID resolution as build task #1.**
3. **`superpowers:using-git-worktrees`** — isolated worktree so the build never disturbs the deployed app.
4. **`superpowers:subagent-driven-development` + `superpowers:test-driven-development`** — build feature-by-feature, test-first, in the plan's order. Parallelize the independent read units; run the sequential spine in order.
5. **`superpowers:requesting-code-review` → `receiving-code-review`** at feature-complete.
6. **`superpowers:verification-before-completion`** — evidence-based, graded by a fresh subagent.
7. **`superpowers:finishing-a-development-branch`** — integrate/deploy decision.

Drop into **`superpowers:systematic-debugging`** on any unexpected behavior.

---

## 5. Build task order (condensed — full detail in the plan, §D)

`Task 0` D9 ID resolution (+ 0b register Daily Log; 0c Notion delete is optional/Chris) → `Task 1` Todoist structure (parent + 7 Area sub-projects + label set, store IDs in State) → `Task 2` **migration** (one-shot idempotent Sync import, reconcile counts) → `Task 4` **recurring-completion spike** → `Task 3` reads (tiles, Today panel, Schedule, Inbox chip, Today's Progress §6) → `Task 5` writes → `Task 6` defer (3-way) → `Task 7` nightly Netlify Scheduled Function (`0 10 * * *` = 00:00 HST) → `Task 8` streak (composed in nightly job) → `Task 9` offline queue → `Task 10` refresh/sync plumbing.

Parallelizable: 3a/3b/3c/3d + 9. Sequential spine: 0→1→2→(4 gate)→5→6→7→8→10.

---

## 6. Checkpoints + inputs still needed from Chris

**Stop for Chris at:**
- **CP2** — after migration reconciliation, **before cutover** (no irreversible live-data change without sign-off).
- **CP3** — after the recurring-completion spike, **before flipping the streak live**.
- **CP4** — code review + final integrate/deploy decision.

**Inputs needed during the build (not blocking start):**
- **Google Calendar allow-list IDs** (D6a) — which human calendars to display.
- **D3 thresholds** — overdue auto-collapse count (suggest 5) + weekly-review cadence.
- Confirm the **brief/progress feature** still renders in the running app before wiring nightly step 2 (§7).
- Confirm **Netlify plan supports Scheduled Functions** on this site + server-side secrets reach Todoist + Notion.

---

## 7. Standing rules / gotchas (from prior build sessions — DO NOT relearn the hard way)

- **bash mount is stale/partial.** Read files with the **Read tool** (offset/limit), not bash `cat`. Use bash only for node/git/builds. Keep every `cc-build.js` input **< 40 KB** so truncation can't corrupt reads/commits.
- **liveLoad gates by State id-arrays.** Tasks/routines/etc. are gated by id-lists on the State page. Any **new entity must be registered** in the right id-array (via `saveState`) or it vanishes on reload. (This is the class of bug behind the v1.4.0 addRoutine and the Step 3 duplicate-task issues.)
- **State JSON is one Notion code block, >2KB.** Every state write rewrites the whole block; the deployed chunking proxy (`0936e8b`) splits rich_text into ≤2000-char segments. Don't regress this.
- **Idempotency (D7-API):** one stable UUID per write (Sync command `uuid` / REST `X-Request-Id`), reused on retry. `temp_id` is intra-batch refs only, not a dedup key.
- **One timezone everywhere:** Pacific/Honolulu, no DST. Compute HST day windows, convert to UTC for Todoist completed-by-completion-date queries.

---

## 8. Key files
- `command-center-todoist-PHASE1-PLAN.md` — the build plan (this folder).
- `command-center-todoist-calendar-handoff-v4.md.docx` — design rationale (uploaded with the planning session; re-attach if not present).
- Memory index (auto-loads): `command-center-todoist-handoff-v4`, `command-center-step3-fix`, `command-center-backend`, `command-center-liveload-idlists`, `command-center-bash-mount-staleness`, `command-center-v150`.

**Start command for the fresh session:** "Read BUILD-START-HERE.md and command-center-todoist-PHASE1-PLAN.md, then begin the build via the superpowers chain starting at writing-plans. Stop at CP2."
