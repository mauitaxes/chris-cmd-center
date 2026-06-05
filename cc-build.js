// Command Center build: assembles src/ modules + cc-data.js into dist/index.html
// Single atomic writeFileSync -> no partial/truncated output.
const fs=require("fs"),path=require("path");
const ROOT=__dirname;
const tpl =fs.readFileSync(path.join(ROOT,"src","index.html"),"utf8");
const css =fs.readFileSync(path.join(ROOT,"src","styles.css"),"utf8").replace(/\n$/,"");
const app =fs.readFileSync(path.join(ROOT,"src","app.js"),"utf8").replace(/\n$/,"");
const data=fs.readFileSync(path.join(ROOT,"cc-data.js"),"utf8").trim();
const re=/\/\*__CC_DATA_START__\*\/[\s\S]*?\/\*__CC_DATA_END__\*\//;
if(!re.test(tpl)){console.error("DATA MARKERS NOT FOUND");process.exit(1);}
if(!tpl.includes("__CC_STYLES__")){console.error("__CC_STYLES__ NOT FOUND");process.exit(1);}
if(!tpl.includes("__CC_APP__")){console.error("__CC_APP__ NOT FOUND");process.exit(1);}
const out=tpl.replace("__CC_STYLES__",()=>css).replace(re,()=>data).replace("__CC_APP__",()=>app);
fs.writeFileSync(path.join(ROOT,"dist","index.html"),out);
console.log("built dist/index.html",fs.statSync(path.join(ROOT,"dist","index.html")).size,"bytes");
