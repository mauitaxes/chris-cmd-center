# Command Center × Todoist × Calendar — Implementation Handoff (v4)

**Status:** Design complete. Standalone. Grounded in a live review of the running app (chris-cmd-center.netlify.app) and a live fetch of the Notion backend (2026-06-08), plus the final round of resolutions on the progress bar, the nightly refresh, the streak, and the migration. Ready to implement. **Supersedes:** v1, v2, v3. This document is self-contained — you do not need to read the older handoffs. **Prepared:** 2026-06-08 **For:** Office machine — open this, spin up a Cowork project, and run the workflow in Section 12. **Owner:** Chris

## 0\. Read first — preconditions (do not skip)

These gate everything. Honor them before writing a line of code.

1.  > **The hotfix lands first.** Chris pushes a hotfix to the Command Center app in the morning. This work runs *after* that hotfix is live. Confirm it is deployed and the app is in a known-good state before starting.

2.  > **Re-verify the live Notion schema before building.** Section 3 was re-fetched live on 2026-06-08 and matched the prior snapshot exactly, but the hotfix may move things. Re-fetch and diff once more after the hotfix. **Do not hardcode database IDs** — resolve them at runtime (D9).

3.  > **Connect three connectors:**
    
      - > **Todoist** — read + write (data:read\_write). Validate against the live API on the office machine.
    
      - > **Google Calendar** — read-only (appointments are never edited from the dashboard).
    
      - > **Notion** — already connected; retained for the non-task panels.

4.  > **One timezone, set once: Pacific/Honolulu (HST).** Set the Todoist account timezone to HST before building anything date-sensitive. A single shared day boundary governs the board's today/overdue filters, the nightly refresh, the progress denominator, and the streak rollover. HST has **no daylight-saving time**, so this boundary is stable forever (D10).

## 1\. Goal & integration model

Replace the Command Center's Notion-backed task list with **Todoist**, and add a **read-only Google Calendar lane** for appointments. The Command Center stays a focused daily **dashboard** — summary-first, with lightweight capture, check-off, and defer. Heavy task management (editing, full reschedule, sub-tasks, recurring) lives in Todoist via deep-link.

