// verify-dist.js — independent integrity gate for dist/index.html.
// Run manually (`node verify-dist.js`) or automatically via the pre-push hook.
// It answers ONE question with certainty: "is the committed dist a faithful,
// up-to-date build of the current src?" If not, it exits non-zero and the push
// is blocked. This is what stops the recurring stale/truncated-deploy problem
// without anyone having to remember the procedure.
//
// It catches:
//   - STALE dist  : dist was built from older src (e.g. someone edited src but
//                   shipped the old dist). Detected by recomputing the build
//                   stamp from current src and comparing to the stamp in dist.
//   - TRUNCATED   : any short read of a source file (readChecked, shared w/ build).
//   - DROPPED CODE: css/app/data/version tail missing from dist.
const fs=require("fs"),path=require("path");
const B=require("./cc-build.js"); // reuses readChecked/computeStamp/STAMP_RE (single source of truth)
const ROOT=__dirname;

function fail(msg){console.error("✗ VERIFY-DIST FAILED: "+msg);console.error("  -> Do NOT push. Rebuild on a trusted/local filesystem: `node cc-build.js`, then re-run `node verify-dist.js`.");process.exit(1);}

// 1) Re-read every source input with the same truncation guard the build uses.
let bufs;
try{ bufs=B.INPUTS.map(B.readChecked); }
catch(e){ fail("could not safely read sources ("+e.message+")"); }
const byName={};B.INPUTS.forEach((rel,i)=>{byName[rel]=bufs[i];});

// 2) Read dist with its own truncation guard.
const distPath=path.join(ROOT,"dist","index.html");
const distSz=fs.statSync(distPath).size;
const distBuf=fs.readFileSync(distPath);
if(distBuf.length!==distSz) fail("TRUNCATED READ of dist/index.html ("+distBuf.length+" of "+distSz+" bytes). Re-run on a trusted filesystem.");
const dist=distBuf.toString("utf8");

// 3) Stamp check — the staleness gate.
const expected=B.computeStamp(bufs);
const m=dist.match(B.STAMP_RE);
if(!m) fail("no build stamp found in dist/index.html. It was built by an old cc-build.js or hand-edited. Rebuild with `node cc-build.js`.");
if(m[1]!==expected) fail("STALE DIST — embedded stamp "+m[1]+" != current-src stamp "+expected+". dist/index.html does not match src/. Rebuild with `node cc-build.js`.");

// 4) Structural / content checks (independent recompute of the big pieces).
const tpl=byName["src/index.html"].toString("utf8");
const css=byName["src/styles.css"].toString("utf8").replace(/\n$/,"");
const app=(byName["src/app.a.js"].toString("utf8")+byName["src/app.c.js"].toString("utf8")+byName["src/app.b.js"].toString("utf8")).replace(/\n$/,"");
const data=byName["cc-data.js"].toString("utf8").trim();
const ver=(tpl.match(/id="badge-ver"[^>]*>(v[0-9.]+)/)||[])[1];

const problems=[];
if(!ver) problems.push("no version in src/index.html");
else if(!dist.includes(ver)) problems.push("version "+ver+" missing from dist");
if(dist.includes("__CC_STYLES__")||dist.includes("__CC_APP__")||B.EMPTY_DATA_BLOCK.test(dist)) problems.push("unresolved build placeholder in dist");
if(!dist.includes(css.slice(-40))) problems.push("CSS tail missing from dist");
if(!dist.includes(data.slice(-40))) problems.push("data tail missing from dist");
if(!dist.includes(app.slice(-80))) problems.push("APP tail missing from dist (app/timer code truncated)");
if(!dist.includes("</script>")) problems.push("no </script> in dist");
if(!/<\/body>\s*(<!--[^>]*-->\s*)?<\/html>\s*$/.test(dist)) problems.push("dist does not end with </body>…</html>");
if(problems.length) fail(problems.join("; "));

console.log("✓ verify-dist OK  version="+ver+"  stamp="+expected+"  dist="+distSz+" bytes (fresh build of current src)");
