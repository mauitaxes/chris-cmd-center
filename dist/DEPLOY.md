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
