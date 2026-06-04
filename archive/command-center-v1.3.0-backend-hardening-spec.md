# Command Center — Backend Hardening Design Spec

**Version target:** appVersion `1.3.0` (hardening release; State JSON schema stays `2.0.0`)
**Date:** 2026-06-03 · **Owner:** Chris (Hawaii / HST)
**Supersedes the open questions in:** `HANDOFF-backend-hardening.md`
**Process:** superpowers — brainstorming (done) → this spec → writing-plans → TDD → verification.

---

## 1. Decisive finding that shapes everything

The live bridge (`window.cowork.callMcpTool`) **is functional in the current build.** Verified on 2026-06-03: a win logged from the artifact UI ("Bridge Test - Did this work for you Claude?") landed in the Notion Wins database at 21:01 HST. The earlier "callMcpTool missing" finding was stale — most likely the prior build hadn't declared the Notion tools when it was registered as a Cowork artifact.

**Consequence:** we design **live-first.** The snapshot is demoted from "primary fallback" to "cold-start placeholder." The handoff's "assume no bridge" branch is retired as the primary model but retained as a graceful degradation path (offline buffer), not a separate architecture.

---

## 2. Goals and non-goals

**Goals**

- Make the data layer iron-tight: complete reads, durable writes, concurrency-safe State, no blank-render under any load order.
- A clear, documented cross-device model (home + office) with reconciliation behavior.
- A lightweight verification harness so future changes can't silently regress the data layer.
- Storage hygiene: project files stay in this project folder; the runtime artifact lives in Google Drive, not OneDrive.

**Non-goals**

- No new end-user features (no new panels, no new ADHD tools). This is hardening only.
- No State schema *version* bump (stays `2.0.0`). Additive, optional fields (e.g. `routineIds`) are allowed within `2.0.0`; no breaking changes to existing fields. Write *mechanics* change, field meanings do not.
- No redesign of the visual layer.

---

## 3. Architecture — live-first with cold-start snapshot

Boot sequence:

1. Render the embedded snapshot immediately. Dashboard is never blank.
2. Confirm the bridge (already proven; keep a short poll for timing safety, ~3–5s is now sufficient since the bridge is real).
3. On bridge present → enter **live mode**: flush any queued local edits to Notion, then do a full live read, then re-render.
4. On bridge absent (rare/offline) → stay in **snapshot mode**: edits accumulate in `localStorage` and flush on the next successful connect.

State machine: `snapshot → live` (normal) or `snapshot → snapshot` (offline). `live → snapshot` only on a hard live-load failure, surfaced in the status pill.

---

## 4. Read contract

**Tasks (must be complete):** pinned `taskIds` in State + `notion-fetch` by page ID. This is the only path that returns full properties (Done, Priority, Area, Due, Energy, Time Estimate) with no dropped rows. Keep it.

**Routines (must be complete):** move to the same pinned-ID model. Add a `routineIds` array to State (populated/curated by the 6am task) and fetch each by ID, so the morning routine never depends on ranked/capped semantic search. Until `routineIds` exists, fall back to the current search enumeration.

**Wins and Capture (capping acceptable):** keep `notion-search` enumeration, but sort deterministically (Wins by date desc; Capture by captured date desc) and cap explicitly. These are display-only lists where a capped tail is harmless.

**Parsing:** keep the existing `unwrap()` / `deepText()` / `toObj()` / `parseProps()` normalizers. Validate them against captured real response samples (see §8). Every parse failure must be observable (counter + diagnostic), never a silent empty.

**Read assertion:** after a live read, assert `tasks.length === taskIds.length` (and likewise for routines once pinned). A shortfall flags a parse/fetch problem in the diagnostic rather than silently showing fewer rows.

---

## 5. Writes — durable and concurrency-safe

**Per-field property writes** (task Done, Priority, routine Done Today, add task, log win, capture, focus log): already functional via `notion-update-page` / `notion-create-pages`. Last-write-wins per field is acceptable; these are not contended. Keep, but route every write through one wrapper that (a) applies optimistically to the UI, (b) queues to `localStorage`, (c) writes live when connected, (d) dequeues only on confirmed success.

**State JSON write (the fragile one):** today it does `update_content` with an exact `old_str` match of the entire current JSON string. Two machines, or the 6am task overlapping a manual change, can break the match and silently drop the write. Replace with **read-modify-write + retry**:

