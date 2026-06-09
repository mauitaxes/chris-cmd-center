# Command Center — Step 2: Silent-Write-Failure Audit (Findings)

**Date:** 2026-06-05 · **Scope:** read-only audit, no code changed this session.
**Method:** three parallel read-only subagents, one per file cluster, covering the six suspect areas.
**Status:** AUDIT COMPLETE — awaiting Chris's go before any plan/fix.

> Line numbers below are from the subagents' reads and are **approximate** — exact locations get re-confirmed at fix time. Severities use: **Critical** = can silently lose a user's write; **High** = silent loss in a reachable but narrower path; **Medium** = correctness/robustness risk; **Not-a-bug** = checked, fine.

---

## Confirmed real gaps (ranked)

### 🔴 CRITICAL

**C1 — State-page save can corrupt/lose state silently (area 4).** `saveState()` updates `app.state` in memory *before* the Notion `update_content` write, and there is no post-write validation that the State JSON code block is still readable. A failed or partial PATCH (network drop, proxy timeout) leaves the page's JSON stale or mangled while the app believes it saved; next boot fails to parse and falls back, silently dropping `lastResetDate`, `streak`, `focusMinutesToday`, `taskIds`. Reachable on every task-done / win / focus log.
*Fix direction:* validate fetched block parses before merge; re-fetch/verify after write; don't treat `app.state` as committed until the write confirms.
*Refs:* `app.a.js` ~207–223 (saveState), `notion-proxy.js` ~209–222 (update_content branch).

**C2 — Token unset/expired demotes to "saved locally" and never recovers (area 6).** If `NOTION_TOKEN` is missing (proxy 500) or revoked (401), `boot()` catches the error and demotes to snapshot mode showing *"offline snapshot · changes saved locally."* The user keeps editing believing writes are queued for Notion; they sit in the local overlay and are never flushed while the token stays bad. No distinct "not saving to Notion" state, no retry/reconnect affordance. **Permanent silent loss.**
*Fix direction:* distinguish *offline* (network/50x/timeout) from *not-configured* (500 "server not configured") from *auth-expired* (401); show a real "Notion not saving — reconnect" state instead of the reassuring "saved locally" copy.
*Refs:* `notion-proxy.js` ~282–284, `app.a.js` ~281–283 (boot fallback), `flushPending` swallow ~204.

**C3 — Offline `deleteCapture` doesn't queue → deleted item reappears (area 3). CONFIRMED.** `deleteCapture()` removes the cap from `app.caps`, re-renders, and toasts "Deleted", but only writes to Notion when `app.mode==="live" && capId`. There is **no `lsPush()`**, so an offline delete (or null capId) is never queued; `applyLocal()` has no delete handler, so on reload the cap returns from Notion. User thinks it's gone.
*Fix direction:* queue a pending delete/Processed op like promote/add does.
*Refs:* `app.b.js` ~266–270 (deleteCapture), `applyLocal` ~149–160.

### 🟠 HIGH

**H1 — `runDailyReset()` routine clears swallow all errors (area 1).** Each routine's `"Done Today":"__NO__"` clear fires un-awaited with `.catch(function(){})`. On 400/500/expired-token the clear fails silently; the routine's Done-Today persists in Notion and reappears tomorrow, while the UI implies success.
*Fix:* surface failures (DIAG + toast), retry once, or queue to pending-ops.
*Ref:* `app.b.js` ~265.

**H2 — Daily report append swallows errors (area 1).** `pushReportToNotion()` (Capture append in `runDailyReset()`) is un-awaited with an empty `.catch()`. On failure the daily summary is lost with no indication.
*Fix:* await + log failures, or queue.
*Ref:* `app.a.js` ~85, called from `app.b.js` ~252.

