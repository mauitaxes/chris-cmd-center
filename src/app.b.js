  // ---- render ----
  function steps(){return app.routines.filter(function(r){return r.when==="Morning";});}
  function renderSteps(){
    var l=$("step-list");if(!l)return;var st=steps();
    if(!st.length){l.innerHTML='<div class="empty">No morning routine steps.</div>';}
    else{l.innerHTML=st.map(function(r){
      return '<div class="step '+(r.done?"is-done":"")+'">'+
        '<div class="chk '+(r.done?"on":"")+'" data-act="routine" data-id="'+esc(r.id)+'">'+(r.done?"✓":"")+'</div>'+
        '<div class="nm" style="grid-column:2;">'+esc(r.name)+'</div>'+
        '<div class="mins">'+(r.mins?("~"+r.mins+"m"):"")+'</div>'+
        (r.why?'<div class="why">'+esc(r.why)+'</div>':"")+
        '</div>';
    }).join("");}
    var done=st.filter(function(r){return r.done;}).length;
    if($("step-count"))$("step-count").textContent=done+" of "+st.length+" done";
  }
  function taskRowHtml(t){
    var today=hstDate();var tags=[];
    if(t.area)tags.push('<span class="tag '+(AREA_TAG[t.area]||"")+'">'+esc(t.area)+'</span>');
    if(t.energy)tags.push('<span class="tag '+(t.energy==="High"?"amber":t.energy==="Low"?"green":"cyan")+'">'+esc(t.energy)+' energy</span>');
    if(t.time)tags.push('<span class="tag cyan">'+esc(t.time)+'</span>');
    var right;
    if(t.done)right='done';
    else if(t.due&&t.due<today)right='overdue<br/><span class="c-red">'+esc(prettyDate(t.due))+'</span>';
    else if(t.due===today)right='due<br/><span class="c-amber">today</span>';
    else if(t.due)right='due<br/>'+esc(prettyDate(t.due));
    else right='open';
    return '<div class="ti '+(t.done?"is-done":"")+'">'+
      '<div class="chk '+(t.done?"on":"")+'" data-act="task" data-id="'+esc(t.id)+'">'+(t.done?"✓":"")+'</div>'+
      '<div class="name" style="grid-column:2;"><span class="ptog '+(t.priority?"on":"")+'" data-act="prio" data-id="'+esc(t.id)+'" title="Toggle priority" role="button" aria-label="Toggle priority">★</span> '+esc(t.title)+'</div>'+
      '<div class="right">'+right+'</div>'+
      (tags.length?'<div class="tags">'+tags.join("")+'</div>':"")+'</div>';
  }
  function renderTasks(){
    var html;
    if(!app.tasks.length){html='<div class="empty">No tasks loaded.</div>';}
    else{html=app.tasks.map(taskRowHtml).join("");}
    if($("task-list"))$("task-list").innerHTML=html;
    var done=app.tasks.filter(function(t){return t.done;}).length;
    var prio=app.tasks.filter(function(t){return t.priority&&!t.done;}).length;
    var cc=done+" of "+app.tasks.length+" done · "+prio+" priority";
    if($("task-count"))$("task-count").textContent=cc;
  }
  function renderTaskSections(){
    var host=$("task-sections");if(!host)return;
    var groups=CCData.groupTasksByArea(app.tasks,AREAS);
    host.innerHTML=groups.map(function(g){
      var done=g.tasks.filter(function(t){return t.done;}).length;
      var dot='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--'+(AREA_TAG[g.area]||"cyan")+',#5cc8ff);margin-right:7px;vertical-align:middle;"></span>';
      var rows=g.tasks.length?g.tasks.map(taskRowHtml).join(""):'<div class="empty">No tasks.</div>';
      return '<div class="card" style="padding:0;">'+
        '<div class="panel-head">'+dot+'<span class="panel-title">'+esc(g.area)+'</span><div class="spacer"></div><span class="count-chip">'+done+'/'+g.tasks.length+'</span></div>'+
        '<div class="quickadd"><input class="ipt" data-sec-area="'+esc(g.area)+'" placeholder="+ Add to '+esc(g.area)+'…" /><button class="btn cyan" data-act="task-add-section" data-area="'+esc(g.area)+'">Add</button></div>'+
        '<div>'+rows+'</div>'+
      '</div>';
    }).join("");
  }
  // v1.4.2: instant priority repaint — flip just the clicked star(s), no full grid rebuild
  function syncPrioStar(id,on){
    var nodes=document.querySelectorAll('#task-sections .ptog[data-id="'+id+'"]');
    for(var i=0;i<nodes.length;i++)nodes[i].classList.toggle("on",!!on);
  }
  var WHEN_OPTS=["Morning","Afternoon","Evening","Anytime"];
  function renderRoutineEditor(){
    var host=$("routine-editor");if(!host)return;
    var sorted=app.routines.slice().sort(function(a,b){return a.order-b.order;});
    function whenSel(val,id){return '<select class="ipt" data-act="routine-edit" data-id="'+esc(id)+'" data-field="when" style="flex:0 0 auto;max-width:120px;cursor:pointer;">'+WHEN_OPTS.map(function(o){return '<option'+(o===val?' selected':'')+'>'+o+'</option>';}).join("")+'</select>';}
    var rows=sorted.length?sorted.map(function(r){
      return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line-soft);">'+
        '<input class="ipt" style="flex:2 1 150px;" data-act="routine-edit" data-id="'+esc(r.id)+'" data-field="name" value="'+esc(r.name||"")+'" placeholder="Routine name" />'+
        whenSel(r.when||"Morning",r.id)+
        '<input class="ipt" type="number" min="0" style="flex:0 0 64px;width:64px;" data-act="routine-edit" data-id="'+esc(r.id)+'" data-field="mins" value="'+(+r.mins||0)+'" title="Minutes" />'+
        '<input class="ipt" style="flex:3 1 180px;" data-act="routine-edit" data-id="'+esc(r.id)+'" data-field="why" value="'+esc(r.why||"")+'" placeholder="Why (optional)" />'+
        '<button class="btn" data-act="routine-up" data-id="'+esc(r.id)+'" title="Move up">↑</button>'+
        '<button class="btn" data-act="routine-down" data-id="'+esc(r.id)+'" title="Move down">↓</button>'+
        '<button class="btn" data-act="routine-remove" data-id="'+esc(r.id)+'" title="Remove" style="color:var(--red);border-color:rgba(255,59,92,.4);">✕</button>'+
      '</div>';
    }).join(""):'<div class="empty">No routines yet — add one below.</div>';
    var addForm='<div class="quickadd" style="flex-wrap:wrap;">'+
      '<input class="ipt" id="radd-name" style="flex:2 1 150px;" placeholder="+ New routine name…" />'+
      '<select class="ipt" id="radd-when" style="flex:0 0 auto;max-width:120px;cursor:pointer;">'+WHEN_OPTS.map(function(o){return '<option'+(o==="Morning"?' selected':'')+'>'+o+'</option>';}).join("")+'</select>'+
      '<input class="ipt" id="radd-mins" type="number" min="0" value="5" style="flex:0 0 64px;width:64px;" title="Minutes" />'+
      '<input class="ipt" id="radd-why" style="flex:3 1 180px;" placeholder="Why (optional)…" />'+
      '<button class="btn cyan" data-act="routine-add">Add Routine</button>'+
    '</div>';
    host.innerHTML=rows+addForm;
    if($("routine-count"))$("routine-count").textContent=app.routines.length+" routine"+(app.routines.length===1?"":"s");
  }
  async function editRoutine(id,field,value){
    if(app.mode!=="live")return toast("Connect to edit routines");
    var r=app.routines.filter(function(x){return x.id===id;})[0];if(!r)return;
    if(field==="name")r.name=value;else if(field==="why")r.why=value;
    else if(field==="mins")r.mins=+value||0;else if(field==="when")r.when=value;
    else if(field==="order")r.order=+value||0;
    renderSteps();renderTopStats();
    try{await call(T.update,{page_id:id,command:"update_properties",properties:CCData.routinePropsFor(field,value)});}
    catch(e){toast("Save failed");}
  }
  async function addRoutine(r){
    if(app.mode!=="live")return toast("Connect to edit routines");
    try{
      var res=await call(T.create,{parent:{data_source_id:DBS.routines},pages:[{properties:CCData.newRoutineProps(r)}]});
      var o=toObj(res),id=o&&o.pages&&o.pages[0]&&o.pages[0].id;
      app.routines.push({id:id||("tmp-"+Date.now()),name:r.name,why:r.why||"",mins:+r.mins||0,when:r.when||"Morning",order:+r.order||99,done:false,active:true});
      app.routines.sort(function(a,b){return a.order-b.order;});
      if(id){var rids=(app.state&&app.state.routineIds||[]).concat([id]);await saveState({routineIds:rids});}
      renderRoutineEditor();renderSteps();renderTopStats();toast(id?"Routine added":"Added (local only — reconnect to persist)");
    }catch(e){toast("Add failed");}
  }
  async function removeRoutine(id){
    if(app.mode!=="live")return toast("Connect to edit routines");
    app.routines=app.routines.filter(function(x){return x.id!==id;});
    renderRoutineEditor();renderSteps();renderTopStats();toast("Routine removed");
    try{await call(T.update,{page_id:id,command:"update_properties",properties:{Active:"__NO__"}});
      var rids=(app.state&&app.state.routineIds||[]).filter(function(x){return x!==id;});await saveState({routineIds:rids});
    }catch(e){}
  }
  async function moveRoutine(id,dir){
    if(app.mode!=="live")return toast("Connect to edit routines");
    var writes=CCData.reorderSwap(app.routines,id,dir);if(!writes.length)return;
    writes.forEach(function(w){var r=app.routines.filter(function(x){return x.id===w.id;})[0];if(r)r.order=w.order;});
    app.routines.sort(function(a,b){return a.order-b.order;});
    renderRoutineEditor();renderSteps();
    try{for(var i=0;i<writes.length;i++){await call(T.update,{page_id:writes[i].id,command:"update_properties",properties:{Order:writes[i].order}});}}catch(e){}
  }
  function renderCaps(){
    var l=$("cap-list");if(!l)return;
    if(!app.caps.length){l.innerHTML='<div class="empty" style="padding:6px 0;">Nothing captured yet.</div>';return;}
    var areaOpts=AREAS.map(function(a){return '<option>'+esc(a)+'</option>';}).join("");
    l.innerHTML=app.caps.slice(0,8).map(function(c,i){
      return '<div class="brain-item" data-cap-idx="'+i+'">'+
        '<span class="d">›</span> '+esc(c.item)+
        '<span class="spacer"></span>'+
        '<select class="ipt cap-area" data-cap-idx="'+i+'" style="flex:0 0 auto;max-width:130px;cursor:pointer;">'+areaOpts+'</select>'+
        '<button class="btn cyan cap-promote" data-cap-idx="'+i+'" title="Promote to task">→ Task</button>'+
        '<button class="btn cap-del" data-cap-idx="'+i+'" title="Delete" style="color:var(--red);border-color:rgba(255,59,92,.4);">✕</button>'+
      '</div>';
    }).join("");
  }
  function renderWins(){
    var full=app.wins.length?app.wins.slice(0,16).map(function(w){return '<div class="win-row"><span class="ic">◇</span> '+esc(w.title)+' <span class="date">'+esc(prettyDate(w.date))+'</span></div>';}).join(""):'<div class="empty" style="padding:6px 0;">No wins yet.</div>';
    var few=app.wins.length?app.wins.slice(0,5).map(function(w){return '<div class="win-row"><span class="ic">◇</span> '+esc(w.title)+' <span class="date">'+esc(prettyDate(w.date))+'</span></div>';}).join(""):'<div class="empty" style="padding:6px 0;">No wins logged yet.</div>';
    if($("win-list"))$("win-list").innerHTML=few;if($("win-list2"))$("win-list2").innerHTML=full;
  }
  function renderTopStats(){
    var today=hstDate();
    var done=app.tasks.filter(function(t){return t.done;}).length;var total=app.tasks.length;
    var open=app.tasks.filter(function(t){return !t.done;}).length;
    var dueToday=app.tasks.filter(function(t){return !t.done&&t.due===today;}).length;
    var overdue=app.tasks.filter(function(t){return !t.done&&t.due&&t.due<today;}).length;
    var prio=app.tasks.filter(function(t){return t.priority&&!t.done;}).length;
    var st=steps();var sd=st.filter(function(r){return r.done;}).length;
    var areas={};app.tasks.forEach(function(t){if(t.area&&!t.done)areas[t.area]=1;});var areaNames=Object.keys(areas);
    var streak=+app.state.streak||0;var focus=+app.state.focusMinutesToday||0;
    var wkStr=hstDate(new Date(Date.now()-6*864e5));var winsWk=app.wins.filter(function(w){return w.date&&w.date>=wkStr;}).length;
    $("v-streak").textContent=streak;ring("g-streak",Math.min(streak,30)/30);
    var tp=total?done/total:0;$("v-today").textContent=Math.round(tp*100)+"%";$("s-today").textContent=done+" of "+total+" tasks done";ring("g-today",tp);
    var rp=st.length?sd/st.length:0;$("v-routine").textContent=Math.round(rp*100)+"%";$("s-routine").textContent=sd+" of "+st.length+" steps";ring("g-routine",rp);
    $("v-open").textContent=open;$("s-open").textContent=dueToday+" due today · "+overdue+" overdue";$("v-prio").textContent=prio;
    $("v-wins").textContent=winsWk;$("s-wins").textContent=app.wins.length?("last "+prettyDate(app.wins[0].date)):"—";
    $("v-focus").textContent=focus;$("s-focus").textContent=Math.round(focus/25)+" pomodoros";
    $("v-areas").textContent=areaNames.length;$("s-areas").textContent=areaNames.join(" · ")||"—";
    $("v-cap").textContent=app.caps.length;
    $("last-completed").textContent=app.state.lastCompleted?prettyDate(app.state.lastCompleted):"—";
    var mom=Math.round(tp*40+rp*25+Math.min(streak,10)/10*25+(winsWk?10:0));if(mom>100)mom=100;
    $("v-mom").textContent=mom;ring("g-mom",mom/100);
    var status,col;if(mom>=70){status="ON TRACK";col="c-green";}else if(mom>=40){status="BUILDING";col="c-amber";}else{status="GET STARTED";col="c-red";}
    var ms=$("mom-status");ms.textContent=status;ms.className="hero-status "+col;
    var needTask=app.state.lastCompleted!==today,needWin=app.state.lastWinDate!==today;
    var sn=app.state.lastStreakDate===today?"Streak secured for today":("Streak needs"+(needTask?" 1 task":"")+(needTask&&needWin?" +":"")+(needWin?" 1 win":"")+" today");
    $("mom-note").textContent=sn+" · "+open+" open ("+prio+" priority) · "+focus+" focus min";
  }
  function renderAll(){renderSteps();renderTasks();renderTaskSections();renderRoutineEditor();renderCaps();renderWins();renderTopStats();}

  function tick(){var p=hstParts();$("clock").textContent=p.hour+":"+p.minute+":"+p.second;var s=(23-(+p.hour))*3600+(59-(+p.minute))*60+(59-(+p.second));var h=Math.floor(s/3600),m=Math.floor((s%3600)/60);$("reset-countdown").textContent=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");}

  var timer={total:25*60,left:25*60,running:false,iv:null};
  function fmt(s){var m=Math.floor(s/60),x=s%60;return String(m).padStart(2,"0")+":"+String(x).padStart(2,"0");}
  function paintTimer(){var s=fmt(timer.left),off=1-timer.left/timer.total;if($("timer-display"))$("timer-display").textContent=s;if($("timer-display-focus"))$("timer-display-focus").textContent=s;ring("g-timer",off);ring("g-timer-focus",off);}
  function setTimerState(txt){if($("timer-state"))$("timer-state").textContent=txt;if($("timer-state-focus"))$("timer-state-focus").textContent=txt;}
  function setStartLabel(txt){if($("t-start"))$("t-start").textContent=txt;if($("t-start-focus"))$("t-start-focus").textContent=txt;}
  function startTimer(){if(timer.running){clearInterval(timer.iv);timer.running=false;setStartLabel("Start");setTimerState("Paused");return;}timer.running=true;setStartLabel("Pause");setTimerState("Running · stay on one thing");$("timer-sub").textContent="break at 0:00";timer.iv=setInterval(function(){timer.left--;paintTimer();if(timer.left<=0){clearInterval(timer.iv);timer.running=false;setStartLabel("Start");setTimerState("Done · nice work");$("timer-sub").textContent="logged to Focus Sessions";var mins=Math.round(timer.total/60);logFocus(mins);toast("Focus done · "+mins+"m");timer.left=timer.total;setTimeout(paintTimer,1500);}},1000);}
  function resetTimer(){clearInterval(timer.iv);timer.running=false;timer.left=timer.total;setStartLabel("Start");setTimerState("Ready · "+(timer.total/60)+"-min pomodoro");$("timer-sub").textContent="press Start to begin";paintTimer();}
  function add5(){timer.total+=5*60;timer.left+=5*60;paintTimer();setTimerState("Ready · "+(timer.total/60)+"-min pomodoro");}

  function openBrief(){
    var today=hstDate();var open=app.tasks.filter(function(t){return !t.done;});var prio=open.filter(function(t){return t.priority;});
    var st=steps().filter(function(r){return !r.done;});
    var lines=[];lines.push("Good morning. Here's your "+today+" brief.");lines.push("");
    lines.push("Streak: "+(+app.state.streak||0)+" days. "+(app.state.lastStreakDate===today?"Secured today.":"Complete 1 task + log 1 win to keep it."));
    if(st.length){lines.push("");lines.push("Morning routine left: "+st.map(function(r){return r.name;}).join(", "));}
    lines.push("");lines.push("Tasks: "+open.length+" open, "+prio.length+" priority.");
    if(prio.length){lines.push("");lines.push("Priority first:");prio.slice(0,5).forEach(function(t){lines.push("  ★ "+t.title);});}
    lines.push("");lines.push("Focus logged today: "+(+app.state.focusMinutesToday||0)+" min.");
    if(window.cowork&&typeof window.cowork.askClaude==="function"){toast("Generating brief…");window.cowork.askClaude("Write a short, warm, energizing 4-5 sentence morning brief for an ADHD-friendly command center. Name the single best first task. Data:\n"+lines.join("\n"),[]).then(function(res){try{alert((typeof res==="string"?res:toText(res))||lines.join("\n"));}catch(e){}}).catch(function(){try{alert(lines.join("\n"));}catch(e){}});}
    else{try{alert(lines.join("\n"));}catch(e){}}
  }

  function initAreaPicker(){var sel=$("qa-task-area");if(!sel)return;var last="Focus & Work";try{last=localStorage.getItem("cc_lastArea")||last;}catch(e){}sel.innerHTML=AREAS.map(function(a){return '<option'+(a===last?' selected':'')+'>'+esc(a)+'</option>';}).join("");}
  function showTab(name){
    document.querySelectorAll(".tab").forEach(function(x){x.classList.toggle("active",x.getAttribute("data-tab")===name);});
    ["today","tasks","routine","wins","focus"].forEach(function(n){var el=$("tab-"+n);if(el)el.classList.toggle("hidden",n!==name);});
  }
  function wire(){
    document.querySelectorAll(".tab").forEach(function(tb){tb.addEventListener("click",function(){showTab(tb.getAttribute("data-tab"));});});
    document.body.addEventListener("click",function(e){var el=e.target.closest("[data-act]");if(!el)return;var act=el.getAttribute("data-act"),id=el.getAttribute("data-id");if(act==="task"){var t=app.tasks.filter(function(x){return x.id===id;})[0];if(t)toggleTask(t);}if(act==="routine"){var r=app.routines.filter(function(x){return x.id===id;})[0];if(r)toggleRoutine(r);}if(act==="prio"){var tp=app.tasks.filter(function(x){return x.id===id;})[0];if(tp)togglePriority(tp);}});
    function bindAdd(inp,btn,fn){var i=$(inp);var b=$(btn);if(b)b.addEventListener("click",function(){fn(i.value);i.value="";});if(i)i.addEventListener("keydown",function(e){if(e.key==="Enter"){fn(i.value);i.value="";}});}
    initAreaPicker();
    (function(){var i=$("qa-task"),b=$("qa-task-btn"),sel=$("qa-task-area");function go(){var area=sel?sel.value:"Focus & Work";try{localStorage.setItem("cc_lastArea",area);}catch(e){}addTask(i.value,area);i.value="";}if(b)b.addEventListener("click",go);if(i)i.addEventListener("keydown",function(e){if(e.key==="Enter")go();});})();
    bindAdd("qa-cap","qa-cap-btn",addCapture);bindAdd("qa-win","qa-win-btn",addWin);
    (function(){var host=$("task-sections");if(!host)return;function addFromInput(inp){if(!inp)return;var area=inp.getAttribute("data-sec-area")||"Focus & Work";addTask(inp.value,area);inp.value="";}host.addEventListener("click",function(e){var b=e.target.closest('[data-act="task-add-section"]');if(!b)return;var area=b.getAttribute("data-area");var inp=host.querySelector('input[data-sec-area="'+area+'"]');addFromInput(inp);});host.addEventListener("keydown",function(e){if(e.key!=="Enter")return;var inp=e.target.closest('input[data-sec-area]');if(inp)addFromInput(inp);});})();
    (function(){var host=$("routine-editor");if(!host)return;
      host.addEventListener("change",function(e){var el=e.target.closest('[data-act="routine-edit"]');if(!el)return;editRoutine(el.getAttribute("data-id"),el.getAttribute("data-field"),el.value);});
      host.addEventListener("click",function(e){var el=e.target.closest("[data-act]");if(!el)return;var act=el.getAttribute("data-act"),id=el.getAttribute("data-id");
        if(act==="routine-up")moveRoutine(id,-1);
        else if(act==="routine-down")moveRoutine(id,1);
        else if(act==="routine-remove")removeRoutine(id);
        else if(act==="routine-add"){var nm=(($("radd-name")||{}).value||"").trim();if(!nm)return toast("Name required");var maxO=app.routines.reduce(function(m,r){return Math.max(m,+r.order||0);},0);addRoutine({name:nm,when:($("radd-when")||{}).value||"Morning",mins:+(($("radd-mins")||{}).value||0),why:($("radd-why")||{}).value||"",order:maxO+1});}
      });
    })();
    (function(){var host=$("cap-list");if(!host)return;
      host.addEventListener("click",function(e){
        var p=e.target.closest(".cap-promote");var d=e.target.closest(".cap-del");
        if(p){var i=+p.getAttribute("data-cap-idx");var sel=host.querySelector('.cap-area[data-cap-idx="'+i+'"]');promoteCapture(i,sel?sel.value:"Focus & Work");}
        else if(d){deleteCapture(+d.getAttribute("data-cap-idx"));}
      });
    })();
    $("t-start").addEventListener("click",startTimer);$("t-reset").addEventListener("click",resetTimer);$("t-5").addEventListener("click",add5);
    if($("t-start-focus"))$("t-start-focus").addEventListener("click",startTimer);
    if($("t-reset-focus"))$("t-reset-focus").addEventListener("click",resetTimer);
    if($("t-5-focus"))$("t-5-focus").addEventListener("click",add5);
    // dashboard timer ring/display is the doorway into the Focus room
    (function(){var ringEl=document.querySelector("#tab-today .timer .ring");if(ringEl){ringEl.style.cursor="pointer";ringEl.title="Open Focus";ringEl.addEventListener("click",function(){showTab("focus");});}})();
    // park a stray thought straight into Brain Dump without leaving focus
    (function(){var i=$("focus-park-input"),b=$("focus-park-btn");function go(){if(!i)return;var v=i.value;i.value="";if(v.trim()){addCapture(v);toast("Parked to Brain Dump");}}if(b)b.addEventListener("click",go);if(i)i.addEventListener("keydown",function(e){if(e.key==="Enter")go();});})();
    $("btn-brief").addEventListener("click",openBrief);$("btn-fullbrief").addEventListener("click",openBrief);
    $("btn-sync").addEventListener("click",function(){boot(true);});
    $("badge-ver").addEventListener("click",showDiag);
  }

  // v1.5.0: fire on load when the stored reset date != today. Instant local clear,
  // background Notion writes. Returns true if a reset ran (used for first-run routing in Phase 3).
  function runDailyReset(){
    var today=todayHST();
    var last=app.state&&app.state.lastResetDate;
    if(!CCData.needsDailyReset(last,today)) return false;
    var prior=last||hstDate(new Date(Date.now()-864e5));
    // 1. safety-net report for the prior day (once per day): local guard + Capture-DB append
    if(!hasReport(prior)){
      var rpt=CCData.dailyReportText(prior, app.tasks, app.routines, app.wins);
      saveReport(prior, rpt);
      pushReportToNotion(prior, rpt);
    }
    // 2. capture which routines were checked, for the background Notion clear
    var toClear=app.routines.filter(function(r){return r.done;}).map(function(r){return r.id;});
    // 3. clear local state immediately (in-memory = instant)
    app.routines=CCData.clearedRoutines(app.routines);
    var o=lsGet(); o.pending=CCData.purgeRoutineOps(o.pending); lsSet(o);
    // 4. set the new reset date
    app.state.lastResetDate=today;
    // 5. background: persist new reset date + clear Done Today in Notion (do NOT await)
    if(app.mode==="live"){
      saveState({lastResetDate:today});
      toClear.forEach(function(id){
        call(T.update,{page_id:id,command:"update_properties",properties:{"Done Today":"__NO__"}}).catch(function(){lsPush({t:"routine",id:id,done:false});});
      });
    }
    return true;
  }

  async function boot(isResync){
    $("today-date").textContent=prettyDate(hstDate())+" "+new Date().getFullYear();
    loadSnapshot();
    var _cached=cacheLoad();
    if(_cached){app.state=_cached.state;app.tasks=_cached.tasks;app.routines=_cached.routines;app.wins=_cached.wins;app.caps=_cached.caps||[];applyLocal();}
    renderAll();
    setSync("snap",_cached?("cached data · checking live link…"):("snapshot loaded · checking live link…"));
    var ok=await waitBridge(5000);
    // Live path works two ways: Cowork bridge (ok===true) OR the Netlify notion-proxy (no bridge).
    // call() auto-routes to the proxy when hasBridge() is false; if neither is reachable, liveLoad throws and we demote to snapshot.
    app.mode="live";setSync("live",ok?"connecting Notion…":"connecting Notion (proxy)…");
    try{var fl=await flushPending();await liveLoad();var didReset=runDailyReset();renderAll();if(didReset && typeof showTab==="function") showTab("routine");cacheSave();setSync("live",app.tasks.length+" tasks · "+steps().length+" routine steps · "+app.wins.length+" wins"+(fl?(" · "+fl+" queued"):""));if(isResync)toast("Synced");loadTodoist().catch(function(){});}
    catch(e){
      app.mode="snapshot";renderAll();
      var kind=CCData.classifySyncError(String((e&&e.message)||e)||DIAG.err);
      var pc=(lsGet().pending||[]).length;
      var qmsg=pc?(" · "+pc+" change"+(pc===1?"":"s")+" queued"):"";
      if(kind==="config")setSync("err","Notion not configured — NOT syncing"+qmsg);
      else if(kind==="auth")setSync("err","Notion access failed — NOT syncing"+qmsg);
      else setSync("snap","offline — will sync when reconnected"+qmsg);
    }
  }

  wire();resetTimer();tick();setInterval(tick,1000);boot(false);
})();
