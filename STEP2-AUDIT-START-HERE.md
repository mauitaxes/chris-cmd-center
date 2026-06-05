# Command Center — Step 2: Silent-Write-Failure Audit (Handoff)

**Purpose:** Step 1 is done — live writes from a normal browser DO persist to Notion (evidence below). This task is the real work: hunt for write paths that can fail **invisibly** (app shows "saved," Notion never updates), and fix the genuine ones. Reliability hardening, not new features.

**Run this in a fresh task.** It is self-contained. Read it top to bottom; do not read the whole app end-to-end. Prior context: `BRIDGE-LIMITATION-HANDOFF.md` (the parent doc — this supersedes its Step 1).

---

## Step 1 result (verified 2026-06-05 — do NOT redo)

Confirmed by reading Notion directly after Chris created test items in a **normal browser** (not Cowork):

| Action | Write path exercised | Persisted in Notion? |
|---|---|---|
| Logged "06/05/2026 Test Win for review by Claude" | create-page + date prop | ✅ dated 2026-06-05 |
| Brain dump → promoted to task "Test Task through brain dump for Claude Review" | create-page (promote chain) | ✅ in Tasks DB, Area="Claude Tasks", Created 2026-06-05 |
| Marked that task complete | property write (Done checkbox) | ✅ `Done = "__YES__"` stuck |

**Verdict: the "writes only sync inside Cowork" limitation is RESOLVED on the happy path.** The full chain (capture → promote → mark done) survived end-to-end via the Netlify proxy. What remains unproven is the *failure* path — the focus of this audit.

---

## What this audit must answer

1. **Which writes can fail silently** (proxy returns 400/500, or encodes a prop wrong) while the UI still shows success?
2. For each: is it a real, reachable bug or theoretical?
3. Highest-value fix first: **stop swallowing write errors** so a lost edit is never shown as saved.

Deliverable: a short findings doc (gap → why it fails → severity → fix), then — only for real gaps — a phased plan via `superpowers:writing-plans`, implemented + tested + committed for Chris to push.

---

## The six suspect areas (check each; rank by real-world reachability)

1. **Swallowed `.catch()` on background writes (likely highest value).** `runDailyReset()` and several writes in `src/app.b.js` fire `saveState(...)` / per-routine clears un-awaited with `.catch(function(){})`. If the proxy 400/500s (bad/expired token, rate limit, unsupported op), the app reports success while Notion never updated. **Probable fix: surface failures** — demote the status pill, toast an error, and/or queue to the pending-ops overlay for retry.

2. **Proxy schema completeness (`DS_SCHEMAS`) — most probable concrete bug.** `mcpPropsToRest()` resolves a prop's type as `schema[key] || PROP_TYPES[key] || "rich_text"`. Any prop missing from both maps **silently encodes as rich_text** → Notion type error or mis-write. Enumerate every prop the client writes and confirm each resolves to its true type in the proxy:
   - Tasks: Done (checkbox), Priority (checkbox), Area (select), Energy (select), Time Estimate (select), Due Date (date), Created (date)
   - Routines: Done Today (checkbox), Last Done (date), Streak Count (number), Order (number)
   - Wins: Win (title), Date (date)
   - Capture: Processed (checkbox)
   - Focus Sessions: Minutes (number), Type (select)
   Cross-check against the verified schemas: Tasks/Wins schemas are captured in memory `command-center-backend.md`; re-fetch Routines/Capture/Focus data sources if needed (IDs below).

3. **Pending-ops replay.** Offline (proxy unreachable → `app.mode="snapshot"`), writes queue in the `cc_v120_local` overlay. Verify `flushPending()` replays them **through the proxy** on next live boot, and that create/promote/delete/capture all queue. **Known flag from prior review: `deleteCapture` does NOT queue an op when offline** → an offline delete reappears on reload. Confirm and fix.

4. **State-page content write round-trip (single most important write).** `saveState()` rewrites the entire State JSON via `update_content` (holds `lastResetDate`, `taskIds`, streak, `focusMinutesToday`, `databases` map). Confirm the proxy's `update_content` branch preserves the "Do not edit by hand" code block (no drop/duplicate) and that concurrent reads see consistent JSON.

