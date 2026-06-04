# Handoff — Command Center: restore app + live cross-device Notion

**Paste everything below into a fresh Cowork conversation.** It is self-contained so the new context does not need to re-investigate (saves tokens). Diagnosis is already done — do not re-diagnose; verify, fix, verify.

---

You are fixing Chris's "Command Center" dashboard. Root cause is already identified — your job is to apply and verify the fix with the **lowest token usage possible and zero mistakes**. Work in the project folder:

`D:\Claude and Cowork\Command Center Artifact\Command Center Artifact`

Use the **superpowers** plugin only where it adds safety: skip heavy discovery skills (the bug is known), but you MUST invoke `superpowers:verification-before-completion` before claiming any phase is done, and `superpowers:test-driven-development` for the Phase 2 proxy function. Do not invoke other superpowers skills unless you hit an unexpected blocker.

ENV QUIRK (important): `mcp__workspace__bash` may serve a STALE cached copy of the "Command Center Artifact" folder. ALWAYS verify file contents with the **Read tool** (it shares the Write path), not by trusting bash output alone. The `outputs` mount is fresh.

## Phase 1 — Truncation fix (DO THIS FIRST, ship and verify before Phase 2)

The bug: the `<script>` block is cut off mid-statement. Every build ends with:

```
  wire();resetTimer();tick();setInterval(tick,1000);boo
```

It must end with (this is the verified-correct tail, taken from the intact `command-center-v1.2.0.html`):

```
  wire();resetTimer();tick();setInterval(tick,1000);boot(false);
})();
</script>
</body>
</html>
```

So the missing tail is exactly: `t(false);` + newline + `})();` + newline + `</script></body></html>`. An unterminated IIFE = fatal JS syntax error = the whole script never runs, which is why the page is non-interactive, tabs don't switch, and no data renders.

Files that are truncated and must be repaired (all end at `;boo`):
1. `dist/index.html` ← **the Netlify file, highest priority**
2. `command-center-v1.3.0.html`
3. `command-center-v1.3.0.src.html`

Reference file that is INTACT (ends correctly, use only to confirm the tail): `command-center-v1.2.0.html`.

Steps:
1. For each of the 3 truncated files, confirm with the Read tool that it ends at `...setInterval(tick,1000);boo` and that the body above it is otherwise complete (the content differs from v1.2.0 — v1.3.0 has an inlined `CCData` block and a `cc_v130_cache` localStorage layer — so do NOT diff against v1.2.0 line-by-line; just confirm only the closing tail is missing).
2. Append the missing tail so each file ends exactly with `boot(false);\n})();\n</script>\n</body>\n</html>\n`. (Use Edit to replace the trailing `;boo` with `;boot(false);\n})();\n</script>\n</body>\n</html>`.)
3. Verify with the Read tool that each file now ends correctly.
4. **Verification (mandatory):** open the fixed `dist/index.html` in a real browser via Claude in Chrome (`mcp__Claude_in_Chrome__navigate` to the local file or a temp http server, then `get_page_text` + `read_console_messages`). Confirm: (a) no console syntax errors, (b) the four tabs (Today / Tasks / Routine / Wins) switch on click, (c) gauges/stat cards/streak/task list render with the snapshot data, not "Loading…". Invoke `superpowers:verification-before-completion` and only then report Phase 1 done.
5. Tell Chris to re-drop the whole `dist/` folder onto https://app.netlify.com/drop to publish (the Netlify URL stays stable). Phase 1 is independently shippable.

## Phase 2 — Live cross-device Notion via a Netlify Function proxy

Why: `window.cowork.callMcpTool` (the live Notion bridge) exists ONLY inside the Cowork desktop app. On Netlify it's undefined, so today the page is snapshot-only and edits save to per-device localStorage. To make the published site read/write live Notion from any browser, route Notion calls through a serverless function that holds a Notion token server-side.

Plan (use TDD for the function):
1. Create a Notion **internal integration**, get its token, and share it to the Command Center pages/databases. Notion backend IDs (already verified):
   - Notion MCP server prefix used in the app: `mcp__b47f7667-3cb0-4d8e-bbaf-fa1fca4c39c7__`
   - State page: `37478f3d-415b-814c-8c65-dd76b6ab9aa3`
   - Tasks data source: `fb432308-59b9-4078-92db-a83c6279957d`
   - Wins: `f99a9128-9809-48b9-9cb6-870717bd5183` · Routines: `17f7f036-e24c-40ce-9d41-db5d8a66b618` · Capture: `35ba4e31-eca6-4ab7-8625-acc41d5341e8` · Focus Sessions: `291cb585-746e-4195-a920-b0ac460fbbf6`
   - (Note: the proxy will call the **official Notion REST API**, not the MCP tools. Map the app's read/write needs — fetch page, query data source, update page properties, create page, update State page content block — to Notion API endpoints. Re-confirm the exact property shapes against the app's `liveLoad`/`flushPending`/`saveState` functions in the HTML.)
2. Add `netlify/functions/notion-proxy.js`: reads the token from a Netlify env var (`NOTION_TOKEN`, never in client JS), accepts a small whitelisted set of operations, calls the Notion API, returns JSON. Add `netlify.toml` if needed. Add CORS for same-origin only.
3. In the HTML, change the `call(name,args)` bridge so that when `window.cowork` is absent it POSTs to `/.netlify/functions/notion-proxy` instead of throwing "no bridge". Keep the Cowork bridge path unchanged so the app still works live inside Cowork. Keep localStorage as an offline buffer.
4. Write tests first for the proxy (request shaping, error handling, no token leak). Verify locally, then have Chris deploy (Netlify Drop won't run Functions — Phase 2 needs a connected Netlify site / `netlify deploy`, so confirm deploy method with Chris before building).
5. Invoke `superpowers:verification-before-completion`: prove live read AND write work from a normal browser on at least two devices (or two browser profiles) before declaring done.

## After completion
Update the project memory: note Phase 1 (truncation) fixed in which files, and Phase 2 architecture (Notion proxy) if shipped.
