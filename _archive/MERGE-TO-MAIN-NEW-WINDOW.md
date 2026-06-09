# Command Center — MERGE TO MAIN (new window, START HERE)

**Written 2026-06-08, after a full go/no-go re-verification.** The Phase 2 build passed the redo
acceptance review against Chris's three bars (see §1). Your job in this window: run the **safe merge
of `feat/todoist-phase1` → `main`**, then smoke-test the deploy. Production (`main`) is still the
pre-Phase-2 build until you push — nothing has changed yet.

**Do the §2 pre-flight in PowerShell FIRST. Do not skip it — it is the thing that prevents the three
hiccups from last time.**

---

## 1. Why this is a GO (verified this session)

- **Tests/build:** `node --test` = **240 / 0**; `node cc-build.js` → `dist/index.html` **142,922 B**. Clean.
- **Bar 1 — Todoist is the primary interactive task list:** Notion "Today" card is `display:none`;
  `#task-sections` renders area-grouped Todoist tasks with live complete / priority ★ / 3-way defer /
  per-area quick-add; hero tiles read `app.todoistTiles`. A live add→p1→complete cycle ran clean
  against Chris's real Todoist. Notion render code is hidden, not deleted (rollback-safe).
- **Bar 2 — Calendar reads, read-only:** `calendar-proxy.js` whitelists only `list_events` /
  `list_calendars` (all else → 400). Live read returned today's real event.
- **Bar 3 — OAuth + env vars:** confirmed LIVE in the Netlify UI this session — `GOOGLE_CLIENT_ID`
  (all scopes), `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN` (both scoped Builds/Functions/Runtime,
  1 value / 1 context). The one thing that can ONLY be proven post-deploy is that the refresh token
  actually authenticates through the deployed function → that's the §4 smoke test.
- **Merge is conflict-free:** `0936e8b` is an ancestor of `df84a0e`. `origin/feat/todoist-phase1` =
  `df84a0e` (pushed), `origin/main` = `0936e8b`.
- **No collisions:** every file the merge adds/modifies (34 files) was checked against the untracked
  files in the primary worktree — **zero overlap**. The one historic collision
  (`docs/superpowers/plans/2026-06-08-command-center-todoist-phase1.md`) is already neutralized: the
  untracked copy is renamed `...phase1.PREMERGE.md`, so the merge's tracked copy lands cleanly.

---

## 2. Pre-flight — run in PowerShell, in this order (prevents all 3 prior hiccups)

```powershell
cd "D:\Claude and Cowork\Command Center Artifact\Command Center Artifact"

# (a) HICCUP #3 GUARD — confirm there is no REAL index.lock.
#     The bash/Linux mount shows a PHANTOM .git\index.lock that does NOT exist in Windows.
#     PowerShell is the only authoritative check. Only remove if it's real AND no git process is running.
Test-Path ".git\index.lock"      # expect False. If True and no git is running: Remove-Item ".git\index.lock" -Force

# (b) HICCUP #3 ROOT CAUSE — clean the working tree. The only tracked change is .gitignore
#     adding ".worktrees/" (a good change). Commit it so the tree is clean before the merge.
git diff -- .gitignore           # should show only: + .worktrees/
git add .gitignore
git commit -m "chore: ignore .worktrees/"

# (c) Confirm you are in the PRIMARY worktree on main (HICCUP #2 guard — see note below).
git rev-parse --abbrev-ref HEAD  # expect: main
git worktree list                # primary = this folder [main]; feat = .worktrees\todoist-phase1 [feat/todoist-phase1]
git status                       # working tree clean (untracked scratch .md files are fine; they don't collide)
```

> **HICCUP #2 — the structural fix:** run the merge **from this PRIMARY worktree**, which already has
> `main` checked out. NEVER `git checkout main` from inside `.worktrees\todoist-phase1` — in a
> multi-worktree repo a branch checked out elsewhere can't be checked out again, and last time that
> made the merge + push silent no-ops.
>
> **HICCUP #1:** don't depend on `scripts\cc-worktree-bootstrap.sh` (needs bash, not on PATH in
> PowerShell). You don't need it — run the git commands directly in PowerShell as below.

---

## 3. The merge + push (PowerShell, from the PRIMARY worktree)

```powershell
cd "D:\Claude and Cowork\Command Center Artifact\Command Center Artifact"
git pull                          # fast-forward main if origin moved (should be no-op)
git merge --no-ff feat/todoist-phase1 -m "Phase 2 cutover: interactive Todoist task lists + Calendar proxy"
git push origin main
```

Expect: a merge commit listing ~34 changed files; `git push` shows `0936e8b..<newhash>  main -> main`.
**That push is the cutover** — Netlify auto-rebuilds from `main`, reads the 3 Google creds, and lights
up the calendar.

Pre-merge sanity (optional, fast): `node --test` (240/0) and `node cc-build.js` (142,922 B).

---

## 4. Post-deploy smoke test — close the last box

After the Netlify build finishes:

1. **Calendar creds actually authenticate (the only unproven item):** load
   https://chris-cmd-center.netlify.app → the **Schedule · Today** card should show real
   `mauitaxes@gmail.com` events (or a clean "No appointments today"), NOT the dark/empty preview state.
   If it errors, check the `calendar-proxy` function log in Netlify — almost always a bad/expired
   `GOOGLE_REFRESH_TOKEN` (re-mint via OAuth Playground, see the old PHASE2 doc §4C).
2. **Todoist loop:** the dashboard task list adds / completes / sets priority / defers against your real
   Todoist.
3. **Scheduled `nightly-refresh`** shows a next run at **00:00 HST**.
4. `main` advanced on GitHub; Netlify deploy succeeded.

---

## 5. Rollback (if anything looks wrong post-deploy)

`main` cutover is a single merge commit. To revert: `git revert -m 1 <mergehash>` then `git push`, or
in Netlify "Publish deploy" on the previous good build (`0936e8b`). Notion DBs are untouched and the
Notion render code is only hidden, so a revert restores the prior UI immediately.

---

## 6. Known caveats (tracked, none block the cutover)

1. Calendar token scope is full `auth/calendar` but the proxy is read-only — fine; only matters if you
   later add write ops.
2. Dated-defer "Tomorrow" applies on the deployed proxy path (production) but not in Cowork preview —
   pre-existing from Task 6.
3. Progress gauge + streak are still nightly-job / Notion-derived (display-only, honest per Task 8). The
   daily loop is fully Todoist; repointing those is a later phase.

> **Mount caution:** the Linux/bash mount of `D:\` is stale/partial and shows a phantom `.git\index.lock`.
> Check lock state + `git status` in **PowerShell**, not bash. Use bash only for read-only
> `node`/`git log`/builds, and READ files with the editor (the mount truncates files ~44 KB).
