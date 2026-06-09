# Command Center — REVIEW BEFORE PUSH TO MAIN (START HERE, fresh window)

**Written 2026-06-08 ~22:00 HST.** Chris paused the Phase 2 cutover after three procedural
hiccups while pushing to `main` and asked for a fresh window to **review the project and clean up
anything necessary before pushing.** Your job: verify the branch is sound, clean up the worktree,
then execute a *safe* merge to `main` — only after Chris approves. **Do NOT push to `main` until the
review checklist below is complete and Chris says go.**

---

## 0. Reassurance first — nothing is broken

The repo is healthy. This was verified this session:

- `git fsck --connectivity-only` on the primary worktree reported **only dangling objects** (normal
  leftovers from an aborted autostash + earlier rebases) — **zero missing/broken objects, no corruption.**
- `main` is untouched at **`0936e8b`** (production still serving the pre-Phase-2 build).
- The Phase 2 work is **committed and pushed** on `feat/todoist-phase1` at **`df84a0e`**.
- Primary worktree `git status`: on `main`, up to date with `origin/main`, no merge in progress, no
  real lock. Only a modified `.gitignore` + some untracked scratch files.

Production was never at risk. The cutover simply hasn't happened yet.

---

## 1. Exact current state (verified)

- **Repo:** GitHub `mauitaxes/chris-cmd-center`. **Netlify** site `chris-cmd-center`
  (https://chris-cmd-center.netlify.app), auto-deploys from GitHub `main`.
- **Worktrees:**
  - Primary `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact` → branch **`main`** @ `0936e8b`.
  - `…\Command Center Artifact\.worktrees\todoist-phase1` → branch **`feat/todoist-phase1`** @ `df84a0e` (pushed to origin).
- **Phase 2 commit `df84a0e`:** "feat(phase2): interactive Todoist task lists (replace Notion) +
  Google Calendar proxy" — 11 files, +532 / −22. Closes the Task 11 acceptance-review NO-GO
  (Todoist was read-only beside an interactive Notion list).
- **Tests/build (run in PowerShell this session):** `node --test` = **240 pass / 0 fail** (node
  v22.22.0); `node cc-build.js` → `dist/index.html` **142,922 B**. Clean.
- **`main` does NOT yet contain `df84a0e`** (`merge-base --is-ancestor df84a0e main` = NO). Merge is
  conflict-free: `0936e8b` is an ancestor of `df84a0e`.
- **Netlify calendar env vars — DONE this session (all 3 present):**
  - `GOOGLE_CLIENT_ID` — all scopes, same value all contexts.
  - `GOOGLE_CLIENT_SECRET` — secret, scoped Builds/Functions/Runtime, **Production** context.
  - `GOOGLE_REFRESH_TOKEN` — secret, scoped Builds/Functions/Runtime, **Production** context.
  - Plus the pre-existing `NOTION_TOKEN`, `TODOIST_API_TOKEN`. (The calendar proxy reads these at
    runtime in the production function — Production scope is correct.)
- **Colliding untracked file already moved aside** in the primary worktree:
  `docs/superpowers/plans/2026-06-08-command-center-todoist-phase1.md`
  → renamed to `2026-06-08-command-center-todoist-phase1.PREMERGE.md`. The merge brings in the
  tracked copy of that same plan.

---

## 2. The three hiccups + root causes (so you don't repeat them)

1. **`bash: not recognized`** in PowerShell → `scripts/cc-worktree-bootstrap.sh` couldn't run from
   PS. Not fatal — the script only re-asserts worktree pointers and clears stale `*.lock` files. Run
   it from Git Bash if available, or skip it and manage locks manually in PowerShell.
2. **`git checkout main` → fatal: 'main' is already used by worktree …`** → In a multi-worktree repo
   you can't check out a branch that's already checked out elsewhere. The previous attempt ran the
   whole merge sequence while still on `feat/todoist-phase1` (so the merge/push were silent no-ops).
   **CORRECT approach: run the merge FROM the primary worktree, which already has `main` checked
   out. Never `git checkout main` from the feat worktree.**
3. **`index.lock: File exists` during merge** → `git merge` tried to **autostash** the dirty
   `.gitignore` (merge.autoStash appears enabled) and was blocked by a stale `index.lock`. Fix:
   delete `.git\index.lock` in the primary worktree (safe only when no git process is running), or
   avoid the autostash by getting the working tree clean first (see §3 cleanup).

**Mount caution:** the Linux/bash mount of `D:\` is stale/partial. It currently shows a phantom
`.git/index.lock` that PowerShell does not see. **Check lock state and git status in PowerShell, not
bash.** Use bash only for read-only `node`/`git log`/`fsck`/builds, and READ files with the Read tool
(the mount truncates files ~44 KB).

---

## 3. Review + cleanup checklist (do this BEFORE merging)

Run in the **feat worktree** unless noted. This is the "clean up anything necessary" Chris asked for.

- [ ] **Re-verify green:** `node --test` (expect 240/0) and `node cc-build.js` (expect 142,922 B).
- [ ] **Inspect the diff:** `git diff --name-only main..feat/todoist-phase1` (≈33 files). Confirm
      nothing unexpected. Spot-review the actual cutover code: `src/index.html` hides
      `#notion-today-card`; `src/app.c.js` interactive `#task-sections` + Today panel + `tdSetPriority`;
      `src/app.b.js` hero tiles from `app.todoistTiles`; `src/app.a.js` calendar-proxy route;
      `netlify/functions/todoist-proxy.js` priority on update-tasks; `netlify/functions/calendar-proxy.js`
      read-only (`list_events`/`list_calendars` only).
- [ ] **Re-run the collision check** (the PREMERGE rename cleared the one known collision — confirm no
      others): in the feat worktree,
      `comm -12 <(git diff --name-only main..feat/todoist-phase1 | sort) <(git -C <PRIMARY> ls-files --others --exclude-standard | sort)`
      → expect **no output**.
- [ ] **Decide on the primary worktree's untracked clutter** so future merges don't trip: `TASK3C-START-HERE.md`,
      `TASK4-SPIKE-RESULT.md`, `_archive/`, `command-center-todoist-PHASE1-PLAN.md`,
      `command-center-todoist-calendar-handoff-v4.md`, `docs/` (untracked copies),
      `*.PREMERGE.md`, any `COMMIT_MSG_*.txt` / `_*probe*` files. Recommend: add to `.gitignore` or move to
      `_archive/`. Get Chris's nod before deleting anything.
- [ ] **Resolve the modified `.gitignore`** in primary: review the change; either commit it on `main`
      first, or `git checkout -- .gitignore` to drop it. Getting the working tree clean here removes the
      autostash that caused hiccup #3.
- [ ] **Confirm no real `.git\index.lock`** in primary (PowerShell): `Test-Path ".git\index.lock"`.
      If `True` and no git process is running, `Remove-Item ".git\index.lock" -Force`.
- [ ] **Re-confirm the 3 Netlify calendar vars** are still present (they were added this session).

---

## 4. Safe cutover (ONLY after §3 + Chris approval)

Run in the **PRIMARY** repo folder (the outer one, NOT `.worktrees`):

```powershell
cd "D:\Claude and Cowork\Command Center Artifact\Command Center Artifact"
# working tree should be clean now (see §3); no index.lock
git pull
git merge --no-ff feat/todoist-phase1 -m "Phase 2 cutover: interactive Todoist task lists + Calendar proxy"
git push origin main
```

Expect: `git merge` writes a merge commit listing ~33 changed files; `git push origin main` shows
`0936e8b..<newhash>  main -> main`. **That push is the cutover** — it triggers the Netlify rebuild
that reads the 3 creds and lights up the calendar.

**Verify after push:** `main` advanced on GitHub; Netlify deploy succeeds; the scheduled
`nightly-refresh` function shows a next run at **00:00 HST**; load the site → **Schedule · Today**
card shows real `mauitaxes@gmail.com` events (or a clean "No appointments today").

---

## 5. Known caveats (tracked, none block the cutover)

1. **Calendar token scope is FULL `auth/calendar` (read/write)**, but the proxy is **read-only**
   (`list_events`/`list_calendars` only). Fine as-is; only matters if you later want to *write*
   calendar events.
2. **Dated-defer "Tomorrow"** applies on the deployed proxy path (production) but not in Cowork
   preview (MCP wants `dueString`, client sends `due_date`). Pre-existing from Task 6.
3. **Progress gauge + streak** are still nightly-job / Notion-derived (display-only, honest per Task
   8). The daily loop is fully Todoist; repointing progress/streak is a later phase.

---

## 6. References

- Plan: `docs/superpowers/plans/2026-06-08-command-center-todoist-phase1.md` (tracked on `feat` @
  `df84a0e`; the renamed `*.PREMERGE.md` is the old untracked copy).
- Prior handoffs in the feat worktree: `PHASE2-CUTOVER-START-HERE.md`, `PHASE1-CUTOVER-START-HERE.md`.
- Memory: `command-center-todoist-handoff-v4.md` (updated this session to reflect `df84a0e` pushed,
  calendar vars set, cutover pending review).
- Deadline context: the original target was to merge before midnight HST so the first `nightly-refresh`
  ran against the new `main`. Chris chose review over racing the clock. If the merge lands after
  00:00 HST, the first nightly ran against old `main` — harmless, just note it.
