# PHASE 2.2 — START HERE (resume point)

**Last updated:** 2026-06-04 (context window #6). Read THIS file to resume. It supersedes
`PHASE2.1-START-HERE.md`. The older `PHASE2-START-HERE.md` still holds the full proxy
contract + Notion IDs if you need them.

## TL;DR — Phase 2 is DONE and verified ✅
The Netlify-published site now reads **and** writes **live Notion** from a normal browser
(no Cowork bridge). All 6 steps of the Phase 2 plan are complete and were verified live on
2026-06-04. Site: **https://chris-cmd-center.netlify.app**

## What got finished this window (steps 3–6)
3. ✅ **Repo linked to the existing Netlify site.** `mauitaxes/chris-cmd-center` →
   Netlify project **chris-cmd-center** via Continuous deployment. Chris approved the
   GitHub OAuth. Build settings auto-detected from `netlify.toml` (publish `dist`,
   functions `netlify/functions`, branch `main`). URL preserved.
4. ✅ **`NOTION_TOKEN` env var set.** Secret variable, scoped to Builds/Functions/Runtime.
   Chris pasted the value himself (Claude never enters secrets).
5. ✅ **Deploy green + function bundled.** First auto-deploy FAILED (see fix below). After
   the fix, commit `aec93ec` published in 16s with **"1 function deployed"** (notion-proxy).
   `GET /.netlify/functions/notion-proxy` returns `{"error":"method not allowed"}` — i.e.
   the POST-only function is live.
6. ✅ **Live read + write verified.** Published site loads to status **LIVE**
   ("12 tasks · 7 routine steps · 14 wins" read from Notion via the proxy). Logged a win
   ("Phase 2 live Notion sync verified from browser"); it **persisted across a full reload**,
   proving the write reached Notion server-side, not just local cache.

## The one real bug we hit (and how it was fixed) — important context
The first deploy failed during **Functions bundling**:
> `Top-level await is currently not supported with the "cjs" output format` …
> `Bundling of function "notion-proxy.test" failed`

**Cause:** Netlify bundles *every* file in `netlify/functions/` as a deployable function,
including the unit-test file `notion-proxy.test.mjs` (which uses top-level
`await import(...)`).
**Fix:** moved the test to **`tests/notion-proxy.test.mjs`** and changed its import to
`../netlify/functions/notion-proxy.js`. 17/17 tests still pass. Committed as `aec93ec`.
Rule going forward: **keep test files OUT of `netlify/functions/`** — anything in that
directory is treated as a live function.

## Current file/repo state
- `netlify/functions/` now contains only `notion-proxy.js` + `package.json` (clean).
- Tests live at `tests/notion-proxy.test.mjs`. Run: `node --test tests/*.test.mjs`
  (the `node --test <dir>` glob-less form is broken on Node 22 — use the glob).
- GitHub `main` HEAD = `aec93ec`. Netlify auto-publishes from `main`.

## What's LEFT (small, mostly optional)
1. ⏳ **Make the GitHub repo private.** It's currently **PUBLIC** (no secrets in it, so
   safe — the token only lives in Netlify env). Chris wanted private: repo
   **Settings → General → Danger Zone → Change visibility**. Netlify deploys keep working
   after flipping (the GitHub↔Netlify app stays authorized).
2. ⏳ **Optional: second-device sanity check.** Persistence-across-reload already proves
   data is in Notion (any device hitting the URL sees the same state), but if Chris wants
   the belt-and-suspenders check: open the URL on phone/another profile and confirm the
   test win shows.
3. ⏳ **Optional cleanup:** delete the verification win "Phase 2 live Notion sync verified
   from browser" from Notion if Chris doesn't want it in his Wins log. Harmless if left.

## Environment gotchas to save re-deriving (still true)
- **Claude's Linux sandbox cannot reach github.com** and has no `gh` CLI — every `git push`
  must run from **Chris's machine** (repo folder:
  `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact`).
- **Stale bash cache:** the mounted folder can serve a stale/truncated per-file view in
  bash (a `git diff` showed `dist/index.html` "truncated" when the real file was intact).
  **Always verify file contents with the Read tool**, which shares the real Write path.
  Don't trust bash `cat`/`git diff` for files in this folder.
- Netlify integrations admin is on `app.notion.com` (separate login from `www.notion.so`)
  — relevant only if the Notion integration ever needs re-auth.

## First move next window
1. Skim this file. Confirm site is still LIVE: open https://chris-cmd-center.netlify.app
   and check the status pill reads **LIVE** with current Notion counts.
2. If Chris wants it done: walk him through flipping the repo to **private** (his click).
3. Otherwise Phase 2 is closed — pick up whatever's next on the Command Center roadmap.
