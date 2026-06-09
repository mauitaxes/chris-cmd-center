# Task 4 — Recurring-completion spike — RESULT (corrected)

**STATUS: ✅ PASS — CP3 gate cleared.** · Run: 2026-06-08 (HST), Todoist Pro, user `59362469` (Chris K. Simon), TZ `Pacific/Honolulu`. · Live-API spike via Todoist MCP `b9779bcc-…`.

> **⚠ This doc was corrected after reconciling with the branch's own CP3 spike (`feat/todoist-phase1`, commit `f63654e`, `docs/todoist-recurring-spike-cp3.md`). An intermediate version of this file wrongly claimed `find-completed-tasks` surfaces recurring completions — that was a false positive caused by bad `dueString` phrasing. The corrected, verified conclusion below matches the branch.**

Resolves §F open items **1** & **3** in `command-center-todoist-PHASE1-PLAN.md` and §13.1 in the superpowers plan.

---

## 1. The gate question
When you complete a *recurring* task it **advances to the next occurrence** instead of becoming a closed task. Does that completion still appear in a completed-by-date query, so a recurring-only day doesn't read 0 progress and break the streak? → **Yes, but only via `find-activity`.**

## 2. Verified answer — use `find-activity`, NOT `find-completed-tasks`

Two throwaway recurring tasks were completed today and measured against both endpoints:

| Task | `dueString` | Completion behavior | In `find-activity` (completed)? | In `find-completed-tasks` (getBy:completion)? |
|---|---|---|---|---|
| SPIKE2 `6gqGVW2rxhx8h55G` | `"every day"` | **advances** (due rolled `06-08 → 06-09`, stayed active) — the *real* recurring behavior | ✅ yes | ❌ **no** |
| SPIKE1 `6gqGPj94GPrQvcpp` | `"every day starting today"` | **closes** (anomaly — series ended, task disappeared) | ✅ yes | ⚠ yes (only because it became a genuinely closed task) |

**Conclusion:** a genuinely-advancing recurring completion is logged in the **activity log only**. `find-completed-tasks` misses it. → **The streak "completed today" input and the progress numerator must come from `find-activity` (eventType=`completed`), never `find-completed-tasks`.** (This is exactly what the branch already built: `cc-data.js` `completedInTreeOnDay()` over activity events, 109/109 tests.)

## 3. `find-activity` "completed" event shape (the numerator source)
```json
{
  "objectType": "task",
  "objectId": "6gqGVW2rxhx8h55G",
  "eventType": "completed",
  "eventDate": "2026-06-09T01:58:31.575Z",            // UTC, actual completion-action time → HST day window
  "parentProjectId": "6gqCVgmP6rq8wv7G",              // immediate project → tree-scoping key
  "initiatorId": "59362469",
  "extraData": {
    "isRecurring": true,
    "completedDateSource": "due_date",
    "completedDueDate": "2026-06-09T09:59:59.000000Z",
    "completedDueDateLocal": "2026-06-08T23:59:59",   // HST-local occurrence date
    "dueDate": "2026-06-10T09:59:59.000000Z",         // next occurrence (proof it advanced)
    "content": "…", "client": "Claude", "wasOverdue": false
  }
}
```

## 4. Tree scoping — CRITICAL (same rule on both endpoints)
Filtering is **exact-project, NOT recursive.** `find-activity` filters by `parentProjectId` = the task's *immediate* project; querying the `Command Center` **parent** id returns nothing for sub-project tasks (confirmed 0, same non-cascade as `find-completed-tasks`).

→ **Nightly-job rule:** fetch `find-activity` (eventType=`completed`) **workspace-wide** and **filter client-side** against the 7 CC area project ids in `State.todoistProjects`.

## 5. Date window / timezone — CRITICAL
`find-activity` has **no server-side date filter** and is reverse-chronological. `eventDate` is **UTC**. → Paginate by cursor, convert the target HST day to a UTC window, and stop once `eventDate` < window start. HST = UTC−10 (no DST): HST `2026-06-08` = UTC `[2026-06-08T10:00:00Z, 2026-06-09T10:00:00Z)`. Already implemented: `hstDayUtcWindow()` + `completedInTreeOnDay()` in `cc-data.js`.

## 6. Recurrence-survival (migration / quick-add rule)
- `"every day"` → **advances/survives** on completion (verified). ✅
- `"every day starting today"` → **closes the series** (task disappears). ❌
→ Migration and quick-add must use plain recurrence phrasing; **never append `"starting today"`** anchors.

## 7. Cleanup
All throwaway tasks deleted; only completion-history events remain (harmless). No production data touched outside throwaways in Claude Tasks.

---

### One-line for the plan
> CP3 gate PASS. Recurring completions surface via **`find-activity` (eventType=completed)**, NOT `find-completed-tasks` (which misses advancing recurrences). Scope by the 7 sub-project ids client-side (parent ≠ recursive). `eventDate` UTC → window in HST. Quick-add/migration: plain `dueString`, never `"...starting today"`. Numerator code already landed on `feat/todoist-phase1` (`completedInTreeOnDay`).
