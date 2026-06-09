# Command Center × Todoist × Calendar — Phase 1 Implementation Plan

**Source:** Handoff v4 (`command-center-todoist-calendar-handoff-v4`). This plan turns that handoff into an executable, checkpointed build. It does **not** supersede the handoff — read v4 for the *why*; this is the *how* and *in what order*.

**Prepared:** 2026-06-08 · **Owner:** Chris · **Status:** Plan complete, awaiting go to build.

---

## A. Preconditions status (live-verified 2026-06-08)

| Precondition | Status | Evidence |
|---|---|---|
| Hotfix `0936e8b` pushed to `main` | ✅ Done (this AM) | `7bde615..0936e8b` push confirmed |
| Hotfix actually **deployed** on Netlify | ✅ Verified | Live app serves v1.5.0; State `lastResetDate=2026-06-08` written today despite a >2KB JSON blob — only possible with the chunking proxy live (old build 400s) |
| Notion schema matches handoff §3 | ✅ Verified | Parent page + State re-fetched; all 5 mapped DB IDs match exactly (tasks `fb432308`, wins `f99a9128`, routines `17f7f036`, capture `35ba4e31`, focusSessions `291cb585`) |
| Stray `Routine` DB present (`28aa34d3`) | ⚠️ Confirmed, archive pending | Legacy twin schema, unreferenced by State. **Awaiting Chris's go to archive.** |
| `[DUPLICATE — safe to delete]` page (`37778f3d…81c3`) present | ⚠️ Confirmed, delete pending | **Awaiting Chris's go to delete.** |
| Todoist connector (Cowork, for migration/spike) | ⏳ Surfaced | Connect card shown; Chris to authorize |
| Todoist personal API token in Netlify env (app runtime) | ⏳ Chris action | Option A chosen — see §B |
| Google Calendar (read) + Notion connectors | ✅ Connected | Both live in this session |
| Todoist account TZ = Pacific/Honolulu | ⏳ Chris action | Set before any date-sensitive build |

**New finding (not in §3):** Daily Log DB (`5c892f50-2d01-4731-9b04-ed3ac02defcf`) exists under the parent page but is **absent from the State `databases` map**. If §7 step 2 writes the brief/progress to Daily Log, D9 resolution must add it. Handled as Build Task 0b below.

---

## B. Chris's manual checklist (do before / during build)

These are owner actions I can't do for you:

1. **Authorize the Todoist Cowork connector** (the card I just surfaced) — lets me run the migration and the recurring-completion spike.
2. **Generate a Todoist personal API token:** Todoist → Settings → Integrations → Developer → copy the API token. Free, never expires, full access to your own account.
3. **Set Todoist account timezone to `Pacific/Honolulu` (HST)** — Settings → General → Time zone. Gate for every date-sensitive feature.
4. **Add the token to Netlify env:** Site settings → Environment variables → add `TODOIST_API_TOKEN`. This is what the browser dashboard's serverless proxy **and** the 2am scheduled function use. The token stays server-side only — never shipped to the browser.
5. **Confirm Netlify plan supports Scheduled Functions** on this site (§13 open item).

---

## C. Build sequence — superpowers chain

Brainstorming is done (the handoff is its output). The chain starts at planning and runs:

`using-superpowers` → `writing-plans` (this doc → executable checklist) → `using-git-worktrees` → `subagent-driven-development` + `test-driven-development` → `requesting-/receiving-code-review` → `verification-before-completion` → `finishing-a-development-branch`

Drop into `systematic-debugging` on any unexpected behavior; the migration is a one-shot script verified by reconciliation, not TDD.

**First action of the build session:** load `superpowers:using-superpowers`, then inspect the repo to establish the **actual stack and test runner**. Every TDD/review/verify step adopts what the app already uses — no new framework imposed. (Known from prior work: vanilla JS bundle built by `cc-build.js` from split inputs `app.a.js` / `cc-data.js` etc., dist on Netlify, existing node test suite ~69+22 tests. Confirm at build time.)

---

## D. Build tasks — ordered, with dependencies

