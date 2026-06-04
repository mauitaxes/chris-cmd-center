# Deploy — Command Center (Netlify Drop)

The `dist/` folder is a complete, standalone build. Deploy in under a minute.

## Steps

1. Open **https://app.netlify.com/drop** in your browser (log in if prompted — a free account is fine).
2. Drag the **entire `dist/` folder** onto the drop zone (not just `index.html`).
3. Wait for the upload bar to finish. Netlify gives you a live URL like `https://random-name-123.netlify.app`.
4. Open that URL on Home, Office, and Phone. Bookmark it / add to home screen on each device.

## Updating later

To publish a new build: open the same site in Netlify → **Deploys** tab → drag the updated `dist/` folder onto the deploy area. The URL stays the same.

Optional: in **Site settings → Change site name**, set a memorable subdomain (e.g. `chris-command-center.netlify.app`).

## What runs where

- **Inside the Cowork app:** the `window.cowork.callMcpTool` bridge is present, so the dashboard reads and writes Notion live (tasks, wins, routines, focus sessions, streak).
- **On the Netlify URL (normal browser):** the bridge is not present, so the app boots from its localStorage cache (last-known-good data) and the embedded snapshot. You can check off tasks, log wins, and capture notes — these are saved **locally on that device** and persist across reloads, but do **not** sync to Notion or across devices.

So the Netlify build is a fast, always-available view of your day. Use it inside Cowork when you need changes pushed back to Notion and mirrored across all three devices.
