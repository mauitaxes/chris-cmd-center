# Command Center — Backend Hardening Handoff

**Date:** 2026-06-03 · **Owner:** Chris (Hawaii / HST) · **For:** a fresh session using the superpowers plugin
**Purpose:** The v1.2.0 artifact now looks and behaves the way Chris wants. This handoff scopes a focused, test-driven review to make the **data/backend layer iron-tight** — because we keep hitting Notion DB-call problems — and to evaluate **using the artifact across multiple computers (home + office).**

---

## 1. How to start this task (superpowers flow)

Run these skills in order. Do **not** skip the gates.

1. `superpowers:brainstorming` — confirm the contract and open questions in §6 before touching code.
2. `superpowers:writing-plans` — produce a written plan for the data-layer rewrite + cross-device strategy.
3. `superpowers:test-driven-development` — write checks first (see §7 acceptance criteria); the data layer must be verified, not assumed.
4. `superpowers:verification-before-completion` — prove each claim (bridge availability, read completeness, write durability, cross-device sync) with evidence before declaring done.

Treat this as a hardening release. Use SemVer for any version bump (artifact is currently **1.2.0**; State JSON schema is **2.0.0**).

---

## 2. Current state (what works)

- The artifact renders exactly as intended: dark/neon dashboard, gauges, **Morning Routine panel** (7 ADD-support steps with hints + minutes), prominent **Today's Tasks** list with a **click-to-toggle priority star**, focus/pomodoro timer, quick-capture brain dump, win logging, recent wins, routine reset (12am HST).
- Architecture today: **embedded snapshot → render instantly → poll up to 12s for the live bridge → if present, switch to live Notion read/write and flush a localStorage pending-ops queue; if absent, stay on snapshot and persist edits to localStorage.** This guarantees the dashboard is never blank (the v1.1.2 failure mode).
- Notion backend is fully provisioned and seeded with Chris's real data (streak 12, 16 wins, 7 routine steps, 15 tasks).

## 3. The recurring DB-call problems (root issues to fix)

These are the specific failure modes we've hit. The review must resolve each definitively.

1. **`window.cowork.callMcpTool` was missing at script-boot.** The first live build rendered all-blank because every Notion call threw "callMcpTool missing." We added a 12s poll + snapshot fallback, but **whether the live bridge is ever available in this Cowork build is still UNCONFIRMED.** This is the #1 thing to determine: open the artifact, click the **v1.2.0 badge** (diagnostic), and record what `window.cowork` actually exposes (it dumps the object keys + whether `callMcpTool` / `askClaude` / `runScheduledTask` exist). Everything else depends on the answer.
2. **No reliable bulk-read tool.** Verified Notion read mechanics: `notion-fetch` on a **page ID** returns full properties (reliable); `notion-fetch` on a **database/data-source** returns schema only (no rows); `notion-search` scoped to a data source returns only title+id, ranked and capped (this caused the original thin/blank reads). There is **no clean "query all rows with properties" tool** in this MCP. The current design works around this by pinning task page IDs into State JSON and fetching each by ID. Validate this is the right long-term contract.
3. **MCP response-shape fragility.** `callMcpTool` results may be wrapped/nested/escaped (a JSON string whose `.text` holds the markdown with escaped quotes). We wrote `unwrap()`/`deepText()`/`toObj()`/`parseProps()` normalizers to peel these. Confirm they cover every real response shape (capture actual samples via the diagnostic).
4. **State JSON writes are fragile.** State is updated via `notion-update-page` `update_content` with an exact `old_str` match of the current JSON block. Concurrent edits (two computers, or the 6am task overlapping a manual edit) can break the match. Consider a more robust write (e.g., replace the whole block by anchor, or a read-modify-write with retry).
5. **Dev-env quirk (not a runtime bug):** `mcp__workspace__bash` serves a **stale cached copy** of the "Command Center Artifact" folder (froze at 44733 bytes, ignores Write/Edit). Verify artifact files with the **Read tool** (shares the Write path), not bash. The outputs mount is fresh. Note this so the reviewer doesn't chase phantom truncation.

## 4. Cross-device usage (home + office) — evaluate and design

Chris uses two main computers (home + office) and wants the Command Center consistent on both. Key considerations for the review:

- **Notion is the shared source of truth** — both machines read/write the same State page and DBs, so live mode should converge. Confirm the artifact (and its Cowork connectors) are available/authenticated on both machines.
- **localStorage is per-device.** The offline pending-ops queue and any snapshot edits live only on the machine that made them. If the bridge is flaky on one machine, edits made there won't appear on the other until they flush to Notion. Define the reconciliation rule (e.g., flush-on-connect, and never let a stale snapshot overwrite Notion truth).
- **The embedded snapshot goes stale per-artifact.** It's hard-coded data baked into the HTML. Decide how it refreshes: option A — the 6am scheduled task rewrites the snapshot via `update_artifact` each morning (works only on the machine running the task / when the app is open); option B — drop the snapshot once the live bridge is confirmed reliable and read purely live; option C — keep snapshot only as a cold-start placeholder and always prefer live.
- **Artifact sync across devices:** determine whether a Cowork artifact created on one machine appears on the other (account-synced vs local). If not synced, define how v-next is deployed to both.
- **Scheduled task placement:** the 6am brief task runs on whichever machine has the app open. Decide where it should live and how to avoid double-runs.