Legend: **[S]** sequential / shared-state · **[P]** parallelizable · checkpoint = stop for Chris.

### Task 0 — Foundation (do first, blocks everything)
- **0a [S] Runtime ID resolution (D9).** Wire the boot-time resolver: read State `databases` map as source of truth; for any missing key, look up by title under the 🤖 Claude Workspace page and write the resolved ID back. Fail loudly (visible error, not empty panel) on unresolved required DB. Add Todoist `todoistProjects{}` / `todoistLabels{}` resolution by stored ID. **This is build task #1 per the handoff.**
- **0b [S] Register Daily Log.** Add `dailyLog: 5c892f50-…` to the State `databases` map (or ensure 0a resolves it by title) so §7 step 2 can write there. Resolves the new finding above.
- **0c [S] Notion cleanup** (after Chris's go): archive stray `Routine` DB `28aa34d3`; delete `[DUPLICATE…]` page `37778f3d…81c3`. Removes D9 title-resolution ambiguity.

### Task 1 — Todoist structure [S] (blocks migration + reads)
Create parent `Command Center` project, 7 Area sub-projects (Daily Routines, Focus & Work, Health & Sleep, Finances, Home & Space, Relationships, Claude Tasks), full label set (`@today`, `@energy-low/med/high`, `@5m/@15m/@30m/@1h/@2h`). Store returned IDs in State (`todoistProjects{}` / `todoistLabels{}`). Confirm Inbox is the capture target.

### Task 2 — Migration (one-shot script, NOT TDD) [S]
Freeze → export open Tasks (`Done=false`) + untriaged Capture (`Processed=false`) → transform per §5 field map → batched idempotent Sync `item_add` (≤100/req, deterministic `uuid` from Notion page ID) → **reconcile counts per Area + P1 + Inbox before cutover** → spot-check 5 tasks. Leave Notion DBs as read-only archive 1–2 weeks (rollback net). **Checkpoint: do not cut over until counts reconcile.**

### Task 3 — Reads [P after Task 1] (mostly independent units)
- 3a [P] Task tiles: Open Tasks, Priority Flagged (active P1), Active Areas, per-area lists.
- 3b [P] Today's Tasks panel: saved filter `(@today | today | overdue)` scoped to CC tree; overdue contained/collapsible (D3, threshold 5 — Chris to tune).
- 3c [P] Schedule panel: allow-listed Google Calendar IDs (D6a), time-ordered, read-only.
- 3d [P] Inbox chip: untriaged Inbox count.
- 3e [S] **Today's Progress (§6):** frozen `plannedToday[]` denominator, forward-only, can exceed 100%. Uses completed-by-completion-date endpoint, HST→UTC window. Depends on nightly snapshot (Task 7) for the denominator — stub `plannedToday[]` until 7 lands.

### Task 4 — Recurring-completion spike [S] — **GATES the streak** — ✅ DONE (2026-06-08, CP3 PASS)
10-min live-API test: complete a recurring task, query completed-by-completion-date, confirm it appears. **Do not wire/flip the streak until this passes** (§8). Also confirms the endpoint response shape + tree scoping (§13 open items).

> **RESULT (see `TASK4-SPIKE-RESULT.md`):** PASS. Recurring completions surface via **`find-activity` (eventType=completed)**, **NOT** `find-completed-tasks` — the latter misses genuinely-advancing recurrences (confirmed live; matches branch spike `f63654e`). Scoping is **exact-project, NOT recursive** → fetch workspace-wide and filter client-side against the 7 sub-project IDs. `eventDate` is **UTC** → convert the HST day to a UTC window (`hstDayUtcWindow` + `completedInTreeOnDay` already landed on `feat/todoist-phase1`). Recurrence-survival RESOLVED: `"every day"` advances/survives; `"every day starting today"` closes the series — migration/quick-add must use plain phrasing (no `"starting today"` anchor). Resolves §13 open items 1 & 3.

### Task 5 — Writes [S after Task 1]
Quick-add (Area → sub-project; global box → Inbox); check-off (optimistic, rollback on fail, idempotent); every write carries a stable idempotency key (D7-API). Everything else deep-links to Todoist.

### Task 6 — Defer [S after Task 5]
Three-way (D7): Not today (remove `@today`), Tomorrow (dated → snooze due +1 & clear `@today`; undated → clear `@today` + queue `retagTomorrow[]`), specific/recurring → deep-link. Cover overdue/undated edge cases.

### Task 7 — Nightly refresh [S] (Netlify Scheduled Function, `0 10 * * *` = 00:00 HST)
Ordered, non-negotiable: (1) evaluate+record streak → (2) save brief/progress to State and/or Daily Log → (3) clear all `@today`, apply `retagTomorrow[]`, empty queue (one batched Sync) → (4) reset morning routine → (5) snapshot `plannedToday[]` → (6) stamp `lastRefreshDate`. Dashboard warns if `lastRefreshDate` ≠ today.

### Task 8 — Streak [S after Tasks 4 + 7]
Dashboard-composed, evaluated only in the nightly job (§8): Win logged AND task completed today AND routine ≥80%. `streakGraceUntil` for cutover day. Zero-routine-steps = data error → skip condition 3 + warn. Dashboard only displays the stored value.

### Task 9 — Offline queue (D4) [P]
Local capture queue, idempotent UUID flush to Inbox on reconnect.

### Task 10 — Refresh/sync plumbing [S]
Parallel on-load fetch (Todoist active + completed-today, Calendar, Notion); periodic poll (~2–5 min) + manual Sync; cached reads; stale indicator; missed-refresh banner; 429 backoff + Retry-After (D-RateLimits).

**Parallelizable cluster:** 3a/3b/3c/3d, 9 (independent reads + offline queue). **Sequential spine:** 0 → 1 → 2 → (4 gate) → 5 → 6 → 7 → 8 → 10.

---

## E. Phase 5 verification (evidence before claims, fresh subagent)
Against live Todoist: every tile number; Progress denominator == `plannedToday[]`, bar never retreats, overrun renders; no appointment double-shows (allow-list); offline capture→reconnect→no dupes; migration re-run→no dupes; check-off rollback; all 3 defer paths incl. overdue/undated; deep-links open correct task; nightly job runs server-side + missed-refresh banner fires; streak holds only when all 3 inputs met, respects grace window, survives zero-routine-steps. Graded by a subagent, not the code that wrote it.

---

## F. Open items to resolve during build (§13)
1. ✅ RESOLVED (Task 4 spike, `TASK4-SPIKE-RESULT.md`): numerator source = **`find-activity` (eventType=completed)**, not `find-completed-tasks`; event shape captured (`objectId, eventDate(UTC), parentProjectId, extraData.isRecurring/completedDueDateLocal/dueDate`); scoping **exact-project, non-recursive** (fetch workspace-wide, filter client-side by 7 sub-project ids); `eventDate` UTC → window in HST.
2. Is the brief/progress feature still rendered in the running app? (Verify before wiring §7 step 2. Live State still carries `brief`/`briefDate`; UI shows a "6am Brief / Open full brief" affordance — confirm it renders real content.)
3. ✅ RESOLVED (Task 4 spike) — hard gate **PASS / CP3 cleared**. Recurrence-survival follow-up also done: use plain `dueString` (e.g. `"every day"`), never `"...starting today"` (that variant closes the series).
4. D3 thresholds: overdue auto-collapse count (suggest 5) + weekly-review cadence — Chris to tune.
5. Which Google Calendar IDs go on the allow-list (D6a) — Chris to provide.
6. Should appointments feed a count/indicator anywhere? (Currently display-only.)
7. Todoist plan limits (project/label counts) on the target account.
8. Netlify plan supports Scheduled Functions + server-side secrets reach Todoist + Notion.

---

## G. Checkpoints (where I stop for you)
- **CP1 — now:** plan review (this doc) + Notion cleanup go + Chris's manual checklist (§B).
- **CP2:** after migration reconciliation, before cutover (Task 2).
- **CP3:** after the recurring-completion spike (Task 4), before flipping the streak live.
- **CP4:** Phase 4 code review + Phase 6 integration/deploy decision.
