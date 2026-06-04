/*__CC_DATA_START__*/
(function(root, factory){
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CCData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  // -- Group 1: unwrap, deepText --
  function unwrap(r){
    if(r==null)return"";
    if(typeof r==="string")return r;
    if(Array.isArray(r.content))return r.content.map(function(c){return typeof c==="string"?c:(c&&c.text)||"";}).join("\n");
    if(Array.isArray(r))return r.map(function(c){return typeof c==="string"?c:(c&&c.text)||"";}).join("\n");
    if(typeof r.text==="string")return r.text;
    if(typeof r.result==="string")return r.result;
    if(r.result&&typeof r.result==="object")return unwrap(r.result);
    if(r.data&&typeof r.data==="object")return unwrap(r.data);
    try{return JSON.stringify(r);}catch(e){return String(r);}
  }
  function deepText(r){
    var s=unwrap(r);
    for(var i=0;i<6;i++){var t=(s||"").trim();
      if(t.charAt(0)==="{"||t.charAt(0)==="["){var o=null;try{o=JSON.parse(t);}catch(e){break;}
        if(o&&typeof o==="object"){if(typeof o.text==="string"){s=o.text;continue;}if(Array.isArray(o.content)){s=o.content.map(function(c){return(c&&c.text)||"";}).join("\n");continue;}}break;}
      break;}
    return s||"";
  }

  // -- Group 2: parseProps, normalizeTask --
  function parseProps(r){
    var t=deepText(r);
    var m=t.match(/<properties>\s*([\s\S]*?)<\/properties>/);
    if(m){try{return JSON.parse(m[1]);}catch(e){try{return JSON.parse(m[1].replace(/\\\\/g,'\\').replace(/\\"/g,'"'));}catch(e2){return null;}}}
    return null;
  }
  function normalizeTask(id, p){
    p=p||{};
    return { id:id, title:p.Task||p.title||"(task)", area:p.Area||"",
      done:p.Done==="__YES__", priority:p.Priority==="__YES__",
      due:p["date:Due Date:start"]||"", energy:p.Energy||"", time:p["Time Estimate"]||"" };
  }

  // -- Group 3: normalizeRoutine, normalizeWin, rankTasks --
  function normalizeRoutine(id, p){
    p=p||{};
    return { id:id, name:p.Routine||p.title||"(routine)", done:p["Done Today"]==="__YES__",
      when:p["Time Of Day"]||"", mins:+p.Mins||0, why:p.Why||"", order:+p.Order||99,
      // default to active: only an explicit "__NO__" deactivates
      active:p.Active!=="__NO__" };
  }
  function normalizeWin(id, p){ p=p||{}; return { id:id, title:p.Win||p.title||"(win)", date:p["date:Date:start"]||"" }; }
  function rankTasks(tasks, todayISO){
    function rank(t){ if(t.done)return 100; var s=0; if(t.priority)s-=4; if(t.due&&t.due<=todayISO)s-=3; return s; }
    return tasks.slice().sort(function(a,b){ return rank(a)-rank(b); });
  }

  // -- Group 4: mergeState, replaceStateBlock --
  function mergeState(currentJson, updates){
    var base={}; try{ base=JSON.parse(currentJson)||{}; }catch(e){ base={}; }
    for(var k in updates){ if(Object.prototype.hasOwnProperty.call(updates,k)) base[k]=updates[k]; }
    return JSON.stringify(base);
  }
  function replaceStateBlock(pageMarkdown, newJson){
    var fence="```json\n"+newJson+"\n```";
    var re=/```json\s*\{[\s\S]*?\}\s*```/;
    if(re.test(pageMarkdown)) return pageMarkdown.replace(re, fence);
    return (pageMarkdown.replace(/\s*$/,"")+"\n"+fence+"\n");
  }

  // -- Group 5: applyOps, assertReadComplete --
  function applyOps(base, ops){
    var s = JSON.parse(JSON.stringify(base));
    s.tasks=s.tasks||[]; s.wins=s.wins||[]; s.caps=s.caps||[];
    (ops||[]).forEach(function(op){
      if(op.t==="task"){var x=s.tasks.filter(function(z){return z.id===op.id;})[0]; if(x)x.done=op.done;}
      else if(op.t==="prio"){var xp=s.tasks.filter(function(z){return z.id===op.id;})[0]; if(xp)xp.priority=op.priority;}
      else if(op.t==="routine"){s.routines=s.routines||[]; var r=s.routines.filter(function(z){return z.id===op.id;})[0]; if(r)r.done=op.done;}
      else if(op.t==="taskAdd"){ if(!s.tasks.some(function(z){return z.id===op.tmpid;})) s.tasks.unshift({id:op.tmpid,title:op.title,area:"Focus & Work",done:false,priority:false,due:"",energy:"",time:""}); }
      else if(op.t==="win"){ s.wins.unshift({title:op.title,date:op.date}); }
      else if(op.t==="cap"){ s.caps.unshift({id:null,item:op.item}); }
      else if(op.t==="focus"){ s.focusMinutesToday=(+s.focusMinutesToday||0)+op.min; }
    });
    return s;
  }
  function assertReadComplete(ids, rows){
    var have={}; (rows||[]).forEach(function(r){ have[r.id]=1; });
    var missing=(ids||[]).filter(function(id){ return !have[id]; });
    return { ok: missing.length===0, missing: missing };
  }

  return {
    unwrap: unwrap,
    deepText: deepText,
    parseProps: parseProps,
    normalizeTask: normalizeTask,
    normalizeRoutine: normalizeRoutine,
    normalizeWin: normalizeWin,
    rankTasks: rankTasks,
    mergeState: mergeState,
    replaceStateBlock: replaceStateBlock,
    applyOps: applyOps,
    assertReadComplete: assertReadComplete
  };
});
/*__CC_DATA_END__*/
