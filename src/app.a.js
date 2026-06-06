  var unwrap=CCData.unwrap,deepText=CCData.deepText,toText=CCData.deepText,parseProps=CCData.parseProps;
  var SERVER="mcp__b47f7667-3cb0-4d8e-bbaf-fa1fca4c39c7__";
  var T={fetch:SERVER+"notion-fetch",search:SERVER+"notion-search",update:SERVER+"notion-update-page",create:SERVER+"notion-create-pages"};
  var STATE_PAGE="37478f3d-415b-814c-8c65-dd76b6ab9aa3";
  var DBS={tasks:"fb432308-59b9-4078-92db-a83c6279957d",wins:"f99a9128-9809-48b9-9cb6-870717bd5183",routines:"17f7f036-e24c-40ce-9d41-db5d8a66b618",capture:"35ba4e31-eca6-4ab7-8625-acc41d5341e8",focusSessions:"291cb585-746e-4195-a920-b0ac460fbbf6"};
  var AREA_TAG={"Focus & Work":"purple","Daily Routines":"green","Health & Sleep":"amber","Finances":"yellow","Home & Space":"blue","Relationships":"red","Claude Tasks":"cyan"};
  var AREAS=["Daily Routines","Focus & Work","Health & Sleep","Finances","Home & Space","Relationships","Claude Tasks"];

  // ---- Embedded snapshot (real data) so the dashboard is never blank, even before the live bridge connects ----
  /*__SNAPSHOT_START__*/var SNAPSHOT={
    streak:12,lastCompleted:"2026-06-03",lastWinDate:"2026-06-03",lastStreakDate:"2026-06-03",focusMinutesToday:0,
    routines:[
      {id:"37478f3d-415b-81a2-ae4b-eae68ccfdcc3",name:"Drink a glass of water",when:"Morning",mins:2,why:"Hydration fires up your brain before caffeine",order:1,done:false},
      {id:"37478f3d-415b-8105-8cd2-da8e437d632f",name:"Get bright light",when:"Morning",mins:5,why:"Open blinds or step outside — kills morning melatonin",order:2,done:false},
      {id:"37478f3d-415b-81ab-b9b0-f6925e4c58b4",name:"Coffee or tea",when:"Morning",mins:5,why:"Your earned reward for getting up",order:3,done:false},
      {id:"37478f3d-415b-819c-82eb-f99406c32b3b",name:"Quick movement",when:"Morning",mins:10,why:"5–10 min walk, stretch, or anything physical",order:4,done:false},
      {id:"37478f3d-415b-81d6-8af9-e52e519cabe7",name:"Get dressed & ready",when:"Morning",mins:15,why:"Clothes laid out the night before",order:5,done:false},
      {id:"37478f3d-415b-812b-aed8-cd41738fe375",name:"One small win",when:"Morning",mins:2,why:"Do one tiny thing that builds momentum",order:7,done:false},
      {id:"37478f3d-415b-814b-9feb-ea14b8c70a67",name:"Evening shutdown — plan tomorrow",when:"Evening",mins:10,why:"Lay out tomorrow's top 3 and clothes",order:8,done:false}
    ],
    tasks:[
      {id:"37478f3d-415b-810f-b6bb-ddc7cba78f30",title:"McCleary Estate Return (Husband) — file by Oct 5, 2026",area:"Focus & Work",done:false,priority:true},
      {id:"37478f3d-415b-816a-b403-e6fa655cc0ea",title:"Makani A Kai Sewer Expenses Report — see Steve's 06/02 email",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-8151-a124-c1325d0fff16",title:"Perry Tax Return",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-8153-947e-c184d01ae704",title:"Awa Lucero Tax Returns",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-8165-b9b8-c7578eb50989",title:"Shaina Kalama",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-814b-afa1-d52f5dd71b1f",title:"Scott Kenar — 2025 Return + 1955 Main Street Tax Load",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-81ae-a4ec-dc3c6f47edb2",title:"Email — Royal Menehune Insurance Invoice",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-81ce-a0c2-c9792d8a31b5",title:"Email — Eve FSA Question re C-corp",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-8102-9ff8-f40d00f944a5",title:"HanaHou 2024-2025 Returns, QuickBooks processes",area:"Focus & Work",done:false,priority:false},
      {id:"37478f3d-415b-8155-bf0a-c096db14124b",title:"Research website replacement for MAGS — need new POS vendor",area:"Claude Tasks",done:false,priority:false},
      {id:"37478f3d-415b-8162-8bd6-d7cc1046aba6",title:"Bookkeeping Enrichment Pipeline continuation",area:"Claude Tasks",done:false,priority:false},
      {id:"37478f3d-415b-81cc-86d9-cab541a9e811",title:"Authenticator notes for password migration project",area:"Claude Tasks",done:false,priority:false},
      {id:"37478f3d-415b-8172-9360-e89528214d1f",title:"Continue with Git and GitHub integration",area:"Claude Tasks",done:false,priority:false},
      {id:"37478f3d-415b-8162-b577-cde6d3f783d1",title:"Note: next Command Center version uses SemVer numbering",area:"Claude Tasks",done:false,priority:false},
      {id:"37478f3d-415b-815b-a818-e7189f443a58",title:"Plan a faster method to pay off furniture",area:"Finances",done:false,priority:false}
    ],
    wins:[
      {title:"Turned 42 today",date:"2026-06-02"},
      {title:"Transitioned Desktop data for MAGS to QB Online",date:"2026-06-01"},
      {title:"Splashtop set up to remote to office computer from home",date:"2026-06-01"},
      {title:"iDrive set up for office and payroll computers",date:"2026-06-01"},
      {title:"Updated condo insurance schedules",date:"2026-05-28"},
      {title:"Completed Gushiken",date:"2026-05-28"},
      {title:"Closed 2025 Books with Claude in QBO",date:"2026-05-27"},
      {title:"Woke up, initiated new command center; new task list doing what I wanted",date:"2026-05-25"},
      {title:"Redeployed fixed version which we are now using",date:"2026-05-24"},
      {title:"Debugged the problem with command center app rebuild",date:"2026-05-24"},
      {title:"Rebuilt Command Center app",date:"2026-05-24"},
      {title:"Picked up final preparation items for painting",date:"2026-05-23"},
      {title:"Completed MAGS books",date:"2026-05-23"},
      {title:"Worked with Kainoa on setting up skills for Claude usage",date:"2026-05-22"},
      {title:"Iterated through v7 on the Command Center app — looking good",date:"2026-05-22"},
      {title:"Restarted working on the Command Center App, deployed v3",date:"2026-05-22"}
    ]
  };/*__SNAPSHOT_END__*/

  var app={mode:"snapshot",state:null,stateJson:"",tasks:[],routines:[],wins:[],caps:[],error:false};

  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function clone(o){return JSON.parse(JSON.stringify(o));}

  // ---- localStorage overlay (keeps offline edits across reloads) ----
  var LSKEY="cc_v120_local";
  function lsGet(){try{return JSON.parse(localStorage.getItem(LSKEY)||"{}")||{};}catch(e){return {};}}
  function lsSet(o){try{localStorage.setItem(LSKEY,JSON.stringify(o));}catch(e){}}
  function lsPush(op){var o=lsGet();o.pending=o.pending||[];o.pending.push(op);lsSet(o);}
  function lsClear(){var o=lsGet();o.pending=[];lsSet(o);}
  function lsRemove(op){var o=lsGet();o.pending=(o.pending||[]).filter(function(p){return JSON.stringify(p)!==JSON.stringify(op);});lsSet(o);}
  // ---- localStorage data cache: last-known-good live dataset, so phone/home boot instantly with real data ----
  var CACHEKEY="cc_v130_cache";
  function cacheSave(){try{localStorage.setItem(CACHEKEY,JSON.stringify({v:"1.3.0",ts:Date.now(),state:app.state,tasks:app.tasks,routines:app.routines,wins:app.wins,caps:app.caps}));}catch(e){}}
  function cacheLoad(){try{var o=JSON.parse(localStorage.getItem(CACHEKEY)||"null");return (o&&o.tasks&&o.state)?o:null;}catch(e){return null;}}

  // ---- v1.5.0 daily report: localStorage guard + Capture-DB append ----
  function reportKey(d){return "cc_report_"+d;}
  function hasReport(d){try{return !!localStorage.getItem(reportKey(d));}catch(e){return false;}}
  function saveReport(d,txt){try{localStorage.setItem(reportKey(d),txt);}catch(e){}}
  // background-only: persist the report to the Capture DB, hidden from triage (Processed=YES)
  function pushReportToNotion(d,txt){
    var op={t:"report",date:d,txt:txt};
    lsPush(op);
    if(app.mode!=="live")return;
    call(T.create,{parent:{data_source_id:DBS.capture},pages:[{properties:{
      Item:"[Daily Report "+d+"]", Notes:txt, Processed:"__YES__", "date:Captured:start":d
    }}]}).then(function(){lsRemove(op);}).catch(function(){});
  }

  // parsing helpers (unwrap/deepText/toText/parseProps) provided by CCData via aliases above; toObj kept inline
  function toObj(r){
    if(r&&typeof r==="object"&&!Array.isArray(r)&&(r.results||r.pages||r.properties))return r;
    var t=unwrap(r);
    for(var i=0;i<4;i++){try{var o=JSON.parse((t||"").trim());if(o&&typeof o==="object"){if(o.results||o.pages||o.properties)return o;if(typeof o.text==="string"){t=o.text;continue;}return o;}}catch(e){}var m=t.match(/\{[\s\S]*\}/);if(m){try{var o2=JSON.parse(m[0]);if(o2&&typeof o2==="object")return o2;}catch(e2){}}break;}
    return null;
  }

  function hstDate(d){try{return new Intl.DateTimeFormat("en-CA",{timeZone:"Pacific/Honolulu",year:"numeric",month:"2-digit",day:"2-digit"}).format(d||new Date());}catch(e){return (d||new Date()).toISOString().slice(0,10);}}
  function hstParts(d){try{var p=new Intl.DateTimeFormat("en-GB",{timeZone:"Pacific/Honolulu",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(d||new Date());var o={};p.forEach(function(x){o[x.type]=x.value;});return o;}catch(e){var n=d||new Date();return{hour:String(n.getHours()).padStart(2,"0"),minute:String(n.getMinutes()).padStart(2,"0"),second:String(n.getSeconds()).padStart(2,"0")};}}
  function prettyDate(iso){if(!iso)return"";var p=String(iso).slice(0,10).split("-");if(p.length<3)return iso;var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return p[2]+" "+mo[(+p[1]||1)-1];}
  function todayHST(){return hstDate();}

  // ---- bridge ----
  var DIAG={last:null,name:"",err:""};
  function hasBridge(){return !!(window.cowork&&typeof window.cowork.callMcpTool==="function");}
  var PROXY_URL="/.netlify/functions/notion-proxy";
  async function call(name,args){
    if(!hasBridge()){
      try{
        var resp=await fetch(PROXY_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name,args:args})});
        if(!resp.ok){var bt="";try{bt=await resp.text();}catch(_e){}throw new Error("proxy "+resp.status+(bt?(" "+bt.slice(0,140)):""));}
        var j=await resp.json();DIAG.last=j;DIAG.name=name;DIAG.err="";window.__ccDiag=DIAG;return j;
      }catch(e){DIAG.err=String((e&&e.message)||e);DIAG.name=name;window.__ccDiag=DIAG;throw e;}
    }
    try{var r=await window.cowork.callMcpTool(name,args);DIAG.last=r;DIAG.name=name;DIAG.err="";window.__ccDiag=DIAG;return r;}
    catch(e){DIAG.err=String((e&&e.message)||e);DIAG.name=name;window.__ccDiag=DIAG;throw e;}
  }
  function waitBridge(ms){return new Promise(function(res){var waited=0,step=250;if(hasBridge())return res(true);var iv=setInterval(function(){waited+=step;if(hasBridge()){clearInterval(iv);res(true);}else if(waited>=ms){clearInterval(iv);res(false);}},step);});}
  function showDiag(){
    var info="mode: "+app.mode+"\nhasBridge: "+hasBridge()+"\n";
    info+="window.cowork: "+(window.cowork?("object {"+Object.keys(window.cowork).join(", ")+"}"):"undefined")+"\n";
    info+="last tool: "+DIAG.name+(DIAG.err?("  ERROR: "+DIAG.err):"")+"\n";
    info+="loaded → tasks:"+app.tasks.length+" routines:"+app.routines.length+" wins:"+app.wins.length+" caps:"+app.caps.length+"\n";
    var wk=[];try{for(var k in window){if(/cowork|claude|mcp|tool|anthropic/i.test(k))wk.push(k);}}catch(e){}
    info+="window matches: "+wk.join(", ")+"\n";
    info+="\nlast unwrap()[0..900]:\n"+unwrap(DIAG.last).slice(0,900);
    try{console.log("[CMDCenter diag]",DIAG,window.cowork);}catch(e){}
    try{alert(info);}catch(e){}
  }

  function setSync(kind,msg){
    var p=$("pill-live");
    if(kind==="live"){p.className="pill live";$("live-label").textContent="Live";}
    else if(kind==="snap"){p.className="pill snap";$("live-label").textContent="Snapshot";}
    else{p.className="pill err";$("live-label").textContent="Offline";}
    $("sync-status").textContent=msg||"";
  }
  var toastTimer=null;
  function toast(msg){var t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove("show");},1800);}
  function noteQueued(){
    var pc=(lsGet().pending||[]).length;
    if(pc>0)setSync(app.mode==="live"?"live":"snap",pc+" change"+(pc===1?"":"s")+" queued — press Sync to retry");
  }
  function ring(id,pct){var c=$(id);if(!c)return;var off=314*(1-Math.max(0,Math.min(1,pct)));c.setAttribute("stroke-dashoffset",off.toFixed(1));}

  // ---- snapshot load ----
  function loadSnapshot(){
    app.state={streak:SNAPSHOT.streak,lastCompleted:SNAPSHOT.lastCompleted,lastWinDate:SNAPSHOT.lastWinDate,lastStreakDate:SNAPSHOT.lastStreakDate,focusMinutesToday:SNAPSHOT.focusMinutesToday,taskIds:SNAPSHOT.tasks.map(function(t){return t.id;})};
    app.tasks=clone(SNAPSHOT.tasks).map(function(t){t.area=t.area||"";t.due=t.due||"";t.energy="";t.time="";return t;});
    app.routines=clone(SNAPSHOT.routines);
    app.wins=clone(SNAPSHOT.wins);
    app.caps=[];
    applyLocal();
  }
  function applyLocal(){
    var o=lsGet();var p=o.pending||[];
    p.forEach(function(op){
      if(op.t==="task"){var x=app.tasks.filter(function(z){return z.id===op.id;})[0];if(x)x.done=op.done;}
      else if(op.t==="prio"){var xp=app.tasks.filter(function(z){return z.id===op.id;})[0];if(xp)xp.priority=op.priority;}
      else if(op.t==="routine"){var r=app.routines.filter(function(z){return z.id===op.id;})[0];if(r)r.done=op.done;}
      else if(op.t==="taskAdd"){app.tasks.unshift({id:op.tmpid,title:op.title,area:op.area||"Focus & Work",done:false,priority:false,due:"",energy:"",time:""});}
      else if(op.t==="win"){app.wins.unshift({title:op.title,date:op.date});}
      else if(op.t==="cap"){app.caps.unshift({id:null,item:op.item});}
      else if(op.t==="focus"){app.state.focusMinutesToday=(+app.state.focusMinutesToday||0)+op.min;}
      else if(op.t==="capDel"){app.caps=app.caps.filter(function(z){return z.id!==op.id;});}
      else if(op.t==="state"){Object.assign(app.state,op.updates);}
    });
  }

  // ---- live load ----
  // parseProps provided by CCData (aliased above)
  async function fetchPage(id){try{return await call(T.fetch,{id:id});}catch(e){return null;}}
  async function searchIds(dsKey,q,n){try{var r=await call(T.search,{query:q||"a",data_source_url:"collection://"+DBS[dsKey],content_search_mode:"workspace_search",page_size:n||25,max_highlight_length:0});var o=toObj(r);var res=(o&&o.results)||[];return res.map(function(x){return{id:x.id,title:x.title};});}catch(e){return[];}}
  async function readState(){
    var r=await call(T.fetch,{id:STATE_PAGE});var t=toText(r);
    var m=t.match(/```json\s*([\s\S]*?)```/);var js=m?m[1].trim():null;
    if(!js){var m2=t.match(/\{[\s\S]*"taskIds"[\s\S]*?\}/);if(m2)js=m2[0].trim();}
    var obj=null;if(js){try{obj=JSON.parse(js);}catch(e){}}
    if(obj){app.state=obj;app.stateJson=js;if(obj.databases){for(var k in obj.databases)DBS[k]=obj.databases[k];}}
    return obj;
  }
  async function liveLoad(){
    await readState();
    var ids=(app.state&&app.state.taskIds||[]).slice(0,40);
    if(!ids.length){var f=await searchIds("tasks","task",25);ids=f.map(function(x){return x.id;});}
    var tasks=[];
    await Promise.all(ids.map(async function(id){var r=await fetchPage(id);var p=r&&parseProps(r);if(p)tasks.push(CCData.normalizeTask(id,p));}));
    if(tasks.length){app.tasks=CCData.rankTasks(tasks,hstDate());}
    var _chk=CCData.assertReadComplete(ids,app.tasks);if(!_chk.ok){DIAG.err="missing tasks: "+_chk.missing.join(",");}
    var rids=(app.state&&app.state.routineIds||[]).slice(0,40);
    var rf=rids.length?rids.map(function(id){return{id:id};}):await searchIds("routines","routine",25);
    var routines=[];
    await Promise.all(rf.map(async function(f){var r=await fetchPage(f.id);var p=r&&parseProps(r);if(!p)return;var nr=CCData.normalizeRoutine(f.id,p);if(!nr.active)return;routines.push(nr);}));
    if(routines.length){routines.sort(function(a,b){return a.order-b.order;});app.routines=routines;}
    var wf=await searchIds("wins","win",14);var wins=[];
    await Promise.all(wf.map(async function(f){var r=await fetchPage(f.id);var p=r&&parseProps(r);var w=CCData.normalizeWin(f.id,p||{});if((!p||!p.Win)&&f.title)w.title=f.title;wins.push(w);}));
    if(wins.length){wins.sort(function(a,b){return (b.date||"").localeCompare(a.date||"");});app.wins=wins;}
    var cf=await searchIds("capture","note idea",20);var caps=[];
    await Promise.all(cf.map(async function(f){var r=await fetchPage(f.id);var p=r&&parseProps(r);if(!p||p.Processed==="__YES__")return;caps.push({id:f.id,item:p.Item||f.title||"(note)"});}));
    app.caps=caps;
  }
  async function flushPending(){
    var o=lsGet();var p=o.pending||[];if(!p.length)return 0;
    var failed=[];
    for(var i=0;i<p.length;i++){var op=p[i];try{
      if(op.t==="task")await call(T.update,{page_id:op.id,command:"update_properties",properties:{Done:op.done?"__YES__":"__NO__"}});
      else if(op.t==="prio")await call(T.update,{page_id:op.id,command:"update_properties",properties:{Priority:op.priority?"__YES__":"__NO__"}});
      else if(op.t==="routine")await call(T.update,{page_id:op.id,command:"update_properties",properties:{"Done Today":op.done?"__YES__":"__NO__"}});
      else if(op.t==="taskAdd"){
        // replay-safe: adopt an existing row with the same title (dedupe), else create; always register the id
        var tid=null;
        var existing=await searchIds("tasks",op.title,100);
        var hit=existing.filter(function(x){return x.title===op.title;})[0];
        if(hit){tid=hit.id;}
        else{
          var tr=await call(T.create,{parent:{data_source_id:DBS.tasks},pages:[{properties:{Task:op.title,Area:op.area||"Focus & Work",Done:"__NO__","date:Created:start":todayHST()}}]});
          var to=toObj(tr);tid=to&&to.pages&&to.pages[0]&&to.pages[0].id;
        }
        if(!tid)throw new Error("taskAdd replay: no id");
        var lt=app.tasks.filter(function(x){return x.id===op.tmpid;})[0];if(lt)lt.id=tid;
        await saveState({taskIds:CCData.registerId(app.state.taskIds,tid)});
      }
      else if(op.t==="win")await call(T.create,{parent:{data_source_id:DBS.wins},pages:[{properties:{Win:op.title,"date:Date:start":op.date}}]});
      else if(op.t==="cap")await call(T.create,{parent:{data_source_id:DBS.capture},pages:[{properties:{Item:op.item,Processed:"__NO__","date:Captured:start":todayHST()}}]});
      else if(op.t==="focus")await call(T.create,{parent:{data_source_id:DBS.focusSessions},pages:[{properties:{Session:"Focus "+op.min+"m "+todayHST(),"date:Date:start":todayHST(),Minutes:op.min,Type:"Focus"}}]});
      else if(op.t==="capDel")await call(T.update,{page_id:op.id,command:"update_properties",properties:{Processed:"__YES__"}});
      else if(op.t==="report")await call(T.create,{parent:{data_source_id:DBS.capture},pages:[{properties:{Item:"[Daily Report "+op.date+"]",Notes:op.txt,Processed:"__YES__","date:Captured:start":op.date}}]});
      else if(op.t==="state")await writeStateNow(op.updates);
    }catch(e){failed.push(op);}}
    var o2=lsGet();o2.pending=failed;lsSet(o2);
    return failed.length;
  }
  async function writeStateNow(updates){
    var fresh=await call(T.fetch,{id:STATE_PAGE});
    var md=CCData.deepText(fresh);
    var mm=md.match(/```json\s*([\s\S]*?)```/);
    var curJson=mm?mm[1].trim():JSON.stringify(app.state);
    var newJson=CCData.mergeState(curJson,updates);
    var newMd=CCData.replaceStateBlock(md,newJson);
    await call(T.update,{page_id:STATE_PAGE,command:"update_content",content_updates:[{old_str:md,new_str:newMd}]});
    app.stateJson=newJson;app.state=JSON.parse(newJson);
  }
  async function saveState(updates){
    Object.assign(app.state,updates);
    if(app.mode!=="live"){lsPush({t:"state",updates:updates});return;}
    for(var attempt=0;attempt<2;attempt++){
      try{await writeStateNow(updates);return;}
      catch(e){if(attempt===1){DIAG.err="saveState failed: "+((e&&e.message)||e);lsPush({t:"state",updates:updates});noteQueued();}}
    }
  }

  // ---- actions (work in both modes; live also writes Notion) ----
  async function maybeStreak(){var t=todayHST();var s=app.state;if(s.lastCompleted===t&&s.lastWinDate===t&&s.lastStreakDate!==t){var ns=(+s.streak||0)+1;await saveState({streak:ns,lastStreakDate:t});toast("Streak → "+ns+" days");renderTopStats();}}
  async function toggleTask(t){
    t.done=!t.done;renderTasks();if(typeof renderTaskSections==="function")renderTaskSections();
    lsPush({t:"task",id:t.id,done:t.done});
    if(app.mode==="live"){try{await call(T.update,{page_id:t.id,command:"update_properties",properties:{Done:t.done?"__YES__":"__NO__"}});lsRemove({t:"task",id:t.id,done:t.done});}catch(e){noteQueued();}}
    if(t.done){await saveState({lastCompleted:todayHST()});await maybeStreak();}
    renderTopStats();
  }
  async function togglePriority(t){
    t.priority=!t.priority;renderTasks();syncPrioStar(t.id,t.priority);renderTopStats();toast(t.priority?"Marked priority ★":"Priority cleared");
    lsPush({t:"prio",id:t.id,priority:t.priority});
    if(app.mode==="live"){try{await call(T.update,{page_id:t.id,command:"update_properties",properties:{Priority:t.priority?"__YES__":"__NO__"}});lsRemove({t:"prio",id:t.id,priority:t.priority});}catch(e){noteQueued();}}
  }
  async function toggleRoutine(r){
    r.done=!r.done;renderSteps();renderRoutineEditor();renderTopStats();
    lsPush({t:"routine",id:r.id,done:r.done});
    if(app.mode==="live"){try{await call(T.update,{page_id:r.id,command:"update_properties",properties:{"Done Today":r.done?"__YES__":"__NO__","date:Last Done:start":r.done?todayHST():null}});lsRemove({t:"routine",id:r.id,done:r.done});}catch(e){noteQueued();}}
  }
  async function addTask(title,area){title=(title||"").trim();if(!title)return;area=area||"Focus & Work";var tmp="tmp-"+Date.now();app.tasks.unshift({id:tmp,title:title,area:area,done:false,priority:false,due:"",energy:"",time:""});renderTasks();if(typeof renderTaskSections==="function")renderTaskSections();renderTopStats();toast("Task added");
    var op={t:"taskAdd",title:title,tmpid:tmp,area:area};lsPush(op);
    if(app.mode==="live"){try{var r=await call(T.create,{parent:{data_source_id:DBS.tasks},pages:[{properties:{Task:title,Area:area,Done:"__NO__","date:Created:start":todayHST()}}]});var o=toObj(r);var id=o&&o.pages&&o.pages[0]&&o.pages[0].id;if(id){app.tasks[0].id=id;lsRemove(op);await saveState({taskIds:CCData.registerId(app.state.taskIds,id)});}}catch(e){noteQueued();}}
  }
  async function addCapture(item){item=(item||"").trim();if(!item)return;app.caps.unshift({id:null,item:item});renderCaps();renderTopStats();toast("Captured");
    lsPush({t:"cap",item:item});
    if(app.mode==="live"){try{var rc=await call(T.create,{parent:{data_source_id:DBS.capture},pages:[{properties:{Item:item,Processed:"__NO__","date:Captured:start":todayHST()}}]});var oc=toObj(rc);var cid=oc&&oc.pages&&oc.pages[0]&&oc.pages[0].id;if(cid&&app.caps[0])app.caps[0].id=cid;lsRemove({t:"cap",item:item});}catch(e){noteQueued();}}
  }
  async function promoteCapture(idx, area){
    var c=app.caps[idx];if(!c)return;area=area||"Focus & Work";
    var capId=c.id;var item=c.item;var tmp="tmp-"+Date.now();
    app.tasks.unshift({id:tmp,title:item,area:area,done:false,priority:false,due:"",energy:"",time:""});
    app.caps.splice(idx,1);
    renderTasks();if(typeof renderTaskSections==="function")renderTaskSections();renderCaps();renderTopStats();toast("Promoted to "+area);
    var op={t:"taskAdd",title:item,tmpid:tmp,area:area};lsPush(op);
    if(capId)lsPush({t:"capDel",id:capId});
    if(app.mode==="live"){try{
      var r=await call(T.create,{parent:{data_source_id:DBS.tasks},pages:[{properties:{Task:item,Area:area,Done:"__NO__","date:Created:start":todayHST()}}]});
      var o=toObj(r);var id=o&&o.pages&&o.pages[0]&&o.pages[0].id;
      if(id){var nt=app.tasks.filter(function(x){return x.id===tmp;})[0];if(nt)nt.id=id;lsRemove(op);await saveState({taskIds:CCData.registerId(app.state.taskIds,id)});}
      if(capId){await call(T.update,{page_id:capId,command:"update_properties",properties:{Processed:"__YES__"}});lsRemove({t:"capDel",id:capId});}
    }catch(e){noteQueued();toast("Promote queued — will finish on next sync");}}
  }
  async function deleteCapture(idx){
    var c=app.caps[idx];if(!c)return;var capId=c.id;var item=c.item;
    app.caps.splice(idx,1);renderCaps();renderTopStats();toast("Deleted");
    if(!capId){
      var o=lsGet();o.pending=(o.pending||[]).filter(function(p){return !(p.t==="cap"&&p.item===item);});lsSet(o);
      return;
    }
    lsPush({t:"capDel",id:capId});
    if(app.mode==="live"){try{await call(T.update,{page_id:capId,command:"update_properties",properties:{Processed:"__YES__"}});lsRemove({t:"capDel",id:capId});}catch(e){noteQueued();}}
  }
  async function addWin(title){title=(title||"").trim();if(!title)return;var d=todayHST();app.wins.unshift({title:title,date:d});renderWins();renderTopStats();toast("Win logged");
    lsPush({t:"win",title:title,date:d});
    if(app.mode==="live"){try{await call(T.create,{parent:{data_source_id:DBS.wins},pages:[{properties:{Win:title,"date:Date:start":d}}]});lsRemove({t:"win",title:title,date:d});}catch(e){noteQueued();}}
    await saveState({lastWinDate:d});await maybeStreak();
  }
  async function logFocus(min){var fm=(+app.state.focusMinutesToday||0)+min;app.state.focusMinutesToday=fm;renderTopStats();
    lsPush({t:"focus",min:min});
    if(app.mode==="live"){try{await call(T.create,{parent:{data_source_id:DBS.focusSessions},pages:[{properties:{Session:"Focus "+min+"m "+todayHST(),"date:Date:start":todayHST(),Minutes:min,Type:"Focus"}}]});await saveState({focusMinutesToday:fm});lsRemove({t:"focus",min:min});}catch(e){noteQueued();}}
  }

