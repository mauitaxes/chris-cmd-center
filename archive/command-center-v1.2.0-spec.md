# Command Center v1.2.0 — Design Spec

**Date:** 2026-06-03 · **Owner:** Chris (Hawaii / HST) · **Status:** Approved, building

## Goal

Clean rebuild of the Command Center Cowork artifact (v1.1.2 → v1.2.0) against the existing Notion backend. Primary focus: ADHD management + heavy task orientation. Dashboard layout in the dark navy / neon-cyan / JetBrains Mono aesthetic, with the task list promoted to the prominent main panel.

Versioning throughout this project uses **SemVer** (app version `1.2.0`, state schema `2.0.0`, etc.).

## Root cause of the v1.1.2 bug

Morning routines and task lists rendered blank because the read path used **semantic search**, which returns only page titles + IDs (no `Done`/`Priority`/`Area`/`Due` values) and is ranked/capped — it cannot reliably enumerate a list or know completion state.

Verified read mechanics:
- `notion-fetch` on a **page ID** → full property values. Reliable.
- `notion-fetch` on a **database / data source** → schema only, no rows.
- `notion-search` scoped to a data source → titles + IDs only, ranked/capped. Not for enumeration.

## Architecture

Two cooperating pieces share one Notion-backed state store:

1. **6am brief scheduled task (HST).** Runs with full tool access. Enumerates the Tasks DB, selects today's working set, resets routines for the new day, evaluates the streak, writes a natural-language brief + the curated `taskIds` into the State page JSON. This is the heavy, reliable curation step — it fixes the thin-brief problem.
2. **The artifact (live HTML).** On open it reads the State page JSON, fetches each `taskId` page by ID for full fidelity, and renders the dashboard. It regenerates the brief view live on open (so the brief is "both" scheduled and on-demand). It handles inline actions: mark task done, quick-add task, brain-dump capture, log win, run/stop the focus timer.

## Streak rule

Day boundary: **12:00 am HST.** The streak increments only on a day where Chris **both** completes a task **and** records a win. Tracked via `lastCompleted`, `lastWinDate`, and `lastStreakDate` (prevents double-credit). A day that passes without both conditions resets `streak` to 0 at the next curation.

## Backend changes (additive — no existing data touched)

**Tasks DB** (`collection://fb432308-59b9-4078-92db-a83c6279957d`) — add:
- `Energy` — select: Low / Medium / High
- `Time Estimate` — select: 5 min / 15 min / 30 min / 1 hr / 2 hr+

**Routines DB** (new) — recurring daily items, reset cleanly each day:
- `Routine` (title), `Active` (checkbox), `Done Today` (checkbox), `Order` (number), `Time Of Day` (select: Morning/Afternoon/Evening/Anytime), `Last Done` (date), `Streak Count` (number)

**Capture DB** (new) — brain-dump inbox:
- `Item` (title), `Captured` (date), `Processed` (checkbox), `Notes` (rich text)

**Focus Sessions DB** (new) — pomodoro log for persistent focus minutes + history:
- `Session` (title), `Date` (date), `Minutes` (number), `Task` (rich text), `Type` (select: Focus/Break)

**State page JSON** (`37478f3d-415b-814c-8c65-dd76b6ab9aa3`) — migrate to schema `2.0.0`, backward-compatible:

```json
{
  "schemaVersion": "2.0.0",
  "appVersion": "1.2.0",
  "streak": 0,
  "lastCompleted": "",
  "lastWinDate": "",
  "lastStreakDate": "",
  "routineResetDate": "2026-06-03",
  "focusMinutesToday": 0,
  "taskIds": [],
  "wins": [],
  "databases": { "tasks": "...", "wins": "...", "routines": "...", "capture": "...", "focusSessions": "..." }
}
```

The `databases` map stores data-source IDs so the artifact and future scheduled tasks discover backends without hard-coding — a future-proofing hook for further iteration.

## Dashboard layout (matches the approved mockup)

- **Top bar:** brand, Live/Synced pills, HST clock, `v1.2.0` badge, Brief / Export / Sync.
- **Tabs:** Today · Tasks · Routine · Wins.
- **Gauges:** Streak · Today's Progress · Week Completion.
- **Stat cards:** Open Tasks · Wins + Focus Minutes · Active Areas + Brain Dump count.
- **Momentum hero:** score + 6am brief summary + "Open full brief".
- **Main panel (prominent):** Today's Tasks — quick-add row, inline complete checkbox, priority star, Area + Energy + Time tags, due/overdue.
- **Support rail:** focus/pomodoro timer · quick-capture brain dump · recent wins · routine reset (12am HST).

Features intentionally excluded (not selected): one-thing-now/frog panel, WIP limit.

## Build / replace sequence

1. Apply backend changes; capture new data-source IDs.
2. Migrate State JSON to `2.0.0` with the `databases` map.
3. Build the artifact via `create_artifact`, wired to the backend; visual check against the mockup.
4. Create/update the 6am HST scheduled curation+brief task.
5. Replace v1.1.2 only after the visual check passes.
