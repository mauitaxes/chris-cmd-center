# Deploy — Command Center

The canonical live build is **`dist/index.html`**, served at
**https://chris-cmd-center.netlify.app**. Deployment is git-based and automatic.

## How deploy works

- The GitHub repo **`mauitaxes/chris-cmd-center`** is this folder.
- Netlify is connected to that repo and **publishes the `dist/` folder on every push to `main`**.
- To ship a change: commit and push to `main`. Netlify rebuilds and republishes the same URL
  within a minute. There is no manual drag-and-drop step.

```
git add -A && git commit -m "your message" && git push
```

## What runs where (live Notion both ways)

Unlike older notes, the Netlify build is **not** local-only. It reads and writes **live Notion**:

- **On the Netlify URL (normal browser):** there is no Cowork bridge, so `call()` automatically
  routes Notion reads/writes through the serverless proxy at
  **`netlify/functions/notion-proxy.js`**. Tasks, wins, routines, captures, and focus sessions
  sync to Notion and across devices. The Notion token lives in **Netlify environment variables**
  as `NOTION_TOKEN` (server-side only — never shipped to the browser).
- **Inside the Cowork app:** the `window.cowork.callMcpTool` bridge is present and is used directly.
- **Offline / no network:** the app boots from its localStorage cache plus the embedded
  `SNAPSHOT`, and queues changes locally until the next successful sync.

## Files

- `dist/index.html` — the one self-contained build (inline CSS, inlined `CCData` data module,
  embedded `SNAPSHOT`, all UI/action JS). **This is the only runtime target.**
- `netlify/functions/notion-proxy.js` — the Notion read/write proxy used by the Netlify URL.
- `cc-data.js` + `cc-data.test.js` — unit-tested source of truth for the data layer; re-inlined
  into `dist/index.html` between the `/*__CC_DATA_START__*/` … `/*__CC_DATA_END__*/` markers.

## Build integrity — the stale/truncation safeguard (read this once)

The sandbox/bash mount that source files are read through is **unreliable**: large reads can
come back **truncated** (short) or the wrong build can ship from **stale** src. Both have put a
broken site live before. The old workaround — "keep files under ~41 KB" — does **not** fix the
non-deterministic truncation that happens *below* the cap. The fix is **verification**, enforced
by tooling so it sticks every iteration without anyone re-discovering it:

- **`cc-build.js`** asserts every input's bytes-read equals its real size (catches truncation),
  stamps `dist/index.html` with a hash of the raw sources, and self-checks the output before
  writing. It aborts loudly instead of shipping a corrupt build.
- **`verify-dist.js`** independently recomputes that stamp from current `src/` and confirms
  `dist/index.html` matches — this is what catches a **stale** dist (e.g. the v2.0.0-vs-v2.0.1
  bug). Run it any time: `node verify-dist.js`.
- **`githooks/pre-push`** runs `verify-dist.js` automatically and **blocks the push** if it fails.
  Activate once per machine that pushes: `sh scripts/install-hooks.sh` (sets `core.hooksPath`).

**Standard iteration loop (safe):**

```
# edit files under src/ (or cc-data.js) with a reliable editor — never via bash redirection
node cc-build.js        # rebuild dist; aborts on any truncated read or assembly gap
node verify-dist.js     # confirm dist matches current src (also runs on pre-push)
git add -A && git commit -m "..." && git push   # pre-push re-verifies, then Netlify republishes
```

**Best practice:** run `node cc-build.js` on a **trusted/local filesystem** (your own machine),
not inside the sandbox, so the mount can't truncate the read in the first place. The hook is the
backstop for when that isn't possible. Never hand-edit `dist/index.html` — it has no stamp and
will be rejected.
