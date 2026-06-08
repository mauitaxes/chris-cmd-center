# Task 3 — deploy-smoke the Todoist proxy (do NOT merge to main)

Goal: confirm the live `todoist-proxy` function reads Todoist correctly (and that the REST v2 / Sync v9 base URL is right) on a **preview** deploy, leaving production `main` untouched. Gate: no merge to `main` before CP4.

## Steps (Chris, from the repo)
1. Push the branch:
   ```
   git push -u origin feat/todoist-phase1
   ```
2. On GitHub, open a **Pull Request** for `feat/todoist-phase1` → `main`. **Do not merge.** Netlify auto-builds a **Deploy Preview** (functions + env included).
   - Ensure `TODOIST_API_TOKEN` is available to **Deploy previews / branch deploys** (Netlify → Site config → Environment variables → context = "All", not production-only). `NOTION_TOKEN` already is.
3. Open the Deploy Preview URL in a normal browser (NOT inside Cowork, so the app uses the proxy path). Open DevTools console and run:
   ```js
   await window.__ccLoadTodoist()
   ```
   **Expected:** `{ open: 7, p1: 4, areasActive: 2, byArea: { "Focus & Work": 5, "Claude Tasks": 2 } }`
   - If `window.__ccDiag.err` is set or the call throws, copy that error back.

## Fallback: hit the function directly
```
curl -s -X POST "https://<preview-host>/.netlify/functions/todoist-proxy" \
  -H "Content-Type: application/json" \
  -d '{"name":"mcp__b9779bcc-3581-4f0e-bef4-401bb840378a__find-tasks","args":{"projectId":"6gqCVgmmffVVc4HW"}}'
```
Expect a JSON body `{"tasks":[ ...5 Focus & Work tasks..., priority:"p1"/"p4", projectId, ... ],"totalCount":5}`.

## Reading the result
- **Success** (tiles as above): REST v2 + Bearer auth confirmed live → proceed to 3b/3d/3c.
- **404 / "unknown" from Todoist**: REST v2 path likely retired → flip `REST_BASE` to the v1-unified base (`https://api.todoist.com/api/v1`) and adjust `find-tasks` (v1 returns `{results,next_cursor}` — `normalizeRestTask` already tolerates both array and `{results}`). Re-deploy preview.
- **401**: token not reaching the preview context (fix env scope in step 2).
