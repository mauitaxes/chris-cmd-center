# Handoff — Split the Command Center monolith into source modules + build

**Paste this whole file into a fresh Cowork conversation and execute it.** It is self-contained: structure is already mapped, so do NOT re-investigate the layout — verify, slice, rebuild, verify. Goal is to make future edits touch ~150-line files instead of a 62 KB monolith, and to make the build assemble `dist/index.html` atomically (which permanently kills the `;boo` truncation class of bug).

Project folder: `D:\Claude and Cowork\Command Center Artifact\Command Center Artifact`

---

## Hard rules (read first — these save tokens and prevent mistakes)

1. **bash serves a STALE/partial copy of this folder.** To READ project files, use the **Read tool** with `offset`/`limit` — never `cat`/`tail`/`head` via bash for content here. Write/Edit on the mount are fresh; trust them. (This is a known, reproduced quirk.)
2. **Do the heavy slicing in the fresh `outputs` scratch dir, not on the mount.** Copy the source file into `outputs`, run `sed`/`node` there (outputs is never stale), then write finished files back to the project folder.
3. **NEVER read-and-retype the CSS/JS.** Slice exact line ranges with `sed -n 'A,Bp'` into the new files. Retyping 600 lines wastes tokens and reintroduces transcription bugs. The agent should barely ever load the big regions into context.
4. **Primary acceptance test = byte-identical rebuild.** After refactor, `node cc-build.js` must produce a `dist/index.html` that is byte-identical (or, if whitespace differs, DOM/JS-semantically identical) to the pre-refactor `dist/index.html`. Keep a pristine copy named `dist/index.PREREFAC.html` to diff against. If `diff` is empty, runtime behavior provably did not change.
5. **Ship in phases.** Each phase ends with a passing rebuild-diff (and the Chrome smoke test on the final phase). Do not start the next phase until the current one verifies.
6. Invoke `superpowers:verification-before-completion` before claiming any phase done. Skip the other superpowers skills (no discovery needed).

---

## Verified structure of `dist/index.html` (893 lines) — do not re-derive

| Region | Lines | Destination source file |
|---|---|---|
| `<!doctype>` + `<head>` open | 1–6 | `src/index.html` (template) |
| `<style> … </style>` | 7–125 | `src/styles.css` (content = lines 8–124) |
| `<body>` open + markup | 127–344 | `src/index.html` (template) |
| `<script> … </script>` | 345–957 | `src/app.js` (content = lines 346–956) **minus the inlined data module** |
| `</body></html>` tail | 958–end | `src/index.html` (template) |

Inside the `<script>` region (346–956) sits the already-inlined **CCData module** — it is the exact contents of the existing `cc-data.js` (the IIFE that sets `root.CCData`). It must NOT be duplicated into `app.js`. Find its start/end line numbers in a fresh copy (grep for the IIFE that assigns `CCData` and its matching close), and replace that block in the template with the existing markers `/*__CC_DATA_START__*//*__CC_DATA_END__*/` so the current data-injection build keeps working.

Existing build entry (already works, just extend it):
`node cc-build.js <SRC.html> <cc-data.js> <OUT.html>` — finds `/*__CC_DATA_START__*/…/*__CC_DATA_END__*/` in SRC and replaces with cc-data.js. Tests live in `cc-data.test.js` (keep them green throughout).

---

## Target architecture
```
src/
  index.html   ← markup + head/tail ONLY, with 3 placeholders:
                  __CC_STYLES__ , the data markers, __CC_APP__
  styles.css   ← current <style> contents
  app.js       ← current <script> contents minus the CCData module
cc-data.js     ← unchanged (the tested data module)
cc-build.js    ← extended: inline styles.css + cc-data.js + app.js → dist/index.html
dist/index.html ← BUILT single-file output (what gets deployed to Netlify; stays single-file so Netlify Drop + Cowork-artifact use are unchanged)
```
Build assembles one self-contained file with a single `fs.writeFileSync` = atomic = no partial/truncated output ever again.

---

## Step 0 — Setup & confirm (cheap)
1. Read tool: confirm `dist/index.html` still ends correctly (line ~957 `</script>` then `</body></html>`) and that lines 7/125/127/345/957 match the table above. If line numbers drifted, re-grep landmarks (`<style>`, `</style>`, `<body>`, `<script>`, `</script>`) and update the ranges before slicing.
2. `git status` / commit current state so there's a clean rollback point.
3. Copy the current `dist/index.html` to BOTH `dist/index.PREREFAC.html` (the diff oracle) and into `outputs/` (the scratch workspace).
4. Confirm with Chris ONE decision before building: **single-file output (recommended, default)** vs. multi-file `dist/` (separate linked `styles.css`/`app.js`). Everything below assumes single-file.

## Step 1 — Extract CSS
In `outputs` (fresh): `sed -n '8,124p' index.html > styles.css`. Move to `src/styles.css`. In the template, replace the `<style>…</style>` inner content with `__CC_STYLES__`. Don't build yet.

## Step 2 — Extract JS (the big one)
In `outputs`: locate CCData block boundaries (grep). Slice the script body `sed -n '346,956p'`, then remove the CCData block lines → `src/app.js`. In the template, the `<script>` becomes:
`<script>\n/*__CC_DATA_START__*//*__CC_DATA_END__*/\n__CC_APP__\n</script>`.

## Step 3 — Build the template + extend cc-build.js
`src/index.html` = head + markup + tail with the 3 placeholders. Extend `cc-build.js` to: read template → replace `__CC_STYLES__` with styles.css → replace data markers with cc-data.js → replace `__CC_APP__` with app.js → write `dist/index.html`. Keep it a single final `writeFileSync`.

## Step 4 — VERIFY (the whole point)
1. `node cc-build.js` → produces `dist/index.html`.
2. `diff dist/index.html dist/index.PREREFAC.html` (run in outputs against fresh copies). **Must be empty** (or only inconsequential whitespace — if so, justify each diff line explicitly). Iterate slicing until clean.
3. `node` run of `cc-data.test.js` — all green.
4. Final Chrome smoke test on the rebuilt `dist/index.html` (`mcp__Claude_in_Chrome__navigate` to the local file, `get_page_text` + `read_console_messages`): no console errors, all four tabs (Today/Tasks/Routine/Wins) switch on click, gauges + stat cards + streak + task list render real snapshot data (not "Loading…").
5. Invoke `superpowers:verification-before-completion`, then report done.

## Step 5 — Clean up & record
1. Delete `dist/index.PREREFAC.html`. Commit: source modules + extended build.
2. Tell Chris the new edit workflow: edit `src/styles.css` / `src/app.js` / `cc-data.js`, run `node cc-build.js`, re-drop `dist/` on Netlify.
3. Update project memory: monolith split done, new file layout, build command, and that edits now happen in `src/*` not `dist/index.html`.

---

## Token-budget directives for the execution agent
- Slice with `sed`; do not echo big regions into the conversation.
- Verify via `diff` exit status, not by reading both files into context.
- Read only the small files (template, build script, test) in full; read the monolith only in narrow ranges to confirm boundaries.
- One phase at a time; stop and report if a rebuild-diff won't go clean — that's a real signal, not something to brute-force.
