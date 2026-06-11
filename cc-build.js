// Command Center build: assembles src/ modules + cc-data.js into dist/index.html
// Single atomic writeFileSync -> no partial/truncated OUTPUT.
//
// ============================================================================
// WHY THIS FILE IS PARANOID (read before "simplifying" it):
// The bash/sandbox mount that source files are read through is UNRELIABLE. It
// has two distinct failure modes, and BOTH have shipped a broken site before:
//   1) TRUNCATION  - a read returns short. fs.statSync() still reports the true
//      size, so a size-only check passes while the bytes read are incomplete.
//      => Defense: readChecked() asserts bytes-read === stat size for EVERY input.
//   2) STALENESS   - dist is intact but built from OLD src (the v2.0.0-vs-v2.0.1
//      bug: src was edited but the stale dist shipped anyway).
//      => Defense: we stamp dist with a hash of the raw inputs; verify-dist.js
//         recomputes that hash from current src and refuses to push on mismatch.
// Keeping files small was the OLD workaround; it does NOT fix non-deterministic
// truncation below the size cap. Verification is the fix, not size avoidance.
// The pre-push hook (githooks/pre-push -> verify-dist.js) is the safety net that
// makes this stick every iteration without anyone having to remember it.
// ============================================================================
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const ROOT=__dirname;

// Mount-truncation hard ceiling: any input over this is at high risk of a short
// read; split it (precedent app.a/app.b, commit 1ff0ef1).
const MAX_INPUT_BYTES=40960;

// Canonical input list (order matters for the stamp AND for assembly).
const INPUTS=["src/index.html","src/styles.css","src/app.a.js","src/app.c.js","src/app.b.js","cc-data.js"];

function die(msg){console.error("BUILD ABORTED: "+msg);process.exit(1);}

// Read a file and PROVE it wasn't truncated by the mount: bytes read must equal
// the size the filesystem reports. statSync reads metadata (reliable size) while
// readFileSync reads content (the thing that truncates) — comparing them catches
// a short read that a size-only check would miss.
function readChecked(rel){
  const p=path.join(ROOT,rel);
  const sz=fs.statSync(p).size;
  if(sz>MAX_INPUT_BYTES) die(rel+" is "+sz+" bytes (>"+MAX_INPUT_BYTES+"). The mount truncates large reads and will silently corrupt the build. Split it into two <40KB parts (see app.a.js/app.b.js, commit 1ff0ef1).");
  const buf=fs.readFileSync(p);
  if(buf.length!==sz) die("TRUNCATED READ of "+rel+" — read "+buf.length+" bytes but file is "+sz+". The sandbox mount returned a short read; re-run the build on a trusted/local filesystem. NOT deploying.");
  return buf;
}

// Stamp = hash of the RAW inputs (not the output) in canonical order. verify-dist.js
// recomputes this from current src to detect a stale dist. Exported so the verifier
// uses the EXACT same definition (single source of truth).
function computeStamp(bufs){
  const h=crypto.createHash("sha256");
  INPUTS.forEach((rel,i)=>{h.update(rel+"\0");h.update(bufs[i]);h.update("\0");});
  return h.digest("hex").slice(0,16);
}
const STAMP_RE=/<!-- cc-build:([0-9a-f]{16}) -->/;
// The template's data placeholder is two ADJACENT markers; cc-data.js is injected
// BETWEEN them and legitimately KEEPS its marker wrapper in the output (every shipped
// build since v2.0.0 has them). So "marker string present" is NOT a failure. The real
// failure is an EMPTY block — markers with only whitespace between — meaning cc-data.js
// was never injected. Match THAT, not the bare marker.
const EMPTY_DATA_BLOCK=/\/\*__CC_DATA_START__\*\/\s*\/\*__CC_DATA_END__\*\//;
module.exports={INPUTS,MAX_INPUT_BYTES,readChecked,computeStamp,STAMP_RE,EMPTY_DATA_BLOCK,die,ROOT};

// When required by verify-dist.js, only the helpers above are used. The build
// itself runs only when this file is executed directly.
function build(){
  const bufs=INPUTS.map(readChecked);
  const byName={};INPUTS.forEach((rel,i)=>{byName[rel]=bufs[i];});
  const tpl =byName["src/index.html"].toString("utf8");
  const css =byName["src/styles.css"].toString("utf8").replace(/\n$/,"");
  const app =(byName["src/app.a.js"].toString("utf8")+byName["src/app.c.js"].toString("utf8")+byName["src/app.b.js"].toString("utf8")).replace(/\n$/,"");
  const data=byName["cc-data.js"].toString("utf8").trim();

  const re=/\/\*__CC_DATA_START__\*\/[\s\S]*?\/\*__CC_DATA_END__\*\//;
  if(!re.test(tpl)) die("DATA MARKERS NOT FOUND in src/index.html");
  if(!tpl.includes("__CC_STYLES__")) die("__CC_STYLES__ NOT FOUND in src/index.html");
  if(!tpl.includes("__CC_APP__")) die("__CC_APP__ NOT FOUND in src/index.html");

  const ver=(tpl.match(/id="badge-ver"[^>]*>(v[0-9.]+)/)||[])[1];
  if(!ver) die("could not read version (badge-ver) from src/index.html");

  const stamp=computeStamp(bufs);
  let out=tpl.replace("__CC_STYLES__",()=>css).replace(re,()=>data).replace("__CC_APP__",()=>app);
  // Inject the stamp as an HTML comment right before </html> (NOT part of the hash).
  out=out.replace(/<\/html>\s*$/,"<!-- cc-build:"+stamp+" -->\n</html>\n");

  // ---- OUTPUT SELF-CHECK: prove nothing was dropped during assembly --------
  const problems=[];
  if(out.includes("__CC_STYLES__")||out.includes("__CC_APP__")) problems.push("a placeholder survived the replace");
  if(EMPTY_DATA_BLOCK.test(out)) problems.push("data block is empty — cc-data.js was not injected");
  if(!out.includes(css.slice(-40))) problems.push("CSS tail missing from output");
  if(!out.includes(data.slice(-40))) problems.push("data tail missing from output");
  if(!out.includes(app.slice(-80))) problems.push("APP tail missing from output (timer/app code truncated)");
  if(!out.includes(ver)) problems.push("version "+ver+" missing from output");
  if(!STAMP_RE.test(out)) problems.push("build stamp missing from output");
  if(problems.length) die("output self-check failed: "+problems.join("; ")+". NOT writing dist.");

  fs.writeFileSync(path.join(ROOT,"dist","index.html"),out);
  const wrote=fs.statSync(path.join(ROOT,"dist","index.html")).size;
  console.log("built dist/index.html "+wrote+" bytes  version="+ver+"  stamp="+stamp);
  console.log("next: `node verify-dist.js` (the pre-push hook runs it automatically), then git push.");
}
if(require.main===module) build();
