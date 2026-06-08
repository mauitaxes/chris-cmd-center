// Command Center build: assembles src/ modules + cc-data.js into dist/index.html
// Single atomic writeFileSync -> no partial/truncated output.
const fs=require("fs"),path=require("path");
const ROOT=__dirname;
// Mount-truncation guard: the bash mount silently truncates reads ~44KB, which can corrupt
// the build/commit. Keep every build input <40KB (split if needed; precedent app.a/app.b 1ff0ef1).
const MAX_INPUT_BYTES=40960;
["src/index.html","src/styles.css","src/app.a.js","src/app.c.js","src/app.b.js","cc-data.js"].forEach(function(rel){
  const sz=fs.statSync(path.join(ROOT,rel)).size;
  if(sz>MAX_INPUT_BYTES){console.error("BUILD ABORTED: "+rel+" is "+sz+" bytes (>"+MAX_INPUT_BYTES+"). The bash mount truncates reads ~44KB and will silently corrupt the build/commit. Split this file into two <40KB parts (see app.a.js/app.b.js, commit 1ff0ef1).");process.exit(1);}
});
const tpl =fs.readFileSync(path.join(ROOT,"src","index.html"),"utf8");
const css =fs.readFileSync(path.join(ROOT,"src","styles.css"),"utf8").replace(/\n$/,"");
const app =(fs.readFileSync(path.join(ROOT,"src","app.a.js"),"utf8")+fs.readFileSync(path.join(ROOT,"src","app.c.js"),"utf8")+fs.readFileSync(path.join(ROOT,"src","app.b.js"),"utf8")).replace(/\n$/,"");
const data=fs.readFileSync(path.join(ROOT,"cc-data.js"),"utf8").trim();
const re=/\/\*__CC_DATA_START__\*\/[\s\S]*?\/\*__CC_DATA_END__\*\//;
if(!re.test(tpl)){console.error("DATA MARKERS NOT FOUND");process.exit(1);}
if(!tpl.includes("__CC_STYLES__")){console.error("__CC_STYLES__ NOT FOUND");process.exit(1);}
if(!tpl.includes("__CC_APP__")){console.error("__CC_APP__ NOT FOUND");process.exit(1);}
const out=tpl.replace("__CC_STYLES__",()=>css).replace(re,()=>data).replace("__CC_APP__",()=>app);
fs.writeFileSync(path.join(ROOT,"dist","index.html"),out);
console.log("built dist/index.html",fs.statSync(path.join(ROOT,"dist","index.html")).size,"bytes");
