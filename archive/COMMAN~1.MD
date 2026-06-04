# Command Center Rebuild — Handoff

**Date:** 2026-06-03 (handoff for 2026-06-04 morning session, Hawaii time)
**Reconstructed from:** Notion workspace pages + last night's prep notes
**Caveat:** The original `command-center-rebuild-handoff` superpowers memory lives on the home install and is not present on this device. This document is the reconstruction.

---

## What this is

Command Center is a Cowork live artifact (HTML page) Chris uses as a daily dashboard. It reads from and writes to a Notion-backed state store, surfaces a task list, tracks a streak, and logs wins. The 6am brief is the morning summary the artifact (or a related scheduled task) produces.

The current deployed version is **v1.1.2**. It has display bugs. The plan is a clean rebuild against the same backend — not a patch.

## Where things live (verified in Notion)

- **Parent workspace page:** Claude Workspace — `https://app.notion.com/p/27268b777a954cd0a94c82bb12188b9a`
- **State store:** "⚙️ Command Center State" — `https://app.notion.com/p/37478f3d415b814c8c65dd76b6ab9aa3`
  - Single page, contains a JSON code block, labeled "Do not edit by hand."
  - Current schema:
    ```json
    {"streak":0,"taskIds":[],"wins":[],"routineResetDate":"2026-06-03","lastCompleted":""}
    ```
- **Tasks database:** `https://app.notion.com/p/8bbc26542cf84ad8bad01f3e2cb8b503`
  - Data source: `collection://fb432308-59b9-4078-92db-a83c6279957d`
  - Properties seen: Task, Area, Done, Priority, Notes, Created (date), Due Date (date)
- **Wins database:** `https://app.notion.com/p/2bd8854a8fbd41bab464efa3c6ab26f6`
  - Data source: `collection://f99a9128-9809-48b9-9cb6-870717bd5183`
  - Properties seen: Win (title), Date

## Version history (from Wins log + task notes)

- 2026-05-22 — Restarted work on the Command Center app, deployed v3
- 2026-05-24 — Rebuilt Command Center app
- 2026-05-24 — Debugged the problem with command center app rebuild
- 2026-05-25 — Task logged: next Command Center version uses SemVer numbering (hence the jump to v1.1.x)
- Iterated through v7 — "looking good"
- "Woke up, initiated new command center; confirmed updates working and new task list doing what I wanted"
- Current: **v1.1.2** — has display bugs, scheduled for rebuild

## Known issues (from last night's notes)

- **v1.1.2 has display bugs.** Specific symptoms were not captured in Notion; check the live artifact when it's open, or ask Chris to describe what's rendering wrong.
- **The 6am brief uses the old search-based read logic.** It will run tomorrow on that logic and may come through thin or partial. This is expected and harmless. The rebuild is what fixes how the brief reads its source data.
- **Data is safe.** All state and history live in Notion; nothing is lost when the artifact is replaced.

## Open questions to confirm with Chris before coding

1. Exact display-bug symptoms in v1.1.2 — what specifically renders wrong?
2. What does the "search-based read logic" currently search, and what should the rebuild use instead (direct page fetch by ID? data-source query? something else)?
3. Connector surface: today the artifact appears to use Notion only — confirm whether the rebuild should also pull from any of: QuickBooks, PayPal, Square, Stripe, HubSpot, Gmail, Google Calendar, Drive, Slack, MS365 (all are connected and available).
4. Streak rules: how is `routineResetDate` supposed to advance, and what counts as a "completion" that updates `lastCompleted` / increments `streak`?
5. The 6am brief — is it generated inside the artifact on open, or by a separate scheduled task? If separate, that task likely also needs updating.

## Suggested approach for tomorrow's session

1. Open a fresh Cowork window.
2. Invoke the **superpowers** plugin and use **brainstorming** first — confirm intent and scope against the open questions above before touching code.
3. Move to **writing-plans** with a clear spec for v1.2.0 (or v2.0.0 if the contract changes).
4. Build the new artifact reading from the verified backend (state store JSON, Tasks DB, Wins DB — IDs in this doc).
5. Replace v1.1.2 only after the new build passes a visual check against the known display bugs.

## Reference IDs (paste-ready)

```
State page:        37478f3d-415b-814c-8c65-dd76b6ab9aa3
Tasks DB:          8bbc2654-2cf8-4ad8-bad0-1f3e2cb8b503
Tasks data source: collection://fb432308-59b9-4078-92db-a83c6279957d
Wins DB:           2bd8854a-8fbd-41ba-b464-efa3c6ab26f6
Wins data source:  collection://f99a9128-9809-48b9-9cb6-870717bd5183
Workspace root:    27268b77-7a95-4cd0-a94c-82bb12188b9a
```