**H3 — Routines `Active` prop silently encodes as rich_text, not checkbox (area 2). CONFIRMED mis-encode.** Client writes `{Active:"__YES__"/"__NO__"}` to Routines, but `Active` is missing from `DS_SCHEMAS[Routines]` and `PROP_TYPES`, so `mcpPropsToRest()` falls through to `rich_text` and sends the literal string `"__YES__"` instead of a boolean checkbox → Notion type mis-write. This is the *only* prop of the full written set that mis-resolves; all others (Tasks/Wins/Routines/Capture/Focus) check out correctly.
*Fix:* add `Active: "checkbox"` to the Routines entry in `DS_SCHEMAS`.
*Ref:* `notion-proxy.js` ~line 22 (DS_SCHEMAS Routines), client write `app.a.js` ~114.

**H4 — Offline `promoteCapture` orphans the source capture (area 3).** Promote queues the new `taskAdd` op but never queues clearing the source cap's `Processed`. Offline, the cap stays unprocessed locally and in Notion while the task is created → duplicate/inconsistent state on reload.
*Fix:* queue the cap's Processed write alongside the promote.
*Ref:* `app.b.js` ~252–265.

### 🟡 MEDIUM

**M1 — `saveState()` mutations not queued offline (area 3/4).** State changes (streak, lastCompleted, focusMinutesToday) mutate memory but only write when live; nothing is queued offline, so offline state edits can drift from Notion.
*Fix:* fold into the C1/C2 fix — queue state writes or block "saved" claims when not live.

**M2 — "Do not edit by hand" guard not explicitly preserved (area 4).** The JSON-fence replace regex doesn't anchor the surrounding human-facing comment; if page markdown is ever malformed the guard text could drop. Cosmetic/secondary to C1.
*Fix:* preserve full surrounding markdown when replacing the fence (covered by C1 hardening).

### ⚪ Checked — NOT bugs

- **Cold-start timeout (area 5):** `waitBridge(5000)` (5s, polled 250ms) is adequate for cold Netlify; demotion is graceful. No spurious snapshot demote from latency alone.
- **CORS (area 5):** Headers present and correct on *all* proxy response paths including every error branch (405/500/400/200/catch); same-origin check is sound. No silent CORS failure.
- **Schema completeness (area 2):** Every written prop *except* `Active` (H3) resolves to its correct Notion type.
- **`flushPending()` replay (area 3):** Confirmed it replays queued ops through the proxy on next live boot; task/prio/routine toggle, taskAdd, capture, win, focus all queue correctly. Only deleteCapture (C3) and promote-clear (H4) are missing.

---

## Proposed fix groupings (for the Segment-2 plan, when you approve)

1. **Stop swallowing write errors / honest sync state** (C2, H1, H2, M1) — central "did this actually persist?" path: demote visibly, queue, retry, distinguish token states.
2. **State-page write integrity** (C1, M2) — validate-before-merge + verify-after-write.
3. **Offline queue completeness** (C3, H4) — queue deleteCapture + promote-clear like other ops.
4. **Schema fix** (H3) — one-line `Active: "checkbox"` add + a proxy test asserting it.

All four are "all confirmed gaps" per your call. Nothing theoretical included.

---

## ⚠️ Plan-phase corrections (2026-06-05, after direct source read)

Found while writing `STEP2-FIX-PLAN.md` — these supersede the findings above where they conflict:

1. **H3 is a FALSE POSITIVE.** `Active: "checkbox"` IS in `DS_SCHEMAS` for Routines (`notion-proxy.js:22`). The subagent misread. No proxy change needed — H3 dropped.
2. **NEW CRITICAL — C4: `flushPending()` wipes the queue even when replays fail.** `app.a.js:194–206`: each replay swallows its error, then `lsClear()` runs unconditionally. A boot with bad token/unreachable proxy permanently destroys all queued offline edits. Worst confirmed bug; the earlier "flushPending CONFIRMED WORKING" only covered the success path.
3. **M2 downgraded to not-a-bug.** The proxy's `update_content` PATCHes only the code block (`notion-proxy.js:209–222`); other page content is never touched.

**Final fix list (in `STEP2-FIX-PLAN.md`):** C4, C2, C1+M1, C3, H4, H1, H2.

## Next step

Audit + plan complete. Segment 3 = execute `STEP2-FIX-PLAN.md` (implement + test + build + commit), then Chris pushes.
