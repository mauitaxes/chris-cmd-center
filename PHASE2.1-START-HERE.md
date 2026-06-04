# PHASE 2.1 — START HERE (resume point)

**Last updated:** 2026-06-04 (context window #5). Read THIS file to resume. It supersedes `PHASE2-START-HERE.md` for live status; that older file still has the full proxy contract + Notion IDs if you need them.

## Goal (unchanged)
Make the **Netlify-published** site read & write **live Notion** from any normal browser (Home / Office / Phone all see the same state). The serverless **Notion proxy** holds the token server-side and is called whenever `window.cowork` is absent. Code is DONE + tested (17/17). What remains is account wiring + deploy + verification.

## Progress so far — 2 of 6 steps done

1. ✅ **Notion integration created + connected.** Internal integration named **"Command Center"** (Access-token type), owner Chris Simon / mauitaxes@gmail.com, workspace "Chris Simon's Space". The secret token (`ntn_…`) was shown once and **Chris copied it to a local notepad** — it is NOT in the repo, NOT in memory, NOT anywhere Claude can see it. The integration was added to the parent **"Claude Workspace"** page and the connection **cascaded to all 6 targets** — each verified showing "Connections 1": the State page (Command Center State), Tasks, Wins, Routines, Capture, Focus Sessions.
   - Gotcha for next time: the Notion **integrations admin lives on `app.notion.com`**, which is a SEPARATE login from `www.notion.so`. Chris had to sign into both.

2. ✅ **Code pushed to GitHub.** Repo = **mauitaxes/chris-cmd-center**, branch `main`, 1 commit ("Initial commit"). Contains `dist/`, `netlify/functions/` (proxy + tests), `netlify.toml`, `.gitignore`, plus source files. Repo is currently **PUBLIC** — no secrets are in it so that's safe, but Chris wanted private; flip it anytime in repo **Settings → General → Danger Zone → Change visibility**.

## Remaining — STEPS 3-6 (do via Claude in Chrome, Chris logged in)

3. ⏳ **Link the repo to the EXISTING Netlify site** (keeps the current URL). Netlify → the existing Command Center site → **Site configuration → Build & deploy → Continuous deployment → Link repository** → pick `mauitaxes/chris-cmd-center`. Publish dir `dist` and functions dir `netlify/functions` come from `netlify.toml`, so leave build settings at defaults.
   - Authorizing the GitHub↔Netlify connection is an **OAuth grant — Chris clicks/approves that**, not Claude.

4. ⏳ **Set the secret env var.** Netlify → Site configuration → **Environment variables → Add a variable** → key `NOTION_TOKEN`, value = the `ntn_…` token from Chris's notepad.
   - **CHRIS pastes this. Claude must NOT enter the token** (entering secrets is a prohibited action). Claude can navigate to the exact screen and confirm the key name is spelled `NOTION_TOKEN`.

5. ⏳ **Trigger a deploy.** Netlify → Deploys → **Trigger deploy → Deploy site** (or just push any commit). Endpoint goes live at `https://<site>/.netlify/functions/notion-proxy` — exactly what the client POSTs to. Watch the deploy log for a green "Published" and that the Function `notion-proxy` is detected/bundled.

6. ⏳ **VERIFY live read + write across devices** (superpowers:verification-before-completion). From a NORMAL browser (two profiles or two devices), open the published URL and confirm: (a) a live READ shows current Notion data (not the stale snapshot), and (b) a WRITE — toggle a task / add a win — persists to Notion AND shows up on the other device. Only then is Phase 2 truly done. If a translation bug surfaces, the proxy's pure helpers are unit-tested in `netlify/functions/notion-proxy.test.mjs` — reproduce there first.

## Safety boundaries that shaped the division of labor (still apply)
Claude drives all navigation and fills non-secret fields. **Chris performs these specific clicks himself:**
- Pasting `NOTION_TOKEN` into Netlify (entering secrets).
- The Notion "Confirm" that grants an integration access to a page (modifying sharing/access permissions) — already done in step 1, noted here for context.
- Authorizing the GitHub↔Netlify OAuth connection (granting permissions).

## Environment facts to save re-deriving
- Claude's Linux sandbox **cannot reach github.com** (`curl` → 000) and has no `gh` CLI, so any `git push` must come from **Chris's machine** (folder: `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact`).
- GitHub **is** logged in inside the Chrome MCP browser. Netlify login state was **not yet checked** — first move in step 3 is to confirm Chris is logged into the right Netlify account/team that owns the existing site.
- Run the proxy tests anytime: `node --test "netlify/functions/"*.test.mjs` (the `<dir>` form is broken on Node 22 — use the glob).
- The "Command Center Artifact" folder can serve a **stale bash cache** per-file — verify file contents with the **Read tool**, which shares the Write path.

## First move next window
1. Skim this file. Confirm repo `mauitaxes/chris-cmd-center` still shows the files on `main`.
2. Open Netlify in Chrome, confirm Chris is logged into the account that owns the existing Command Center site.
3. Do steps 3 → 6 in order. The only Chris-only actions are: approve the GitHub OAuth (step 3) and paste the token (step 4).
