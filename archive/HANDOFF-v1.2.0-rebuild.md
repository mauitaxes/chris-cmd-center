# Command Center v1.2.0 — Rebuild Handoff

**Date:** 2026-06-03 · **For:** fresh context window · **Owner:** Chris (Hawaii time)

## Goal
Rebuild the Command Center Cowork artifact (currently v1.1.2, has display bugs) into v1.2.0. Clean rebuild against the existing Notion backend — not a patch. Primary goal: **ADHD management + task orientation.** Chris uses the task list heavily and wants to expand on it. Visual style must follow the "InsAIts Runtime AI Security Monitor" aesthetic: dark navy/black background, neon cyan brand, monospace font, circular gauges, stat cards, alert-style feed.

## Decisions made this session
- **Layout direction: DASHBOARD version** (gauges + stat cards lead). Chris picked this over the task-focus layout.
- **Open question to resolve first:** Chris asked *"the dashboard version still has a task list window — how would that look?"* → Next session should mock up / refine the task-list panel **inside** the dashboard layout, expanded for heavy daily use, before building the full artifact. He wants the task list to be a strong, prominent panel, not a thin feed.
- ADHD-support mechanics to fold in (from the task-focus mockup): one-thing-now / single next action with "frog" marker, focus/pomodoro timer, quick-capture brain dump, WIP limit, energy + time-estimate tags, visible streak + wins for dopamine.

## Mockups already built (in this folder)
- `command-center-mockup.html` — **the chosen dashboard direction.** Top bar (Live/synced pills, clock, version badge, Brief/Export/Sync buttons), tabs (Today/Tasks/Wins/Routine), 3 neon gauges (Streak / Today's Progress / Week Completion), 3 stat cards (Open Tasks / Wins / Areas), a Momentum Score hero, and a "Today's Focus" task feed + Recent Wins + Routine Reset. **The task feed here is what needs to be expanded into a fuller task-list window.**
- `command-center-tasks-mockup.html` — task-focus layout (NOT chosen, but mine the task-list UI, focus timer, quick capture, and one-thing-now panel from it).

Style tokens (already in both files): bg `#070b11`, panel `#0d141d`, line `#1b2733`, cyan `#2ee6e6`, red `#ff3b5c`, amber `#ffb020`, green `#2bdd7e`, purple `#9b7bff`, font JetBrains Mono (Google Fonts) w/ Consolas/monospace fallback. SVG ring gauges: r=50, circumference ≈314, offset = 314 × (1 − pct).

## Next steps
1. Refine the **task-list window inside the dashboard layout** (answer Chris's open question) — show it expanded: priority, area, due, energy, time-estimate, inline complete, quick-add. Get his sign-off on that panel.
2. Then build the full v1.2.0 artifact via `mcp__cowork__create_artifact` (it's a live HTML page that re-pulls from connectors on open).
3. Wire to the Notion backend below. Replace v1.1.2 only after a visual check against the dashboard mockup.

## Notion backend (verified, paste-ready)
```
State page:        37478f3d-415b-814c-8c65-dd76b6ab9aa3   (JSON code block: {"streak","taskIds","wins","routineResetDate","lastCompleted"})
Tasks DB:          8bbc2654-2cf8-4ad8-bad0-1f3e2cb8b503
Tasks data source: collection://fb432308-59b9-4078-92db-a83c6279957d   (props: Task, Area, Done, Priority, Notes, Created, Due Date)
Wins DB:           2bd8854a-8fbd-41ba-b464-efa3c6ab26f6
Wins data source:  collection://f99a9128-9809-48b9-9cb6-870717bd5183   (props: Win (title), Date)
Workspace root:    27268b77-7a95-4cd0-a94c-82bb12188b9a
```

## Open backend questions (carry over from prior handoff, confirm with Chris)
1. Exact v1.1.2 display-bug symptoms.
2. Rebuild read logic: direct page fetch by ID vs data-source query (replace old search-based read that made the 6am brief thin).
3. Streak rules: how `routineResetDate` advances; what counts as a completion that updates `lastCompleted` / increments `streak`.
4. Is the 6am brief generated inside the artifact on open, or a separate scheduled task (which would also need updating)?
5. Connectors: artifact uses Notion only today — confirm if v1.2.0 should also pull QuickBooks/Calendar/Gmail/etc.

## Full prior context
See `COMMAND CENTER REBUILD - HANDOFF.md` in this same folder for version history and original backend notes.