1. Re-read the State page immediately before writing.
2. Parse the current JSON, merge the field-level change into it.
3. Replace the fenced ```json block by anchor (match the code-fence boundaries, not the exact prior bytes).
4. Write. On mismatch/conflict, re-read and retry once. On repeated failure, keep the change queued in `localStorage` and surface it in the diagnostic.

State is small and field-merged, so a re-read-before-write race is acceptable and avoids clobbering a concurrent machine's unrelated fields.

**Offline → online flush:** the queue in `localStorage` is replayed in order on connect, each op idempotent where possible (e.g., set-Done-true is naturally idempotent; add-task uses a temp ID swapped for the real page ID on success). Flush is tested explicitly (§8).

---

## 6. Cross-device model (home + office)

- **Notion is the single source of truth.** Both machines are authenticated (confirmed). In live mode both read/write the same State page and DBs, so they converge automatically — no data files to sync between machines.
- **`localStorage` is per-device and transient only.** It buffers edits made while offline and flushes on reconnect. Rule: a stale snapshot or local buffer must never overwrite newer Notion truth — flush is additive/field-level, and a full live read always replaces local display state after flush.
- **The only cross-device artifact is the registered Cowork artifact** (the HTML + its bridge). Both machines must have it. How it gets there is the deployment question in §7.
- **Scheduled task placement:** the 6am brief runs wherever the app/agent runs it. To avoid double-runs, it is idempotent for a given HST date — guarded by `routineResetDate` / `lastStreakDate` so a second run the same day is a no-op.

---

## 7. Storage and deployment

- **Project files** (this spec, mockups, source HTML, handoffs, the xlsx export) **stay in the current project folder**: `Command Center Artifact`. They do not need to roam.
- **Runtime artifact moves to Google Drive**, not OneDrive. The current Cowork registration points at a OneDrive path.
- **Open deployment task (resolve in writing-plans):** determine whether the Cowork artifact registration can be pointed at a Google Drive folder, or whether we deploy/open a Google-Drive-hosted copy. Confirm that opening the artifact on each machine provides the bridge (the bridge comes from the Cowork artifact viewer, not from `file://`). This is the one genuine unknown; it is a planning/spike task, not a blocker for the data-layer work.

---

## 8. Verification harness (the "iron-tight" guarantee)

A lightweight, repeatable harness — runnable by the agent on demand and optionally as a scheduled check — that proves the data layer end-to-end with evidence:

1. **Read completeness:** fetch all pinned `taskIds` (and `routineIds`), assert counts and that each parsed row has the expected properties. Capture and store a real response sample per shape for the parser tests.
2. **Write round-trip:** for each write type, write a sentinel value to Notion, re-read by ID, assert it landed, then revert. (Task Done toggle, Priority toggle, routine Done, add+delete task, add+delete win, add+delete capture, focus log.)
3. **State write safety:** simulate an overlapping edit (write field A, then a stale-based write of field B) and assert neither clobbers the other after the retry path.
4. **Offline flush:** seed a `localStorage` queue, simulate connect, assert every op lands in Notion and the queue clears.
5. **No-blank invariant:** assert the snapshot renders with the bridge forced absent and forced slow.

Output is a short pass/fail report with the captured samples. This is what lets future changes be checked rather than assumed.

---

## 9. Acceptance criteria (mapped from handoff §7)

- [ ] Bridge availability answered definitively — **DONE: functional**; architecture is live-first.
- [ ] Every read path returns complete, correctly-parsed data with no silent row drops, demonstrated with captured samples (§4, §8.1).
- [ ] Every write is durable and verified to land in Notion, with a tested offline→online flush (§5, §8.2, §8.4).
- [ ] State writes survive concurrent/overlapping edits without corrupting the JSON (§5, §8.3).
- [ ] Documented cross-device model with reconciliation behavior, validated on both machines (§6).
- [ ] A verification harness exists so future changes can't silently regress the data layer (§8).
- [ ] No blank-render failure mode under any load order or bridge timing (§3, §8.5).
- [ ] Runtime artifact hosted in Google Drive; project files remain in this folder (§7).

---

## 10. Risks and mitigations

- **Bridge timing flakiness:** mitigated by the snapshot cold-start + short poll; live load failure degrades to snapshot, never blank.
- **Google Drive registration may not be directly controllable by Cowork:** mitigated by treating it as a spike; if it can't be relocated, fall back to a documented manual deploy of the artifact to both machines.
- **Semantic-search capping on Wins/Capture:** accepted (display-only); Tasks and Routines avoid it entirely via pinned IDs.
- **State retry still conflicts under rare simultaneous writes:** mitigated by field-level merge + queue persistence; worst case the edit stays queued and flushes on next connect.

---

## 11. Out of scope / explicitly deferred

- Enumeration-by-query (`query_data_sources`) is not exposed by this MCP; not pursued. Pinned IDs are the contract.
- No migration of historical data; backend is already seeded.
- No visual or feature changes.