5. **Cold-start / latency / CORS.** First request after idle is slow; confirm `boot()`'s `waitBridge`/live-load timeout is generous enough that a cold function doesn't spuriously demote to snapshot. Confirm CORS headers on the function response.

6. **Token failure mode.** If `NOTION_TOKEN` is unset/expired: today likely a silent demote to snapshot with edits that look saved but aren't. Decide + implement the desired UX (visible "not saving to Notion" state).

---

## Likely fixes, priority order (implement only for confirmed gaps; YAGNI)

1. Stop swallowing write errors → failed proxy write visibly demotes to "saving locally" + queues for retry.
2. Complete `DS_SCHEMAS` so every written prop encodes to its true Notion type.
3. Fix offline `deleteCapture` to queue a pending op like promote/add.
4. Anything else the audit proves actually doesn't persist.

---

## Constraints & mechanics (don't relearn the hard way)

- **Canonical build = Netlify `dist` only.** Source is split: `src/app.a.js` (helpers/state/logic) + `src/app.b.js` (render/wire/boot) + `src/index.html` + `src/styles.css`. Build: `node cc-build.js` → `dist/index.html`. Build **aborts if any `src` input >40KB** (mount-truncation guard) — keep files under that.
- **READ files with the Read tool, not bash** — the bash mount serves stale/partial copies of file-tool writes. Use bash only for `node`/`git`/builds. If editing from bash, re-author via a Python patch script with assert-checked replacements, then rebuild.
- **Tests:** `node --test cc-data.test.js` (60) and `node --test tests/*.test.mjs` (17, proxy). **Keep test files OUT of `netlify/functions/`** — Netlify bundles every file there as a function; a top-level `await import` broke the bundler once.
- **Sandbox cannot reach github.com.** Commit locally; **Chris runs `git push`** → Netlify auto-rebuilds https://chris-cmd-center.netlify.app. Repo: `mauitaxes/chris-cmd-center` (private).
- **`NOTION_TOKEN` is a Netlify env var only.** Never in repo, client JS, or memory. Entering the secret is Chris's action.
- **Usage-aware:** flag usage-heavy passes up front so Chris can manage quota.

## Key files

- `src/app.a.js` — `call()` router + `T` op map (proxy vs Cowork bridge)
- `src/app.b.js` — `boot()`, `runDailyReset()`, `saveState()`, `flushPending()`, write call sites with `.catch()`
- `netlify/functions/notion-proxy.js` (~306 lines) — allowlist, `mcpPropsToRest()`, `encodePropsToMcp()`, `DS_SCHEMAS`, `PROP_TYPES`, `update_content` branch
- `tests/notion-proxy.test.mjs` — 17 proxy tests

## Verified Notion IDs

- **State page:** `37478f3d-415b-814c-8c65-dd76b6ab9aa3` — single JSON code block; `lastResetDate`, `taskIds`, streak, `focusMinutesToday`, `databases` map.
- **Tasks DB:** `8bbc2654-2cf8-4ad8-bad0-1f3e2cb8b503` · ds `collection://fb432308-59b9-4078-92db-a83c6279957d`
- **Wins DB:** `2bd8854a-8fbd-41ba-b464-efa3c6ab26f6` · ds `collection://f99a9128-9809-48b9-9cb6-870717bd5183`
- **Routines DB:** `7d25349f-a714-42ac-85c6-4410fa22aeed` · ds `collection://17f7f036-e24c-40ce-9d41-db5d8a66b618`
- **Capture DB:** `67883e1b-8bb7-4213-8781-255a0f45b5ac` · ds `collection://35ba4e31-eca6-4ab7-8625-acc41d5341e8`
- **Focus Sessions DB:** `6d17e2eb-f84a-4546-8389-d517968000d3` · ds `collection://291cb585-746e-4195-a920-b0ac460fbbf6`
- Checkbox writes use `"__YES__"`/`"__NO__"`; date props expand to `date:{Prop}:start`.

## Deliverables

1. Findings doc: per-gap (what silently fails / why / severity).
2. Phased plan for confirmed gaps (writing-plans).
3. If approved: implemented + tested fix, committed, ready for Chris to push.
