# Task 3c — Schedule / Calendar lane — START HERE (clean window)

**STATUS: 3c COMPLETE** (commit `dc904e4`, 2026-06-08). · **Branch:** `feat/todoist-phase1` · **Tests:** 135/135 green · **Build:** clean (106,579 B) · **Production `main` / live site: UNTOUCHED, nothing merged, branch NOT pushed.**

_This doc is kept as the 3c record. Scope was decided MCP-only; the deferred deployed-path work is tracked as **Task 3c-proxy** in `docs/superpowers/plans/2026-06-08-command-center-todoist-phase1.md`._

_Supersedes `TASK3-NEXT-STEPS-HANDOFF.md` and `TASK3-DEPLOY-SMOKE-HANDOFF.md` (both archived under `_archive/`). Master spec for the whole rebuild is still `command-center-todoist-calendar-handoff-v4.md` at this folder root._

---

## 1. TL;DR — where we are

The Todoist read foundation + the two task panels are **built and committed** on `feat/todoist-phase1`:

- **3a tiles** — verified live ({open:7, p1:4, Focus & Work:5, Claude Tasks:2}).
- **3b Today panel** — `CCData.splitTodayPanel()` + a read-only "Today · Todoist" card.
- **3d Inbox chip** — un-triaged Inbox count, deep-links to Todoist.

All of it is **read-only and non-cutover**: it fills `app.todoistTasks / todoistTiles / todoistPanel / todoistInbox` and leaves the Notion-backed `app.tasks` and its render path untouched. `loadTodoist()` is fired non-blocking from `boot()`'s live-success path.

**3c is the next build: a read-only Google Calendar "Schedule" lane** showing today's appointments alongside the tasks.

---

## 2. The one input 3c needed is decided ✅

Chris has **2** Google Calendars. He picked, for the Schedule lane:

- ✅ **`mauitaxes@gmail.com`** (primary; TZ `Pacific/Honolulu`) — **the only one to show.**
- ❌ Declined: "Holidays in United States" (`en.usa#holiday@group.v.calendar.google.com`).

→ Persist the allow-list to State as `calendarAllowList: ["mauitaxes@gmail.com"]`. Do **not** re-prompt; just confirm the calendar still exists via `list_calendars` and build.

Google Calendar MCP uuid = `a8aed00c-e9c0-4e6d-8e3a-64452207f54f` (tools: `list_calendars`, `list_events`, `get_event`, …). Read-only — no create/update/delete on the lane.

---

## 3. 3c spec (from the TDD plan, `docs/superpowers/plans/2026-06-08-command-center-todoist-task3-reads.md`)

1. **Persist allow-list.** Write `calendarAllowList` into State (same `saveState({...})` path the app already uses). Read it back on boot.
2. **Pure, test-first:** `CCData.mergeCalendarEvents(eventsArrays)` → merged, **time-ordered, de-duped** list (no double-show when an event appears in two calendars). TDD in `cc-data.test.js` first, mirroring the `splitTodayPanel` tests.
3. **Fetch (wiring):** for each allowed calendar id, `list_events` over **today's HST window** (reuse `CCData.hstDayUtcWindow(hstDate())` → `{since, until}`; it returns UTC ISO bounds for the HST local day). Normalize to a small shape `{start, end, title, allDay, calendarId, htmlLink}`.
4. **Render (read-only):** a "Schedule · Today" card in the Today tab (next to "Today · Todoist"). Appointments are **NOT deferrable** — each row shows the time + an "open in calendar" link (`htmlLink`). Add the render fn in `src/app.c.js` and call it from `loadTodoist()` (rename to taste, e.g. `loadTodoistAndCalendar()`), still non-blocking.
5. Probe the live `list_events` response shape **before** writing the parser — MCP wrappers reshape fields; build around what you observe, not what you assume.

**3e Today's Progress stays a stub** until Task 7 (numerator = `find-activity` per CP3; denominator owned by the nightly job). Don't build 3e now.

---

## 4. Hard gates (do not cross without Chris)

