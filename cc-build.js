const fs=require("fs");
const SRC=process.argv[2], DATA=process.argv[3], OUT=process.argv[4];
const html=fs.readFileSync(SRC,"utf8");
const data=fs.readFileSync(DATA,"utf8");
const re=/\/\*__CC_DATA_START__\*\/[\s\S]*?\/\*__CC_DATA_END__\*\//;
if(!re.test(html)){console.error("MARKERS NOT FOUND");process.exit(1);}
fs.writeFileSync(OUT, html.replace(re, data.trim()));
console.log("built",OUT,fs.statSync(OUT).size,"bytes");
