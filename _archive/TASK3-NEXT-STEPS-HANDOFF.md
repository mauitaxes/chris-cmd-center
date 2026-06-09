# Task 3 — Next-Steps Handoff (resume in a clean window)

**Prepared:** 2026-06-08 eve · **Branch:** `feat/todoist-phase1` (HEAD `b5dacb4`, **pushed to origin**) · **Tests:** 120/120 green · **Build:** clean · **Production `main` / live site: UNTOUCHED, nothing merged.**

_Supersedes `TASK3-DEPLOY-SMOKE-HANDOFF.md` — that checkpoint is now cleared._

---

## 1. TL;DR — where we are

The **deploy-smoke passed.** The deployed Todoist proxy reads your live tasks through the Netlify function. That was the one thing that could *only* be verified on Netlify, and it's done.

Along the way the smoke caught and fixed a real bug: **Todoist retired the old REST v2 API** (returned `410 Gone`). The proxy now calls the unified `api/v1` endpoint. That fix is committed (`b5dacb4`) and pushed.

We **paused before building the visible panels.** Nothing is rendered to the dashboard yet, and the dashboard still reads Notion for tasks (no cutover).

---

## 2. What the smoke proved (so you can trust the foundation)

- Live `find-tasks` through the deployed proxy returned **21 active tasks** over `api/v1` (the 410 is gone).
- The 7 Command Center tasks filtered out to exactly the documented result:
  `{ open: 7, p1: 4, areasActive: 2, byArea: { "Focus & Work": 5, "Claude Tasks": 2 } }`
  - Focus & Work (5): McCleary `p1`, Awa Lucero `p1`, Scott Kenar `p1`, HanaHou `p1`, Shaina Kalama `p4`
  - Claude Tasks (2): Research MAGS `p4`, Bookkeeping Enrichment `p4`
- The other 14 tasks are Todoist's "Getting Started" onboarding items + your pre-existing Inbox note — correctly ignored by the tile filtering.

---

## 3. What's already built on the branch (foundation, not yet visible)

- `b5dacb4` — **the fix:** `REST_BASE` → `https://api.todoist.com/api/v1`; test updated to the paginated `{results:[…]}` mock. (find-tasks / find-projects.)
- `78c902a` — 3a transforms: `normalizeTodoistTask`, `todoistTileCounts`, `loadTodoistTiles()` (non-destructive; fills `app.todoistTasks`/`Tiles`, does **not** touch Notion `app.tasks`). Smoke hook `window.__ccLoadTodoist`.
- `5bcce70` — `todoist-proxy.js` serverless function (mirrors notion-proxy: `dispatch({name,args,fetchImpl})` + handler, `TODOIST_API_TOKEN` server-side).
- `20b33b3` — `app.c.js` code-split (build order a→c→b; every `cc-build.js` input <40 KB).
- Earlier: Task 0 (DB-id resolution), Task 1 (live Todoist structure), Task 2 (7 tasks migrated), Task 4/CP3 (recurring-completion spike).

---

## 4. What remains in Task 3 (the next build session)

1. **3b — Today panel.** Render the open/p1 tiles into the dashboard. Overdue threshold default = 5.
2. **3d — Inbox chip.** Surface count of un-triaged Inbox tasks.
3. **3c — Schedule / Calendar lane.** Read-only Google Calendar appointments alongside tasks.
   - **⛔ Needs one thing from Chris first:** which Google Calendars to show. The assistant will enumerate them via `list_calendars` and Chris picks the allow-list.
4. **DOM wiring** — connect 3b/3d/3c panels into the actual dashboard layout.
5. **3e — Today's Progress.** Numerator comes from `find-activity` (per CP3 finding), denominator stays **stubbed until Task 7** (the nightly job). Leave 3e as a stub for now.

---

## 5. Hard gates (do not cross without Chris)

- **No merge to `main` before CP4.** Previews only.
- **Streak stays OFF** until Tasks 7 + 8.
- **No cutover:** the dashboard keeps reading Notion for tasks until we deliberately switch with Chris.

---

## 6. Known follow-up (not blocking Task 3)

`find-activity` still targets the retired **Sync v9** API (`/sync/v9/activity/get`). It isn't exercised by anything visible yet and is gated to **Task 7**. It needs its own migration to the unified `api/v1` `/activities` endpoint (different path + response shape — verify before changing). Flagged, not fixed.

---

## 7. Environment notes for the assistant (read before any git/file op)

- **Worktree git pointers go stale across sessions.** The worktree lives at `.worktrees/todoist-phase1`. On resume, rewrite both pointers to the *current* session mount before any git command:
  - `.worktrees/todoist-phase1/.git` → `gitdir: <current-mount>/Command Center Artifact/.git/worktrees/todoist-phase1`
  - `.git/worktrees/todoist-phase1/gitdir` → `<current-mount>/.worktrees/todoist-phase1/.git`
- **Edit existing tracked files in the worktree via bash only** (Read tool for reads). The Edit/Write tools and bash are incoherent for existing files under `.worktrees/`. Keep every `cc-build.js` input <40 KB.
- Verify with `node --test` (expect 120/120) + `node cc-build.js` from the worktree root.
- **The sandbox cannot push** (GitHub 403, no creds). Pushing is Chris's action — and note `git push` only works if he targets the branch: `git push origin feat/todoist-phase1` (a plain `git push` from `main` is a no-op).
- `index.lock` / `unlink` "Operation not permitted" warnings on commit are a mount quirk; the commit still lands — verify with `git log` / `git cat-file -t`.

---

## 8. Resume prompt for the clean window

> "Read TASK3-NEXT-STEPS-HANDOFF.md and continue the Command Center Todoist build on branch `feat/todoist-phase1`. Deploy-smoke already passed. Build 3b (Today panel) and 3d (Inbox chip) next, then we'll do 3c (Calendar lane) — list my Google Calendars so I can pick which ones show. No merge to main."
