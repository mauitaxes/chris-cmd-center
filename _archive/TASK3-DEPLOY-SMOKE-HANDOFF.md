# Task 3 — Deploy-Smoke Handoff (resume + get unstuck on the Netlify preview)

**Prepared:** 2026-06-08 · **Branch:** `feat/todoist-phase1` (HEAD `be843ec`, pushed to GitHub) · **Tests:** 120/120 green · **Production `main` / live site: UNTOUCHED.**

---

## 1. TL;DR — where you are

You finished pushing the branch to GitHub. ✅ You are stuck on **one** thing: getting a **preview deploy** of this branch so we can confirm the new Todoist code reads your tasks live. You then run **one line** in the browser console and paste me the result. That's the whole step.

**Two rules:**
- **Do NOT click "Merge"** on the PR. We are not merging to `main` until a later checkpoint (CP4). A preview does **not** require merging.
- The live site is safe. Nothing you do in this step changes `chris-cmd-center.netlify.app`.

---

## 2. The mental model (why a "preview")

Netlify automatically rebuilds your **live site** whenever `main` changes. To test new code **without** touching the live site, Netlify can deploy a **different** branch to a separate, temporary URL. There are two ways to get that URL — pick whichever you can get working:

- **Branch deploy** — Netlify deploys the branch to a stable URL like `feat-todoist-phase1--chris-cmd-center.netlify.app`. (Needs a one-time setting.)
- **Deploy Preview** — Tied to a Pull Request; Netlify builds it automatically and posts the link on the PR. (Usually on by default.)

Either gives you a URL that runs the serverless functions (including the new `todoist-proxy`) with your environment variables.

---

## 3. The single source of truth: the Netlify **Deploys** tab

Before fiddling with PRs, just look here — it tells you whether ANY deploy happened:

1. Go to https://app.netlify.com → your site (**chris-cmd-center**).
2. Click the **Deploys** tab.
3. Look at the top of the list. After you pushed the branch (and/or opened a PR), you should see a new entry whose title is **"Deploy Preview"** or **"Branch deploy: feat/todoist-phase1"**.
   - **Building** (yellow) → wait ~1–2 min for it to go **Published** (green).
   - **Published** (green) → click it. The deploy detail page shows an **"Open preview deploy"** / preview URL near the top. **That URL is what you need.**
   - **Failed** (red) → click it, scroll the build log to the first red error, copy it, and paste it to me.
   - **Nothing new appears at all** → deploy previews/branch deploys aren't enabled yet → do Section 4 or 5.

---

## 4. Path A — Branch deploy (most predictable, no PR)

1. Netlify → your site → **Site configuration** → **Build & deploy** → **Continuous deployment** → **Branches and deploy contexts** → **Configure**.
2. Under "Branch deploys", choose **"Let me add individual branches"** and add: `feat/todoist-phase1`. Save.
3. Trigger it: **Deploys** tab → **Trigger deploy** → **Deploy site** (or just push any trivial commit). A "Branch deploy: feat/todoist-phase1" appears.
4. When green, open it (Section 3) → you'll get `https://feat-todoist-phase1--chris-cmd-center.netlify.app`.

## 5. Path B — Deploy Preview via Pull Request

1. After pushing, GitHub shows a yellow **"Compare & pull request"** banner on https://github.com/mauitaxes/chris-cmd-center → click it. (Or: **Pull requests** tab → **New pull request**.)
2. Confirm the arrow reads **base: `main`  ←  compare: `feat/todoist-phase1`**. Click **Create pull request**. **Do not merge.**
3. On the PR page, scroll to the **checks** section at the bottom. Within a minute or two you should see **"netlify Deploy Preview … "** with a **Details** link, and/or a Netlify bot comment with a **"Deploy Preview"** URL. That link is your preview.
   - If no Netlify check ever appears, the GitHub↔Netlify app may need connecting — use **Path A** instead, it doesn't depend on the PR.

---

## 6. The smoke test (same for both paths)

1. Open the preview URL **in a normal browser** (Chrome/Edge — **not** inside the Cowork app; we want it to use the live proxy, not the in-app bridge).
2. Open **DevTools → Console** (press **F12**, click the **Console** tab).
3. Paste this and press Enter:
   ```js
   await window.__ccLoadTodoist()
   ```
