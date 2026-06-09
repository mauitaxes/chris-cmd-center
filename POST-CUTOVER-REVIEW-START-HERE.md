# Command Center — POST-CUTOVER REVIEW (new window, START HERE)

**Written 2026-06-08, immediately after the Phase 2 cutover to `main` succeeded; updated same night
with Chris's decisions.** Production is LIVE on the interactive-Todoist build. This doc hands off
three items Chris raised during the post-deploy smoke test. **Chris's decisions are now LOCKED in
each section below — read them before acting.**

> **⚠️ MOCKUP-FIRST RULE (Chris's standing instruction for this changeset):** for the **layout work
> (#2)**, produce a **visual mockup for Chris to approve BEFORE writing any code**. Do not touch
> `index.html`/`styles.css` until he signs off on the mockup. (#1 is a trivial text change and can
> ship directly tonight.)

**Tonight's scope:** #1 only (version pill + subtitle). #2 = mockup tonight, code after approval.
#3 = deferred to a later changeset.

---

## 0. Where things stand (DONE — do not redo)

- **Cutover complete.** `feat/todoist-phase1` merged `--no-ff` into `main` and pushed:
  **`0936e8b..d32e95d  main -> main`**. Pre-flight commit `d3da0d4` (.gitignore + `.worktrees/`).
  Merge = 34 files, +5060/−46, zero conflicts (`ort` strategy).
- **Netlify rebuilt prod from `d32e95d`.** Live at https://chris-cmd-center.netlify.app.
- **Smoke test PASSED (both critical items):**
  - **Calendar ✅** — Schedule·Today card shows the real `2:00 PM Hiromoto Tax planning` event
    (matched against a direct Google Calendar read). This proves the `GOOGLE_REFRESH_TOKEN`
    authenticates through the deployed `calendar-proxy` function — the ONE item only testable post-deploy.
  - **Todoist ✅** — a due-today test task appeared on dashboard + task list and disappeared from both
    on completion in Todoist; a priority-only test task correctly persists. Interactive loop confirmed
    against real Todoist.
- **Rollback (still available, unused):** `git revert -m 1 d32e95d` + push, or Netlify
  "Publish deploy" on `0936e8b`. Notion render code is hidden, not deleted; Notion DBs untouched.
- **Two test tasks remain in Todoist** (one completed, one open priority "Test task for smoke test,
  not due but") — Chris can clear at leisure; harmless.

---

## 1. Version pill → 2.0.0 (SemVer)  —  EFFORT: LOW (~10 min)

**Current:** top-right pill reads `V1.5.0 / NOTION BACKEND`.

**Ask:** bump to `2.0.0`. A major bump is the correct SemVer call — Phase 2 is a breaking
architecture change (Todoist replaced Notion as the interactive task backend).

**Claude's read:**
- The version string is a static label baked into the build: `src/index.html` → compiled to
  `dist/index.html` by `cc-build.js`. (Confirm exact location on execution; likely a `<span>`/pill
  element near the header. `git grep "1.5.0"` and `git grep "NOTION BACKEND"` to find all refs.)
- **Secondary issue:** the `NOTION BACKEND` subtitle is now inaccurate — tasks/today are Todoist;
  Notion only backs Wins/Routines/Focus/Daily Log. Re-label it in the same edit.
- Process: edit `src/`, run `node cc-build.js` (regenerates `dist/index.html`), `node --test`
  (expect green), commit, `git push origin main` → Netlify auto-deploy.

**✅ CHRIS'S DECISION (LOCKED): DO TONIGHT.** Bump pill to **2.0.0** AND fix the inaccurate
"NOTION BACKEND" subtitle — both, this session. Ship directly (no mockup needed for a text change):
edit `src/`, `node cc-build.js`, `node --test` (expect green), commit, `git push origin main`.
- **Subtitle text:** propose the new label in your tonight summary and use the best fit unless Chris
  objects — recommended `TODOIST · NOTION` (concise, accurate: Todoist = tasks, Notion = wins/routines/focus).
  Alternatives if preferred: `HYBRID BACKEND` / `TODOIST · CALENDAR · NOTION`.
- If a separate internal version constant exists (`git grep "1.5.0"`), bump it to `2.0.0` too so the
  pill and the code agree.

---

## 2. Task list + Calendar side-by-side under the momentum counter  —  EFFORT: MEDIUM (layout only, no backend)

**Current layout (Today tab, below the Momentum/6AM-Brief band):** a 2-column grid —
- LEFT column: the `TODAY` task list, with the `SCHEDULE · TODAY` (calendar) card **stacked
  underneath** it.
- RIGHT column: Focus Session + Quick Capture (Brain Dump) + Log a Win + recent Wins.

**Ask:** get the **task list and calendar side-by-side** (tasks | calendar) directly under the
momentum counter.

**Claude's read:**
- Pure presentation change — `src/index.html` structure + `src/styles.css` grid rules. No proxy /
  data changes.
- The real design decision is **where the right-column panels (Focus / Capture / Win / Wins) go** once
  the calendar moves up beside the tasks. Three candidate layouts:
  - **(A) Two rows:** Row 1 = `tasks | calendar` (50/50). Row 2 = Focus / Capture / Wins across full width.
  - **(B) Three columns:** `tasks | calendar | (Focus+Capture+Wins stacked)`.
  - **(C) Tasks wider:** Row 1 = `tasks (60%) | calendar (40%)`, Focus/Capture/Wins below.
- Responsive behavior (narrow window → stack) needs a quick check after.
- Effort is medium mostly because of reflow + making sure the calendar card's preview/empty states
  still look right in a narrower column.

**✅ CHRIS'S DECISION (LOCKED): LAYOUT A — but MOCKUP FIRST.**
- **Structure:** under the momentum/6AM-brief band →
  - **Row 1:** `task list | calendar` side-by-side.
  - **Row 2 (full width, below):** **Focus Session, Quick Capture (Brain Dump), and Log-a-Win/Wins
    stacked HORIZONTALLY** (side-by-side across the full width) under the tasks+calendar row.
- **Width split for Row 1:** not specified — propose one in the mockup (suggest 60/40 tasks:calendar,
  task list is the denser content). Chris confirms on the mockup.
- **🚫 DO NOT CODE YET.** Build a **visual mockup** (static HTML mock or annotated image) showing Row 1
  + Row 2 and the Row 1 split, and get Chris's approval BEFORE editing `index.html`/`styles.css`.
  Only after sign-off: implement, `node cc-build.js`, `node --test`, check responsive/narrow stacking,
  commit, push.

---

## 3. The "200% — 8 of 4 planned done" progress gauge  —  EFFORT: SPLIT (band-aid trivial / real fix = next phase)

**Current:** Today's Progress gauge shows **200%**, label `8 OF 4 PLANNED DONE`.

**Claude's read (NOT a cutover regression — this is tracked caveat #3 from the merge doc):**
- The gauge is **display-only and Notion/nightly-derived** — it was never repointed to Todoist. The
  numerator (completed-today) is overshooting a **stale denominator** ("4 planned") that has no real
  definition.
- **Two tiers of fix:**
  - **Band-aid (TRIVIAL):** clamp the gauge at 100% and/or relabel so it can't read 200%. Cosmetic,
    ~15 min, but doesn't make the number *meaningful*.
  - **Real fix (NEXT-PHASE = Task 7/8):** define what "planned" means as a denominator, and repoint
    the numerator to **`find-activity`** (per the CP3 finding — recurring completions only show up in
    `find-activity`, not `find-completed-tasks`). This also unblocks the streak go-live.
- **The blocker is a design decision, not code difficulty:** what counts as the day's "plan"?
  Candidates: tasks due today, a fixed daily target (e.g. 3), tasks tagged `today`, or a
  user-set goal. Until that's decided, only the band-aid is safe.

**✅ CHRIS'S DECISION (LOCKED): DEFER.** Leave the gauge as-is for now — handle in a **later change
set**, not this one. Do NOT band-aid or repoint it tonight. The denominator definition + Task 7/8
(progress + streak go-live) decision happens later. Documented here only so it isn't forgotten.

---

## 4. This change set — order of operations

1. **#1 version pill + subtitle → DO TONIGHT.** Bump to `2.0.0`, relabel "NOTION BACKEND"
   (recommended `TODOIST · NOTION`). Trivial text edit → build → test → commit → push. Ships directly.
2. **#2 layout → MOCKUP TONIGHT, code after approval.** Layout A (tasks|calendar row, then
   Focus/Capture/Wins horizontal full-width row). Show Chris a mockup + proposed Row-1 width split;
   **wait for sign-off before any `index.html`/`styles.css` edit.**
3. **#3 progress gauge → DEFERRED.** Not in this change set.

> **Mount/git caution (unchanged):** run all git ops in **PowerShell** from the PRIMARY worktree
> `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact`. The bash/Linux mount is
> stale, shows a phantom `.git\index.lock`, and truncates files ~44 KB — use it only for read-only
> `node`/`git log`/builds; READ source with the editor. Keep every `cc-build.js` input <40 KB.
