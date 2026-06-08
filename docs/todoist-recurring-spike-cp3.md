# Task 4 — Recurring-completion spike → CP3 gate

**Run:** 2026-06-08 (HST), branch `feat/todoist-phase1`. Account: Chris K. Simon, Todoist Pro, TZ Pacific/Honolulu.
**Question (handoff §8, line 308 / §13.1 open item):** In Todoist, completing a *recurring* task advances it to the next occurrence instead of logging a normal completion. Does that completion still appear in the "completed-by-completion-date" query? If not, a recurring-only day would read **0 progress** and wrongly break the streak.

## Verdict: ⚠️ PARTIAL — `find-completed-tasks` does NOT surface recurring completions. Use `find-activity` instead. Streak go-live is SAFE on the activity-log source.

## What was done (live)
1. Added a recurring test task `every day` in **Daily Routines** (`6gqCVgp6xQ44R2V3`). id `6gqCfg829g2j346V`, `recurring:"every day"`, due 2026-06-08, `checked:false`.
2. `complete-tasks` on it → success.
3. `fetch-object` after: task **still active** (`checked:false`), `dueDate` advanced **2026-06-08 → 2026-06-09**. Confirms: a recurring completion does NOT produce a closed task — it rolls forward. (Test task deleted after the run; the completion event remains in history, which is fine.)

## The two sources, measured
| Signal | Recurring completion visible? | Evidence |
|---|---|---|
| `user-info.completedToday` (karma/goal) | ✅ yes | ticked **2 → 3** right after completing |
| `find-completed-tasks` (getBy=`completion`) | ❌ **no** | returned only the 2 non-recurring onboarding tasks; the recurring one never appeared, per-project OR workspace-wide, in any window |
| `find-activity` (eventType=`completed`) | ✅ **yes** | event returned with full shape (below); `projectId=<sub-project>` filter returned exactly the 1 recurring completion |

So Todoist *counts* the recurring completion, but the completed-by-completion-date endpoint hides it. **The activity log is the reliable source.**

## Confirmed `find-activity` "completed" event shape (the streak/progress numerator)
```json
{
  "objectType": "task",
  "objectId": "6gqCfg829g2j346V",
  "eventType": "completed",
  "eventDate": "2026-06-08T19:58:53.903Z",     // UTC, actual completion action time -> use for the HST day window
  "parentProjectId": "6gqCVgp6xQ44R2V3",        // immediate project -> tree scoping key
  "initiatorId": "59362469",
  "extraData": {
    "isRecurring": true,                         // flags recurring completions
    "completedDateSource": "due_date",
    "completedDueDate": "2026-06-09T09:59:59.000000Z",
    "completedDueDateLocal": "2026-06-08T23:59:59",  // HST-local occurrence date
    "content": "SPIKE recurring-completion test (CP3) — safe to delete",
    "client": "Claude", "wasOverdue": false
  }
}
```

## Tree-scoping rule
- `find-activity` filters by **`parentProjectId`** = the task's *immediate* project. A task in `Daily Routines` has `parentProjectId = Daily Routines`, NOT the `Command Center` parent. Querying the parent id does **not** cascade to sub-projects (same non-cascade behavior seen with `find-completed-tasks` parent query → 0).
- **Nightly-job rule:** fetch `find-activity` (eventType=`completed`) workspace-wide and **filter client-side** by the set of 7 CC area project ids (already stored in `State.todoistProjects`). The activity log is reverse-chronological and has no date filter, so paginate by cursor and stop once `eventDate` < window start.

## Day-boundary (D10)
- HST = UTC−10, no DST. HST day `2026-06-08` = UTC window **[2026-06-08T10:00:00Z, 2026-06-09T10:00:00Z)**. The spike completion at `19:58Z` falls inside it. ✓

## Code landed (pure, TDD'd in `cc-data.js`, 109/109 green)
- `hstDayUtcWindow("YYYY-MM-DD")` → `{ since, until }` UTC ISO for an HST local day.
- `completedInTreeOnDay(events, treeProjectIds, sinceUtcISO, untilUtcISO)` → filters activity-log `completed` events to the CC tree within the window. `.length > 0` = streak condition 2 ("a task was completed today"); `.length` feeds the progress numerator.

## Consequence for the build (supersedes handoff §13.1 open item)
- **Task 7 (nightly job) & Task 8 (streak):** the "completed today" input comes from **`find-activity`**, never `find-completed-tasks`. Update the Todoist proxy/read layer accordingly when those tasks are built.
- The cutover-day `streakGraceUntil` guard (§8) still applies independently.

## CP3 status
Spike PASSES on the activity-log source → the streak can go live (once Tasks 7/8 wire it to `find-activity`). **No streak flip in this session — awaiting Chris sign-off.**