4. **Expected result:**
   ```
   { open: 7, p1: 4, areasActive: 2, byArea: { "Focus & Work": 5, "Claude Tasks": 2 } }
   ```
   - ✅ If you see that → the live Todoist proxy works. Tell me "smoke passed" and I'll build the Today panel, Inbox chip, and Calendar lane.
   - ❌ If it throws an error or `byArea` is empty → also run `window.__ccDiag.err` and paste me whatever it shows.

---

## 7. Troubleshooting the smoke result

| Symptom | Likely cause | Fix |
|---|---|---|
| Console: `__ccLoadTodoist is not a function` | Old build / wrong URL (you opened the live site, not the preview) | Re-open the **preview** URL from the Deploys tab; hard-refresh (Ctrl+Shift+R). |
| Error mentions **404** / Todoist "not found" | Todoist retired REST v2 (v1-unified rollout) | Tell me — I flip the proxy's `REST_BASE` to `https://api.todoist.com/api/v1` and you re-deploy the preview. |
| Error mentions **401 / unauthorized** | `TODOIST_API_TOKEN` not available to the preview context | Netlify → Site config → **Environment variables** → ensure `TODOIST_API_TOKEN` scope = **All** (not "Production only"). Re-deploy. |
| Error mentions **500 / server not configured** | Token missing entirely on Netlify | Add `TODOIST_API_TOKEN` in Environment variables, scope All, re-deploy. |
| Build **failed** (red in Deploys) | Build/log error | Open the failed deploy → copy the first red error → paste to me. |

---

## 8. What was built (so you can evaluate the work)

Branch `feat/todoist-phase1`, 14 commits ahead of `main`, all tests green. Task 3 (the Todoist read panels) — **foundation done, nothing rendered to the dashboard yet, no cutover from Notion**:

- `4c61260` Task 3 TDD plan · `20b33b3` `app.c.js` code-split · `5bcce70` testable `todoist-proxy.js` + routing · `78c902a` 3a task-tile transforms + non-destructive read scaffold · `be843ec` this smoke procedure (`docs/task3-deploy-smoke.md`).
- Earlier on the branch: Task 0 (DB-id resolution), Task 1 (live Todoist project/label structure), Task 2 (migrated 7 open tasks), Task 4/CP3 (recurring-completion spike → completed signal comes from `find-activity`, not `find-completed-tasks`).
- **Live-verified already (in-session):** the 3a transforms over your real tasks produce exactly `{open:7, p1:4, Focus&Work:5, Claude Tasks:2}`. The deploy-smoke just confirms the same path works through the **deployed function** (the one piece that can only be tested on Netlify).

**One known watch-item:** the proxy targets Todoist **REST v2 / Sync v9**. Fully unit-tested, but the live base URL is the thing the smoke confirms (v1-unified is rolling out). The fix if it's wrong is a one-line `REST_BASE` change (Section 7).

---

## 9. Resume in a fresh Cowork session

Start the new session with:

> "Read TASK3-DEPLOY-SMOKE-HANDOFF.md and continue the Command Center Todoist build on branch `feat/todoist-phase1`. Here's my smoke result: <paste the console output or error>."

Then:
- **If smoke passed** → I build **3b** (Today panel, overdue threshold 5), **3d** (Inbox chip), then **3c** (Schedule lane — I'll list your Google Calendars so you pick which ones show), then wire the panels into the dashboard. **3e** (Today's Progress) stays stubbed until Task 7 (the nightly job).
- **If smoke failed** → paste the error; I apply the matching fix in Section 7 and you re-deploy the preview.

**Standing gates:** no merge to `main` before CP4; streak stays OFF until Tasks 7+8; the dashboard keeps reading Notion for tasks until we deliberately cut over with you.

### Environment notes for the fresh session (for the assistant)
- Worktree git pointers may reference an old session mount → rewrite `.worktrees/todoist-phase1/.git` and `.git/worktrees/todoist-phase1/gitdir` to the current `/sessions/<id>/mnt/...` path before any git op.
- Edit existing tracked files in the worktree via **bash only** (Read tool for reads); keep every `cc-build.js` input <40 KB; `node --test` + `node cc-build.js` from the worktree root.
- The sandbox cannot push (GitHub 403) — pushes are Chris's action.