Deliver a recommended cross-device model with the trade-offs.

## 5. Backend reference (verified IDs)

```
State page:            37478f3d-415b-814c-8c65-dd76b6ab9aa3   (single JSON code block; schemaVersion "2.0.0")
Workspace root page:   27268b77-7a95-4cd0-a94c-82bb12188b9a   (Claude Workspace)

Tasks DB:              8bbc2654-2cf8-4ad8-bad0-1f3e2cb8b503
Tasks data source:     collection://fb432308-59b9-4078-92db-a83c6279957d
  props: Task(title), Area(select), Done(checkbox), Priority(checkbox), Notes(text),
         Created(date), Due Date(date), Energy(select Low/Medium/High), Time Estimate(select 5 min/15 min/30 min/1 hr/2 hr+)

Wins DB:               2bd8854a-8fbd-41ba-b464-efa3c6ab26f6
Wins data source:      collection://f99a9128-9809-48b9-9cb6-870717bd5183   (Win[title], Date[date])

Routines DB:           7d25349f-a714-42ac-85c6-4410fa22aeed
Routines data source:  collection://17f7f036-e24c-40ce-9d41-db5d8a66b618
  props: Routine(title), Active(checkbox), Done Today(checkbox), Order(number),
         Time Of Day(select), Last Done(date), Streak Count(number), Mins(number), Why(text)

Capture DB:            67883e1b-8bb7-4213-8781-255a0f45b5ac
Capture data source:   collection://35ba4e31-eca6-4ab7-8625-acc41d5341e8   (Item[title], Captured[date], Processed[checkbox], Notes[text])

Focus Sessions DB:     6d17e2eb-f84a-4546-8389-d517968000d3
Focus data source:     collection://291cb585-746e-4195-a920-b0ac460fbbf6   (Session[title], Date[date], Minutes[number], Type[select Focus/Break], Task[text])
```

State JSON shape (2.0.0):
```json
{"schemaVersion":"2.0.0","appVersion":"1.2.0","streak":12,"lastCompleted":"2026-06-03","lastWinDate":"2026-06-03","lastStreakDate":"2026-06-03","routineResetDate":"2026-06-03","focusMinutesToday":0,"taskIds":[ ...15 page ids... ],"wins":[],"databases":{"tasks":"...","wins":"...","routines":"...","capture":"...","focusSessions":"..."}}
```

Notion write reference: checkboxes use `"__YES__"`/`"__NO__"`; dates expand to `date:{Prop}:start` / `:end` / `:is_datetime`; schema changes via `notion-update-data-source` SQL DDL.

Streak rule: day resets 12am HST; streak increments only on a day where Chris **both** completes a task **and** logs a win (tracked via lastCompleted/lastWinDate/lastStreakDate). The 6am task handles the reset case.

Scheduled task: `command-center-6am-brief`, cron `0 6 * * *` (HST), curates taskIds + resets routines + rolls streak + writes the brief into State.

## 6. Open questions to resolve in brainstorming

1. Is `window.cowork.callMcpTool` ever available in this Cowork build? (Diagnostic first — this decides the whole architecture.)
2. If the bridge is reliable: drop the snapshot to pure-live, or keep snapshot as a cold-start placeholder?
3. If the bridge is NOT available: commit to the snapshot + localStorage + 6am-task-refresh model, and define how the 6am task rewrites the artifact and how cross-device reconciliation works.
4. What is the canonical read contract — pinned `taskIds` + fetch-by-ID only, or is there a better enumeration path worth finding?
5. How should State writes be made concurrency-safe across two machines?
6. Cross-device deployment: are Cowork artifacts account-synced, and where does the scheduled task run?

## 7. "Iron-tight" — acceptance criteria

The review is done when, with evidence:

- The bridge-availability question is answered definitively, and the architecture matches the answer.
- Every Notion read path returns complete, correctly-parsed data (no silent row drops) across all real response shapes — demonstrated with captured samples.
- Every write (task done, **priority toggle**, routine done, add task, capture, log win, focus log, state/streak) is durable and verified to land in Notion, with a tested offline→online flush.
- State writes survive concurrent/overlapping edits without corrupting the JSON.
- A clear, documented cross-device model (home + office) with reconciliation behavior, validated on both machines.
- A lightweight test/verification harness exists so future changes can't silently regress the data layer.
- No blank-render failure mode remains under any load order or bridge timing.

## 8. Files

- Live artifact source: `command-center-v1.2.0.html` (workspace folder).
- Design spec: `command-center-v1.2.0-spec.md`.
- Mockups: `command-center-v1.2.0-mockup.html`, `command-center-mockup.html`, `command-center-tasks-mockup.html`.
- Original app export: `Command Center Data.xlsx` (sheet `CommandCenterData`, schema 3.0) — source of the imported routine/wins data.
