# PHASE 2 — START HERE (single source of truth)

**Last updated:** 2026-06-04 (context window #4). Read THIS file only to resume — everything you need is here or linked. Older docs are in `archive/`.

## TL;DR — where we are
The **code for Phase 2 is DONE and tested**. What remains is **account setup + deploy + live verification**, all of which need Chris's logged-in browser (decided: do it via Claude in Chrome). The one true prerequisite — a **Notion integration token — does NOT exist yet** (see "Token reality" below). Nothing else blocks.

**Goal:** make the **Netlify-published** site read & write **live Notion** from any normal browser (Home/Office/Phone all see the same state). Today the published site is snapshot-only because the live bridge `window.cowork.callMcpTool` exists ONLY inside the Cowork desktop app.

**Fix (architecture):** a serverless **Notion proxy** holds a Notion token server-side; the client routes its Notion calls to it whenever `window.cowork` is absent. The proxy calls the **official Notion REST API** and returns responses in the **same shapes the existing client parsers expect** (we emulate the MCP output so client code stays stable — chosen for future-proofing).

---

## DONE in this window (code complete, committed to the folder)
1. **`netlify/functions/notion-proxy.js`** — the proxy. Reads `NOTION_TOKEN` from env. Whitelists exactly 4 ops; rejects anything else (400). Calls Notion REST (`Notion-Version: 2025-09-03`, data-source endpoints). Translates REST↔MCP both ways. Never leaks the token. Same-origin CORS only. Pure helpers exported for testing: `encodePropsToMcp`, `mcpPropsToRest`, `extractJsonFence`, `parseDataSourceUrl`, `dispatch`, plus `handler`.
2. **`netlify/functions/notion-proxy.test.mjs`** — 17 tests, **all passing** (`node:test`, mocked fetch). Covers every op, property-encoding translation, the State-page code-block round-trip, the op whitelist, token-missing 500, CORS, and a security assertion that no response ever contains the token.
3. **`netlify/functions/package.json`** — `{"type":"module"}` (required so Node/Netlify treat the `export`s as ESM).
4. **`netlify.toml`** — `publish=dist`, `functions=netlify/functions`.
5. **`.gitignore`** — `node_modules/`, `.netlify/`, `.env`.
6. **`dist/index.html` bridge patch** (`call()`, ~line 551): when `window.cowork` is absent it POSTs `{name,args}` to `/.netlify/functions/notion-proxy` and returns the JSON instead of throwing "no bridge". Cowork path unchanged; localStorage buffer intact.
7. **`dist/index.html` boot() fix** (~line 841) — *this was the missing linchpin*: `boot()` used to hard-fall-back to snapshot whenever `hasBridge()` was false, so the proxy would NEVER be called. Now the no-Cowork path also attempts the live load (which routes through the proxy); the existing `catch` demotes to snapshot only if the proxy is actually unreachable.

**Run the tests anytime:** `cd` to the folder, then
`node --test "netlify/functions/"*.test.mjs`  (NB: `node --test <dir>` is broken on Node 22 — use the glob form.)

---

## Token reality (important — corrects a prior assumption)
The artifact "was updating Notion" only because **inside Cowork** `window.cowork.callMcpTool` borrows Cowork's own Notion connection — **no personal token is needed there**. The published Netlify site has no such bridge, which is the whole reason Phase 2 exists. There is **no Notion token in this folder** (verified). So Step 1 below — create a Notion internal integration and share it to the pages/DBs — **still has to be done**. It only blocks live verification, not the build.

---

## REMAINING WORK — do via Claude in Chrome (Chris's accounts)
Do these in order. The first deploy can be static-only; the proxy needs the token + GitHub-connected deploy (Netlify Drop can't run Functions).

1. **Create the Notion integration + share it.** notion.so → My integrations → New internal integration → copy the secret (`ntn_…`/`secret_…`). Then open the State page and each of the 5 databases (IDs below) → "…" → Connections → add the integration. (Sharing the parent "Claude Workspace" page may cascade — verify each target is reachable.)
2. **Create a GitHub repo & push** the whole folder (root = this folder; `dist/`, `netlify/`, `netlify.toml` all committed). `.gitignore` already excludes secrets/junk. **Never commit the token.**
3. **Link the repo to the EXISTING Netlify site** (keeps the current URL): Netlify → Site config → Build & deploy → Link repository. Publish dir `dist`, functions `netlify/functions` come from `netlify.toml`.
4. **Set the secret:** Netlify → Site config → Environment variables → `NOTION_TOKEN = <the token>`.
5. **Trigger deploy.** Endpoint becomes `https://<site>/.netlify/functions/notion-proxy` — exactly what the client POSTs to.
6. **VERIFY (superpowers:verification-before-completion):** from a normal browser (two profiles or two devices), confirm a live READ shows current Notion data and a WRITE (toggle a task / add a win) persists to Notion and appears on the other device. Only then is Phase 2 done.

> Local test loop (optional, on Chris's machine, not for publishing): `npm i -g netlify-cli` → `netlify link` → `netlify dev` → test at http://localhost:8888.
> Fallback: if Phase 2 is shelved, plain Netlify Drop of `dist/` still serves the snapshot-only build.

---

## Proxy contract (so you never have to re-derive it)
Client sends the FULL tool name `mcp__b47f7667-3cb0-4d8e-bbaf-fa1fca4c39c7__<op>`; proxy matches the suffix after the last `__`. The 4 ops and the **return shapes the client parsers require**:
- **notion-fetch** `{id}` → `{content:[{text}]}`. For a normal page the text contains `<properties>{…MCP-encoded…}</properties>`. For the **State page** the text contains a ```json … ``` fence (read from the page's single `code` block via `GET /v1/blocks/{id}/children`).
- **notion-search** `{data_source_url:"collection://<dsId>", page_size,…}` → `POST /v1/data_sources/<dsId>/query` → `{results:[{id,title}]}` (title = plain text).
- **notion-update-page** `{page_id, command:"update_properties", properties}` → `PATCH /v1/pages/<id>` → `{ok:true}`. **OR** `{page_id, command:"update_content", content_updates:[{old_str,new_str}]}` → extract the JSON inside `new_str`'s ```json fence, `PATCH /v1/blocks/<codeBlockId>` → `{ok:true}`.
- **notion-create-pages** `{parent:{data_source_id}, pages:[{properties}]}` → `POST /v1/pages` (parent `{type:"data_source_id",data_source_id}`) → `{pages:[{id}]}`.

**MCP property encoding** (in args and in `<properties>` output): title/select/rich_text = plain string; checkbox = `"__YES__"`/`"__NO__"`; date = key `"date:<Prop>:start"` with ISO value; number = number. (Writes use a per-data-source schema map; reads derive type from the REST property's own `type`.)

## Verified Notion backend IDs
- State page (single ```json block, "Do not edit by hand"): `37478f3d-415b-814c-8c65-dd76b6ab9aa3`
- Tasks DB `8bbc2654-2cf8-4ad8-bad0-1f3e2cb8b503` · ds `fb432308-59b9-4078-92db-a83c6279957d` — Task(title), Area(select), Done(checkbox), Priority(checkbox), Notes(text), Created(date), Due Date(date), Energy(select), Time Estimate(select)
- Wins DB `2bd8854a-8fbd-41ba-b464-efa3c6ab26f6` · ds `f99a9128-9809-48b9-9cb6-870717bd5183` — Win(title), Date(date)
- Routines DB `7d25349f-a714-42ac-85c6-4410fa22aeed` · ds `17f7f036-e24c-40ce-9d41-db5d8a66b618` — Routine(title), Active(checkbox), Done Today(checkbox), Order(number), Time Of Day(select), Last Done(date), Streak Count(number)
- Capture DB `67883e1b-8bb7-4213-8781-255a0f45b5ac` · ds `35ba4e31-eca6-4ab7-8625-acc41d5341e8` — Item(title), Captured(date), Processed(checkbox), Notes(text)
- Focus Sessions DB `6d17e2eb-f84a-4546-8389-d517968000d3` · ds `291cb585-746e-4195-a920-b0ac460fbbf6` — Session(title), Date(date), Minutes(number), Type(select), Task(text)

## File map (top level)
- `dist/index.html` — the Netlify build (bridge + boot fix applied here). `dist/DEPLOY.md` — deploy notes.
- `netlify.toml`, `.gitignore`, `netlify/functions/{notion-proxy.js, notion-proxy.test.mjs, package.json}` — Phase 2 proxy.
- `command-center-v1.3.0.html` / `.src.html` — the Cowork artifact source (keep the live Cowork bridge working if you ever edit the shared bridge).
- `cc-data.js` (+ `.test.js`, `.fixtures.js`, `cc-build.js`) — shared data module & tests used by the build.
- `archive/` — superseded mockups, v1.2.0 files, old handoffs, and the v1.3.0 backend-hardening plan/spec (reference only).

## ENV QUIRK (still true)
`mcp__workspace__bash` can serve a stale cached copy of this folder. Verify file *contents* with the **Read tool** (shares the Write path). This window confirmed the mount was fresh, but stay alert.

## First move next window (minimize usage)
1. Skim this file (done). Optionally `node --test "netlify/functions/"*.test.mjs` to confirm 17/17.
2. Ask Chris: is the Notion integration token created & shared yet? If not, drive Step 1 in Chrome.
3. Proceed through Remaining Work steps 2→6 in Chrome. No code changes should be needed unless live verification reveals a translation bug.