**Three sources, each with one job:**

  - > **Todoist** — system of record for **tasks + capture**. Dashboard write actions are limited to **Add / Complete / Defer**.

  - > **Google Calendar** — **appointments only**, read-only display.

  - > **Notion** — retains **Wins, Routines, Focus Sessions, Daily Log, and the State store** (streak, focus minutes, brief, the day's plan snapshot).

Everything beyond Add/Complete/Defer deep-links into Todoist. Appointments are never edited from the dashboard.

**The one blessed exception to "each source does only its own job": the streak.** The streak is a *derived* daily metric composed from Wins (Notion), task completion (Todoist), and morning routine (Notion). No source computes another source's data — the **dashboard composes** raw inputs into the streak and writes the result to the Notion State store. See Section 8.

## 2\. Architecture at a glance

Command Center (dashboard, summary-first, native dark skin retained)

|

|-- TASKS ........ READ + WRITE (add/complete/defer) ....... Todoist

|-- APPOINTMENTS .. READ ONLY ................................ Google Calendar

|-- WINS / ROUTINES / FOCUS / DAILY LOG / STATE . READ+WRITE . Notion

|

Hard rule: each SOURCE does only its own job.

\- Task tiles compute ONLY from Todoist (incl. Today's Progress).

\- Notion panels compute ONLY from Notion.

\- Calendar events DISPLAY only; never counted in any task tile.

\- EXCEPTION: the streak is dashboard-composed (Wins + Todoist + Routine).

Todoist (system of record for tasks + capture)

Command Center \[parent project\]

|-- Daily Routines \[sub-project\] (task area; routine \*steps\* stay in Notion)

|-- Focus & Work \[sub-project\]

|-- Health & Sleep \[sub-project\]

|-- Finances \[sub-project\]

|-- Home & Space \[sub-project\]

|-- Relationships \[sub-project\]

\+-- Claude Tasks \[sub-project\]

Inbox = Brain Dump (native, replaces the Notion Capture DB)

Labels: @today, @energy-low/med/high, @5m/@15m/@30m/@1h/@2h

Priority: P1 = flagged ("needs attention")

Google Calendar

Human calendars only, read today's events.

Include by ALLOW-LIST of calendar IDs, not a name deny-list (D6a).

Nightly refresh (Netlify Scheduled Function, 00:00 HST)

Runs server-side, independent of the dashboard being open. See Section 7.

## 3\. Notion backend inventory (live 2026-06-08)

The Command Center is driven by a parent **🤖 Claude Workspace** page (27268b77-7a95-4cd0-a94c-82bb12188b9a) containing the databases below, plus a JSON **⚙️ Command Center State** page (37478f3d-415b-814c-8c65-dd76b6ab9aa3).

### Databases and IDs (live, confirmed matching the prior snapshot)

| **Database**             | **Purpose**            | **Data-source ID**                   | **Disposition**                    |
| ------------------------ | ---------------------- | ------------------------------------ | ---------------------------------- |
| **Tasks**                | All tasks              | fb432308-59b9-4078-92db-a83c6279957d | **Migrate to Todoist** (Section 5) |
| **Capture** (Brain Dump) | Unsorted quick-capture | 35ba4e31-eca6-4ab7-8625-acc41d5341e8 | **Replace with Todoist Inbox**     |
| Wins                     | Logged wins            | f99a9128-9809-48b9-9cb6-870717bd5183 | Stays in Notion (feeds streak)     |
| Routines                 | Morning routine steps  | 17f7f036-e24c-40ce-9d41-db5d8a66b618 | Stays in Notion (feeds streak)     |
| Focus Sessions           | Pomodoro/focus log     | 291cb585-746e-4195-a920-b0ac460fbbf6 | Stays in Notion                    |
| Daily Log                | Journal/log            | 5c892f50-2d01-4731-9b04-ed3ac02defcf | Stays in Notion                    |

**Cleanup flags found during the live fetch — resolve before building so ID resolution is unambiguous:**

  - > A **stray second database titled Routine** (28aa34d3-8cef-49e7-9c85-45ee71d5b200), distinct from the active **Routines** (17f7f036…) that the State store references. Confirm Routine is unused and archive it, or you risk wiring the streak to the wrong DB.

  - > A page titled **\[DUPLICATE — safe to delete\] test smoke through normal browser** (37778f3d-415b-81c3-…). Delete it.

### Tasks DB — schema (live, confirmed unchanged)

| **Field**     | **Type** | **Values**                                                                                        |
| ------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Task          | Title    | —                                                                                                 |
| Area          | Select   | Daily Routines, Focus & Work, Health & Sleep, Finances, Home & Space, Relationships, Claude Tasks |
| Due Date      | Date     | —                                                                                                 |
| Done          | Checkbox | —                                                                                                 |
| Priority      | Checkbox | **Binary flag only — no P1/P2 tiers**                                                             |
| Energy        | Select   | Low, Medium, High                                                                                 |
| Time Estimate | Select   | 5 min, 15 min, 30 min, 1 hr, 2 hr+                                                                |
| Notes         | Text     | —                                                                                                 |
| Created       | Date     | —                                                                                                 |

### Capture DB (Brain Dump) — schema

| **Field** | **Type**                     |
| --------- | ---------------------------- |
| Item      | Title                        |
| Notes     | Text                         |
| Captured  | Date                         |
| Processed | Checkbox (false = untriaged) |

### State store — Command Center State page (live values 2026-06-08)

JSON blob ("Do not edit by hand"). Live contents: schemaVersion: 2.0.0, appVersion: 1.3.0, streak: 14, lastCompleted, lastWinDate, lastStreakDate, routineResetDate, focusMinutesToday, brief + briefDate, wins\[\], routineIds\[\] (9 ids), a databases map of the IDs above, taskIds\[\] (15 ids — the old morning-brief board), and lastResetDate.

**Key implications:**

  - > The old "Today's Tasks" was a curated taskIds list, **not** a due-date filter. It is replaced by the @today label + due/overdue board (D1). The old taskIds\[\] board is **retired** — but the *concept* returns, auto-generated, as plannedToday\[\] (Section 6, written nightly).

  - > The databases map is the **runtime source of truth for Notion IDs** (D9).

  - > The streak fields (streak, lastStreakDate, lastWinDate, lastCompleted) are read and written by the **nightly job only** (Section 8). The dashboard displays them; it does not compute them.

**New State fields this project adds:**

  - > plannedToday\[\] — the day's planned-pick task IDs, snapshotted by the nightly refresh; the frozen denominator for Today's Progress (Section 6).

  - > retagTomorrow\[\] — task IDs queued by "Tomorrow on undated" defers (D7).

  - > calendarAllowList\[\] — Google Calendar IDs to include (D6a).

  - > streakGraceUntil — cutover grace date for the streak (D11).

  - > lastRefreshDate — heartbeat stamped by the nightly job; the dashboard warns if it isn't today (Section 7).

  - > todoistProjects{} / todoistLabels{} — resolved Todoist project and label IDs (D9).

## 4\. Dashboard layout (native skin, Today view)

The existing visual language is preserved exactly: dark command-center theme, monospace type, neon ring gauges, amber momentum readout, colored area pills, priority stars. **Only the Today view's main panel changes.**

**Today view becomes a two-panel split:**

  - > **Left — TODAY'S TASKS (Todoist).** The daily board (D1). Quick-add with area selector; task rows with checkbox + star + area pill + energy/time labels; a per-row defer control. **Overdue renders in a contained, collapsible Overdue (N) section below today's picks** (D3). A small **Inbox · N** chip surfaces the untriaged Inbox count as a gentle triage nudge (D5).

  - > **Right — TODAY · SCHEDULE (Google Calendar).** Time-ordered appointments, read-only, each with an "open in calendar" affordance. Footer: "read-only · manage in calendar."

Each tile/card carries a small **source tag** so the three-source model stays legible: ·tdo (Todoist), ·ntn (Notion), and the cyan Calendar badge. On phone the two panels stack — appointments on top as a timeline, tasks below.

The right rail (Focus session, Quick capture, Log a win, Routine reset) is retained; Quick capture now writes to the **Todoist Inbox**.

## 5\. Field mapping & migration (Notion → Todoist)

### Field mapping — Tasks DB

| **Notion field**       | **Todoist target**                   | **Notes**                                              |
| ---------------------- | ------------------------------------ | ------------------------------------------------------ |
| Task (title)           | Task content                         | Direct.                                                |
| Area (select)          | **Sub-project** under Command Center | 1:1 with the 7 Area options.                           |
| Due Date (date)        | Due date                             | Feeds the due/overdue arm of the board.                |
| Done (checkbox)        | Task completion                      | Checked = completed.                                   |
| Priority (checkbox)    | **Priority P1**                      | Flagged → P1; unflagged → P4/none.                     |
| Energy (select)        | **Label** @energy-low/med/high       | No native field; label is the fit.                     |
| Time Estimate (select) | **Label** @5m/@15m/@30m/@1h/@2h      | No native field.                                       |
| Notes (text)           | Task description                     | Direct.                                                |
| Created (date)         | Created date                         | Auto-set by Todoist; cannot be backfilled (see below). |

### Field mapping — Capture DB → Todoist Inbox

| **Notion field**     | **Todoist target**        | **Notes**                                                             |
| -------------------- | ------------------------- | --------------------------------------------------------------------- |
| Item (title)         | Task content in **Inbox** | Native capture bucket.                                                |
| Notes (text)         | Task description          | —                                                                     |
| Captured (date)      | Created date              | Auto.                                                                 |
| Processed (checkbox) | **Triage state**          | Untriaged = still in Inbox. Triaged = moved into an Area sub-project. |

**The only structural gap** is Energy / Time Estimate → labels (resolved above). Created cannot be set on import — Todoist stamps creation time itself; if original dates matter, prepend "\[created YYYY-MM-DD\] " into the description during migration. Everything else (Area, Priority, dates, notes, completion) maps cleanly.

### Migration plan (one-time, scripted, idempotent)

Todoist starts empty. The current Notion **open** Tasks and **untriaged** Capture rows migrate once, as a scripted one-shot on the office machine, after the hotfix. This is a one-shot script, not app code — it does not go through the TDD loop, but it is verified by reconciliation (below) before cutover.

**Scope:**

  - > **Migrate** all **open** Tasks (Done = false) — the live backlog.

  - > **Migrate** all **untriaged** Capture rows (Processed = false) → Todoist **Inbox**.

  - > **Do not migrate** completed Tasks or processed Capture rows — they are history; leave them in Notion as an archive. (A completed-history import is a separate, deferred job and not worth it now.)

**Procedure:**

1.  > **Freeze.** Pick a migration moment; Chris adds no tasks in Notion or Todoist during the run.

2.  > **Export.** Re-fetch the live Tasks (fb432308…) and Capture (35ba4e31…) data sources. Pull every open Task with all fields, every untriaged Capture item.

3.  > **Pre-create the Todoist structure:** parent **Command Center** project, the 7 Area sub-projects, the full label set (@today, @energy-\*, @5m/@15m/@30m/@1h/@2h). Store the returned project IDs and label IDs in State (todoistProjects{} / todoistLabels{}).

4.  > **Transform** each row per the field map: Area → sub-project ID (no Area → Command Center parent, triage later); Priority = true → P1 else P4; Energy/Time → label IDs; Due Date → due\_date (date-only unless the Notion date carried a time); Notes → description (prepend \[created …\] if preserving the date).

5.  > **Import via the Todoist Sync API in batches** (item\_add, up to 100 per request — D8). **Assign each command a stable client-generated uuid derived from the Notion page ID** (a deterministic hash). This makes the migration **re-runnable without duplicates** — if it dies halfway and you re-run it, already-applied uuids are discarded by Todoist (D7-API).

6.  > **Capture rows** → same approach, item\_add into **Inbox** (no project).

7.  > **Verify (do not skip):** per Area sub-project, count Todoist tasks vs. the Notion open-task count. Spot-check 5 tasks end-to-end (title, due, priority, labels, notes). Confirm Todoist P1 count == Notion Priority = true count. Confirm Inbox count == untriaged Capture count.

8.  > **Cutover:** only after counts reconcile, point the dashboard at Todoist. Leave the Notion Tasks/Capture DBs intact (read-only archive) for one to two weeks as a rollback net.

**Rollback:** the migration is additive and Notion is untouched, so rollback = re-point the dashboard at Notion and delete the Command Center Todoist project. No data loss either direction.

## 6\. Today's Progress — frozen denominator, forward-only bar

The progress bar must never run backwards — a bar that retreats when you add a task, or that sits permanently near zero because of an overdue pile, is an ADHD demotivator. Both failure modes are designed out.

**The denominator is the day's plan, frozen at the nightly refresh.** At 00:00 HST the nightly job snapshots the day's planned picks into plannedToday\[\]:

plannedToday = open tasks in the Command Center tree that are

(@today) OR (due today) — overdue EXCLUDED

Today's Progress = completed\_from\_plannedToday

\--------------------------------

| plannedToday |

  - > **Numerator** = how many plannedToday\[\] IDs you've completed today (plus any task you *add and @today-tag during the day* and then complete — tracked as "+N added").

  - > **Denominator** = the size of plannedToday\[\], fixed for the day. Completing tasks only ever raises the bar; adding tasks never deflates it.

  - > Numerator and denominator are the **same set**, so completing an **overdue** task ticks the Overdue (N) count down but does **not** move the progress bar — it was never part of today's plan. This is what keeps the overdue pile out of the denominator (D1, D3).

  - > The bar **can exceed 100%**: finish everything planned plus extras and you read e.g. 9/7 — overachievement, displayed as a bonus, never capped to feel like a ceiling. The ring gauge fills to full and the count carries the real number.

completed\_from\_plannedToday is derived from Todoist's **completed-by-completion-date** endpoint (API v1 GET /tasks/completed/by\_completion\_date; equivalently Sync v9 completed/activity), scoped to the Command Center tree and intersected with plannedToday\[\]. **Todoist stores completion times in UTC**, so compute the HST day window (00:00–23:59 Pacific/Honolulu) and convert to UTC for the since/until query (D10).

## 7\. The nightly refresh (Netlify Scheduled Function)

A single server-side job is the spine of the whole day boundary. It runs **independent of whether the dashboard is open**.

**Runtime:** a **Netlify Scheduled Function**, cron 0 10 \* \* \*. HST is UTC−10 with no DST, so **10:00 UTC = 00:00 HST permanently** — no daylight-saving drift to ever debug.

**Ordered steps (order is non-negotiable — the streak is recorded *before* the day's data is reset):**

1.  > **Evaluate and record the closing day's streak** (Wins + Todoist completion + Routine %, per Section 8) → write streak / lastStreakDate.

2.  > **Save the day's progress report / brief** to the State store (and/or Daily Log).

3.  > **Clear all @today labels** across the Command Center tree, then **apply the retagTomorrow\[\] queue** (re-add @today to each queued ID) and empty the queue — one batched Sync request.

4.  > **Reset the morning routine** for the new day (re-check routine steps to "not done"; everything resets end of day).

5.  > **Snapshot plannedToday\[\]** for the new day (Section 6).

6.  > **Stamp lastRefreshDate = today (HST).**

**Failure detection:** the dashboard reads lastRefreshDate on load and shows a non-blocking banner if it isn't today — the smoke alarm for "the 2am job silently died." All writes in the job are batched Sync requests with idempotency keys, so a retried run is safe.

> **Open item flagged by Chris:** confirm during implementation whether the "progress report / brief" feature is still rendered in the running app. The State store still carries brief + briefDate, so the field exists; verify the UI still surfaces it before wiring step 2.

## 8\. The streak (dashboard-composed, midnight-evaluated)

**Rule:** a day keeps the streak if **all three** are true that day:

1.  > **A win was logged** — ≥1 entry in the Notion **Wins** DB dated today.

2.  > **A task was completed** — ≥1 task completed today in **Todoist**, Command Center tree (the input that moved off Notion). Same completed-by-completion-date query as Section 6.

3.  > **Morning routine ≥ 80%** — ≥80% of the day's steps in the Notion **Routines** DB are done.

**Evaluated in exactly one place: the nightly job (Section 7, step 1).** This is a deliberate simplification — the streak is *not* recomputed on every dashboard load. The dashboard only **displays** the stored streak. This removes the double-increment guard, the per-load race conditions, and any disagreement between what the bar says at noon and what's true at day-close. The job composes the three raw inputs, applies the AND, and on success sets lastStreakDate = today and increments streak; if the closing day failed the condition, streak resets to 0.

This does **not** violate "each source does its own job" — each source still reports only its own raw facts; the **dashboard/job composes** them. It is the one explicitly-blessed cross-source metric.

**Cutover grace (streakGraceUntil).** On cutover day Todoist has no completion history, so condition 2 would fail and nuke the 14-day streak. Guard it: while now \< streakGraceUntil, condition 2 **auto-passes**, so the streak rides on Wins + Routine until Todoist has history. Set streakGraceUntil to the end of cutover day. After that, normal evaluation resumes.

**Zero-routine-steps = data error, not a real "no routine" day.** The Routines DB holds a fixed set of persistent step rows (9 today) that Routine Reset re-checks daily; the rows aren't created/destroyed. So a step count of 0 means rows were deleted or a reset wrote nothing. Treat defensively: if step count is 0, **skip condition 3 (treat as met)** and surface a non-blocking warning so the data problem gets noticed — never break the streak over it.

> **Recurring-completion spike (gates this section).** In Todoist, completing a *recurring* task advances it to the next occurrence rather than logging a normal completion. Before trusting the streak or the progress bar, run a 10-minute spike against the live API: complete a recurring test task, query the completed-by-completion-date endpoint, confirm it appears. If recurring completions don't show, a recurring-only day would wrongly read 0 progress and break the streak. **Do not flip the streak live until this spike passes.**

## 9\. Resolved decisions (reference)

**D1 — Today's board = @today + due today + overdue.** The left panel shows the union of (a) @today-tagged, (b) due-today, and (c) overdue tasks, scoped to the Command Center tree. Implement as a saved Todoist filter, e.g. (@today | today | overdue). Overdue is contained (D3).

**D1a — @today is set by interaction in Todoist, not the morning brief.** The brief isn't interactive in the running app, so it must not drive the board. Highlighting = adding the @today label in Todoist (swipe / multi-select / quick-add). The dashboard just reads the filter.

**D1b — @today clears at the HST day boundary,** via the nightly refresh (Section 7), then immediately re-applies the retagTomorrow\[\] queue. Due dates / overdue status are untouched by the clear — only the label moves.

**D2 — Priority flagged → P1.** Notion Priority is a single checkbox, no tiers. "Priority Flagged" tile = count of active **P1** tasks. "Needs attention" (P1) and "doing today" (board) stay distinct signals.

**D3 — Overdue stays visible but contained.** Overdue persists as a standing reminder — never auto-cleared or auto-rescheduled — but an unbounded overdue list becomes wallpaper or a guilt pile. So: today's deliberate picks render at the top, always expanded; overdue renders below in a single collapsible Overdue (N) section. The **count N is always visible** (the reminder), but the list auto-collapses once N exceeds a small threshold (suggest **5**). Inside, sort oldest-first (or grouped by Area). **No daily nagging** — surface a once-weekly "overdue review" prompt instead. Threshold and cadence are Chris's to tune. (And recall from Section 6: overdue is excluded from the progress denominator.)

**D4 — Offline capture → queue & flush.** Quick-add / brain-dump holds captures in a local queue when offline and flushes to the Todoist Inbox on reconnect. Each queued item carries a stable client-generated UUID used as the request idempotency key (D7-API), so retries after partial success create no duplicates.

**D5 — Brain Dump = Todoist Inbox, with a small triage chip.** No custom "Brain Dump" sub-project. Captures land in the native **Inbox**. Triage = move from Inbox into an Area sub-project. Because the Inbox lives outside the Command Center tree, it shows up in no task tile by design — so add a small **Inbox · N** chip (untriaged count only) as a gentle triage nudge, no nag. The habit to build is moving things out of the Inbox in Todoist itself.

**D6 — Appointments from Google Calendar directly; ignore Todoist's calendar.** The dashboard reads Google Calendar for appointments via its own connector. Todoist's task→calendar push creates a mirror "Todoist" calendar; to avoid double display, don't enable that push, or exclude the mirror (D6a). Appointments are read-only.

**D6a — Exclude by ALLOW-LIST of calendar IDs, not a name match.** Maintain an explicit allow-list of the human calendar IDs to include, captured once during setup from calendarList.list (each calendar has an immutable id). The dashboard reads only allow-listed IDs; anything not on the list — the Todoist mirror, any future noise calendar — is never read. New calendars default to *excluded*. Store the allow-list in State (calendarAllowList\[\]) so it's editable without a redeploy.

**D7 — Defer is three-way.**

  - > **Not today** — remove the @today label. One tap. Task stays in its Area, drops off the *picks* part of the board. (A purely-overdue task has no @today to remove — for those, "Not today" is hidden; use Tomorrow or deep-link.)

  - > **Tomorrow** — depends on *why* the task is on the board:
    
      - > **Dated task** → snooze the due date by a day and clear @today. It returns tomorrow via the "due today" arm.
    
      - > **Undated @today task** → clear @today now and add the task ID to retagTomorrow\[\]. The nightly job re-applies @today at tomorrow's boundary (Section 7, step 3) — returns as a deliberate pick, no invented due date. (Todoist labels are static; there's no native way to schedule a future label, so the app manages it.)

  - > **Specific date / recurring** — deep-link to Todoist's date picker. Rare; not rebuilt. Appointments are not deferrable — the row shows "open in calendar" instead.

**D7-API — Idempotent writes.** The **idempotency key** is a per-request UUID: on the Sync API it's the command **uuid**; on REST it's the **X-Request-Id** header (≤36 bytes). Todoist discards any request whose key it has already processed. Generate one stable UUID per queued capture/write at enqueue time and reuse it on every retry. (temp\_id is a *different* concept — it references an object created *within the same batch* so later commands can point at it; it is not a dedup key. Use it only for intra-batch references.) Applies to the offline-queue flush (D4), the migration import (Section 5), and any retried write.

**D8 — Three single-purpose sources.** Todoist = tasks + capture; Google Calendar = appointments (read-only); Notion = Wins, Routines, Focus, Daily Log, State — plus the dashboard-composed streak. Scopes: Todoist data:read\_write, Google Calendar read-only. Batch writes via the Sync API (≤100 commands = one request).

**D9 — Don't hardcode IDs; resolve at runtime.**

  - > **Notion:** read the databases map in the State store as the single source of truth. On boot, resolve each needed DB by that map; if a key is missing, look it up by title under the 🤖 Claude Workspace page, then write the resolved ID back. **Fail loudly** (visible error, not a silent empty panel) if a required DB can't be resolved.

  - > **Todoist:** store the created project IDs and label IDs in State (todoistProjects{} / todoistLabels{}); resolve the parent by stored ID, not by name.

  - > **Net:** a hotfix that recreates a database changes an ID harmlessly — the app rediscovers it.

**D10 — One timezone, everywhere.** Every "today" boundary — board today/overdue, the nightly @today clear, completed\_today, the progress window, the streak rollover — resolves against Pacific/Honolulu. Set the Todoist account TZ to match (Precondition 4) and pass explicit TZ in every scheduled job and completed-items query. HST has no DST, so the boundary never shifts.

**D-RateLimits — budget + backoff.** Todoist limits: REST ≈ 450 req/min/user (1000 per 15 min); Sync ≈ 50 req/min (100 full syncs per 15 min). At a 2-minute poll firing \~4–5 reads, you're at \~2–3 req/min — under 1% of budget. Still: batch writes via Sync (the nightly clear is one batched request, not N REST calls); respect 429 with exponential backoff and the Retry-After header; cache reads between polls; only the manual Sync button forces a fresh pull.

## 10\. Dashboard behavior

### Read side (all task math is Todoist-only)

  - > **Today's Tasks panel:** (@today | today | overdue) across the Command Center tree (D1), overdue contained (D3).

  - > **Schedule panel:** today's events from allow-listed Google Calendars, time-ordered, read-only (D6/D6a).

  - > **Open Tasks tile:** count of active (incomplete) tasks across the tree; due-today and overdue sub-counts from due dates.

  - > **Priority Flagged tile:** count of active **P1** tasks (D2).

  - > **Today's Progress tile:** Section 6 — frozen plannedToday\[\] denominator, forward-only, can exceed 100%.

  - > **Per-area lists:** each Area sub-project renders its active tasks.

  - > **Active Areas tile:** count of Area sub-projects with ≥1 open task.

  - > **Inbox chip:** untriaged Inbox count (D5).

  - > **Notion tiles** (Morning Routine, Wins, Focus minutes): computed from Notion only. **Streak tile: displays the nightly-computed value** (Section 8).

### Write side

  - > **Quick-add:** from an Area → that sub-project; from the global capture box → **Inbox** (D5). Optimistic UI. Offline → queue & flush (D4).

  - > **Check-off:** completes the task in Todoist. Optimistic, rollback on failure. Double-complete is idempotent.

  - > **Defer:** Not today / Tomorrow inline; specific date deep-links (D7).

  - > **Everything else** (edit, full reschedule, sub-tasks, label changes, recurring): **deep-link** to Todoist.

  - > **Appointments:** no writes; "open in calendar" only.

  - > **Every write carries a stable idempotency key** (D7-API).

### Refresh & sync — fetch in parallel

  - > On load, fire all sources **in parallel** (Todoist active tasks, Todoist completed-today, Google Calendar events, Notion panels). Do not chain them — total time ≈ slowest single call.

  - > Periodic background poll (\~2–5 min) + manual **Sync** button. Reads are cached.

  - > Writes update locally, then re-pull to confirm. Network-down → show last-synced data with a stale indicator.

  - > On load, also read lastRefreshDate and warn if it isn't today (Section 7).

## 11\. Out of scope / deferred

**Out of scope now** (deep-link to Todoist or stays in Notion): editing, full reschedule, sub-tasks, comments, label management, recurring-task management in the dashboard. Notion-resident panels (Wins, Routines, Focus, Daily Log) unchanged.

**Deferred to a future phase (do not build now):**

  - > A dedicated "holding area / parked" project with its own nag reminder — Todoist's no-date state + Upcoming view already cover this.

  - > Importing *completed* task history into Todoist (the migration moves open tasks only).

## 12\. Implementation workflow (office machine) — superpowers

Run the build through the superpowers skill chain. **Brainstorming is already complete — this document is its output — so the chain starts at planning.** Load superpowers:using-superpowers first so the session knows how to discover and invoke the rest.

**Phase 0 — Preconditions (Section 0).** Confirm the hotfix is live and the app is known-good. Connect Todoist (data:read\_write, account TZ = Pacific/Honolulu), Google Calendar (read), Notion. Re-fetch the Notion schema and diff against Section 3; archive the stray Routine DB; delete the \[DUPLICATE …\] page.

**Phase 1 — Plan** (superpowers:writing-plans). Turn this handoff into an executable, checkpointed plan. **During planning, inspect the repo to establish the stack and the test runner** — the TDD, review, and verification phases below adopt whatever the app already uses; do not impose a new framework. Wire runtime ID resolution (D9) into the plan as the first build task. Identify the independent vs. sequential tasks so Phase 3 can parallelize. Output a written plan before touching code.

**Phase 2 — Isolate** (superpowers:using-git-worktrees). Create an isolated worktree for the feature work so the build never disturbs the deployed app.

**Phase 3 — Execute** (superpowers:subagent-driven-development + superpowers:test-driven-development). Build feature-by-feature, test-first, in this order. Independent units (per the plan) can be dispatched in parallel; shared-state units run sequentially.

1.  > **Todoist structure** — parent project, 7 Area sub-projects, label set; store IDs in State (D9). Confirm Inbox is the capture target.

2.  > **Migration** (Section 5) — export → transform → batched idempotent Sync import → **reconcile counts per Area before cutover.** (One-shot script; verified by reconciliation, not TDD.)

3.  > **Reads** — task tiles, Today's Tasks panel, per-area lists, Inbox chip, Schedule panel (allow-listed calendars, D6a). Wire Today's Progress per Section 6 (completed-by-completion-date endpoint, HST→UTC window, frozen plannedToday\[\]).

4.  > **Recurring-completion spike** (Section 8) — gate the streak go-live on it.

5.  > **Writes** — quick-add (Area / Inbox), check-off — optimistic with rollback, idempotency key per write (D7-API).

6.  > **Defer** — Not today / Tomorrow / specific-date deep-link (D7), including the overdue/undated edge cases.

7.  > **Streak** (Section 8) — composed in the nightly job, displayed by the dashboard; streakGraceUntil for cutover.

8.  > **Offline queue** (D4) — local capture queue with idempotent UUID flush to Inbox on reconnect.

9.  > **Nightly refresh** (Section 7) — the Netlify Scheduled Function at 0 10 \* \* \*, ordered steps, lastRefreshDate heartbeat.

10. > **Refresh/sync** — parallel on-load fetch, periodic poll, manual Sync, stale indicator, refresh-missed banner, 429 backoff (D-RateLimits).

When any bug or unexpected behavior appears, drop into superpowers:systematic-debugging before patching.

**Phase 4 — Review** (superpowers:requesting-code-review → superpowers:receiving-code-review). Request review when the build is feature-complete; work the feedback with technical rigor, verifying each point rather than reflexively agreeing.

**Phase 5 — Verify** (superpowers:verification-before-completion). Evidence before claims. Confirm against the live Todoist data: each tile's number; **Progress denominator == plannedToday\[\], bar never retreats, overrun renders correctly**; no appointment appears twice (allow-list); offline capture → reconnect → no duplicates; migration re-run creates no duplicates; check-off rollback; all three defer paths incl. overdue/undated; deep-links open the right task; the nightly job runs server-side and the missed-refresh banner fires when it doesn't; **the streak holds only when all three inputs are met, respects the grace window, and survives the zero-routine-steps data-error case.** For this high-stakes verification, run it via a fresh subagent so the checks aren't graded by the code that wrote them.

**Phase 6 — Finish** (superpowers:finishing-a-development-branch). Decide integration (merge / PR / cleanup), then deploy. Keep the Notion Tasks/Capture DBs as a read-only archive for one to two weeks as the rollback net before retiring them.

## 13\. Open items to confirm during the plan

  - > Exact response shape of the API v1 completed-by-completion-date endpoint — confirm project-tree scoping is available or filter client-side.

  - > Whether the progress-report / brief feature is still rendered in the running app (Section 7, step 2).

  - > The recurring-completion spike result (Section 8) — before the streak goes live.

  - > D3 thresholds: overdue auto-collapse count (suggested 5) and weekly-review cadence — Chris to tune.

  - > Which Google Calendar IDs go on the allow-list (D6a).

  - > Whether appointments should also feed a count/indicator anywhere (currently display-only).

  - > Todoist plan limits (project/label counts) on the target account.

  - > Confirm the Netlify plan supports Scheduled Functions on this site, and that the function can reach Todoist + Notion with the right secrets server-side.

*Handoff v4. Standalone; supersedes v1–v3. Grounds: live Notion fetch 2026-06-08 (schema confirmed, Daily Log ID resolved, stray Routine DB + duplicate page flagged) and live Todoist API research (idempotency via X-Request-Id/command uuid; rate limits REST \~450/min, Sync \~50/min with 100-command batching; completed-by-completion-date endpoint with UTC storage). Resolutions folded in: progress denominator excludes overdue and is frozen at the nightly snapshot; the nightly Netlify Scheduled Function owns the day boundary; the streak is evaluated once nightly with a cutover grace window; small Inbox triage chip; recurring-completion spike gates the streak. No implementation, code, or backend changes have been made. Re-verify live after the morning hotfix before building.*