- **No merge to `main` before CP4.** Previews only.
- **No cutover:** the dashboard keeps reading Notion for tasks. 3c adds a lane alongside; it must not touch `app.tasks`.
- **Streak stays OFF** until Tasks 7 + 8.
- Branch stays **unpushed/unmerged**. Pushing is Chris's action: `git push origin feat/todoist-phase1` (he must target the branch — a plain `git push` from `main` is a no-op).

---

## 5. Environment notes (read before any git/file op)

- **Worktree first move (every session):** run `bash scripts/cc-worktree-bootstrap.sh` from the worktree before any git command. The pointers are now stored **relative** (mount-independent), so they no longer go stale across Cowork remounts — the script just re-asserts them and clears stale locks. You should never need to hand-edit pointers again. (Root-fix detail: a relative `gitdir:` contains no `/sessions/<mount>/` path, so a new session mount can't invalidate it; proven on the sandbox's git 2.34.1.)
- **Edit existing tracked files in the worktree via bash only** (Read tool for reads; the Edit/Write tools and bash are incoherent for existing files under `.worktrees/`). Use python/heredoc in place. Keep every `cc-build.js` input **< 40 KB**.
- **Verify:** `node --test` (expect 127/127 + your new tests) and `node cc-build.js` from the worktree root. Syntax-check the bundle: `{ echo '(function(){ "use strict";'; cat src/app.a.js src/app.c.js src/app.b.js; } > /tmp/chk.js && node --check /tmp/chk.js` (HTML opens the IIFE, app.b.js closes it with `})();`).
- **Stuck git locks:** the bootstrap script clears them. Background: a crashed commit leaves `index.lock`/`HEAD.lock` the drvfs mount **cannot `rm`** ("Operation not permitted"); **`mv` works** (atomic rename), which is what the script uses. Never loop on `rm`.
- **Sandbox cannot push** (GitHub 403, no creds).

---

## 6. What's already in source (so you don't re-touch it)

- `cc-data.js`: `splitTodayPanel`, `normalizeTodoistTask`, `todoistTileCounts`, `hstDayUtcWindow`, `completedInTreeOnDay`, `stripCcMarkers` (+ all earlier helpers). Add `mergeCalendarEvents` next to these and export it.
- `src/app.c.js`: `TT` map, `areaByProjectId`, `loadTodoistTiles`, `loadTodoistInbox`, `tdRowHtml`, `renderTodoistToday`, `renderInboxChip`, `openTodoistInbox`, `loadTodoist()`. Add calendar load + render here.
- `src/index.html`: "Today · Todoist" card + Inbox chip already in the Today tab's left column. Add the "Schedule · Today" card nearby.
- `netlify/functions/todoist-proxy.js`: reads find-tasks / find-projects / find-activity; resolves `projectId:"inbox"` via `resolveInboxId`. (Calendar reads go through the **Google Calendar MCP**, not this proxy — in the deployed browser there is currently no calendar proxy; decide with Chris whether 3c needs a `calendar-proxy` for the deployed path, or whether the lane is Cowork/MCP-only for now. Flag this, don't guess.)

> ✅ **Resolved (2026-06-08):** Chris chose **(a) MCP-only**. The lane populates via the Google Calendar MCP in Cowork and shows a graceful empty state on the live Netlify site. The deferred deployed-path proxy is tracked as **Task 3c-proxy** in the phase-1 plan roadmap (build `netlify/functions/calendar-proxy.js`, mirror `todoist-proxy`, needs Google creds in Netlify env).

---

## 7. What’s next (3c is done)

3c is built, tested (135/135), and committed at `dc904e4`. Nothing pushed; `main` untouched. Per the sequential spine (`… → 3 → 5 → 6 → 7 → 8 → 10`), the next build block is **Task 5 — Writes**. Deferred from 3c: **Task 3c-proxy** (deployed calendar path) — both tracked in `docs/superpowers/plans/2026-06-08-command-center-todoist-phase1.md`.

> First move in any new session: `bash scripts/cc-worktree-bootstrap.sh` (fixes/asserts worktree git pointers + clears locks), then proceed.
