# Command Center — Step 2 Segment 3: Execute the Fix Plan (Handoff)

**Run this in a fresh task. It is self-contained — do not re-do the audit or re-plan.**

## Where we are

- Segment 1 (audit) ✅ and Segment 2 (plan) ✅ completed 2026-06-05.
- **Your job (Segment 3): execute `STEP2-FIX-PLAN.md` task-by-task using `superpowers:subagent-driven-development`** — fresh subagent per task, review between tasks. That skill choice is already decided; don't re-ask.
- Chris approved fixing ALL confirmed gaps. Scope is frozen: exactly what's in the plan, nothing more (YAGNI).

## Read order (only these)

1. `STEP2-FIX-PLAN.md` — the complete implementation plan: 4 tasks (Task 0 preflight → Task 1 cc-data helpers+tests → Task 2 app.a.js → Task 3 app.b.js → Task 4 build/verify/review). Every step has exact code; subagents should follow it verbatim.
2. `STEP2-AUDIT-FINDINGS.md` — background only; read the "Plan-phase corrections" section if a subagent questions why. Key facts: **H3 was a false positive (NO proxy changes)**; the worst bug is **C4: flushPending() wipes the pending queue even when replays fail**.

## Non-negotiable mechanics (from project memory — violating these has burned us before)

- **READ files with the Read tool, never bash** (bash mount serves stale/partial copies). Edit with Edit/Write tools. Bash ONLY for `node` / `git` / builds at `/sessions/<session>/mnt/Command Center Artifact/` (check your session's mount path).
- Canonical build = `node cc-build.js` → `dist/index.html`. Build aborts if any input >40KB — keep `src/app.a.js`, `src/app.b.js`, `cc-data.js` under that.
- After building, grep `dist/index.html` for `classifySyncError` and `capDel` — if absent, the bash mount is stale: wait, confirm the mount copy matches, rebuild.
- Tests: `node --test cc-data.test.js` (60 → **65** after Task 1) and `node --test tests/notion-proxy.test.mjs` (**17, unchanged — proxy is NOT touched**). Keep test files OUT of `netlify/functions/`.
- Sandbox cannot reach github.com: commit locally per plan; **Chris runs `git push`** → Netlify rebuilds https://chris-cmd-center.netlify.app (repo `mauitaxes/chris-cmd-center`, private).
- `NOTION_TOKEN` exists only as a Netlify env var — never in repo, client JS, chat, or memory.
- **Usage-aware:** Chris tracks quota. Pause at natural checkpoints (after Task 2 is a good midpoint) and report progress briefly; don't steamroll if something looks off — stop and ask.

## Execution shape

- One subagent per plan task (Tasks 0–4), each given the plan file path + its task number + the mechanics above. Review each subagent's diff/result before dispatching the next (two-stage review per the skill).
- Task 4 includes a code-review subagent over the combined diff (`superpowers:requesting-code-review`) and `superpowers:verification-before-completion` before claiming done.
- Commits: 1 per task as specified in the plan (Task 0 has no commit).

## Definition of done

1. All plan checkboxes done; 65 + 17 tests green; build clean with stale-mount grep passing; dist committed.
2. Review subagent found no unaddressed real issues.
3. Report to Chris: commit list + one-line summary per fix + the post-deploy manual smoke steps (in plan Task 4 Step 7). **Pending only: Chris pushes.**
4. Update memory `command-center-step2-audit.md` (and MEMORY.md index line) to reflect Segment 3 complete.
