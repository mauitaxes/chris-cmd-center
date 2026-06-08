  // ---- app.c.js : Todoist (+Calendar) read/write browser logic (Task 3+) ----
  // Concatenated between app.a.js and app.b.js inside the shared IIFE (build order a -> c -> b),
  // so these definitions exist before app.b.js wire()/boot() run. Keeps each build input < 40KB.
  // Todoist MCP server prefix. call() passes the FULL name through: Cowork -> callMcpTool;
  // deployed browser -> todoist-proxy (call() routes by this uuid). suffix() in the proxy strips it.
  var TSERVER="mcp__b9779bcc-3581-4f0e-bef4-401bb840378a__";
  var TT={
    findTasks:TSERVER+"find-tasks",
    findActivity:TSERVER+"find-activity",
    complete:TSERVER+"complete-tasks",
    quickAdd:TSERVER+"add-tasks",
    findProjects:TSERVER+"find-projects"
  };
  var TODOIST_INBOX_URL="https://app.todoist.com/app/inbox";
  // overdue-collapse threshold (G3, default 5; Chris may tune via localStorage)
  function tdOverdueThreshold(){ var n; try{ n=parseInt(localStorage.getItem("cc_overdueThreshold"),10); }catch(e){} return (n>0)?n:5; }
  // reverse map: Todoist projectId -> CC area name, from State.todoistProjects (set in Task 1).
  function areaByProjectId(){
    var m={}, tp=(app.state&&app.state.todoistProjects)||{}, area;
    for(area in tp){ if(tp[area]) m[tp[area]]=area; }
    return m;
  }
  // Non-destructive Todoist read: fetch active CC-tree tasks per area, normalize, compute tiles.
  // Does NOT mutate the Notion-backed app.tasks (no cutover) — fills app.todoistTasks/app.todoistTiles
  // for the new read panels. Exposed as a smoke hook for live verification before any UI placement.
  async function loadTodoistTiles(){
    var map=areaByProjectId(), ids=Object.keys(map), all=[], i, j;
    for(i=0;i<ids.length;i++){
      try{
        var r=await call(TT.findTasks,{projectId:ids[i]});
        var o=(r&&r.tasks)?r:(toObj(r)||{});
        var list=(o&&o.tasks)||[];
        for(j=0;j<list.length;j++) all.push(CCData.normalizeTodoistTask(list[j], map));
      }catch(e){ DIAG.err=String((e&&e.message)||e); }
    }
    app.todoistTasks=all;
    app.todoistTiles=CCData.todoistTileCounts(all);
    app.todoistPanel=CCData.splitTodayPanel(all,{today:hstDate(),threshold:tdOverdueThreshold()});
    return app.todoistTiles;
  }
  try{ window.__ccLoadTodoist=loadTodoistTiles; }catch(e){}

  // ---- 3d: Inbox chip — count of un-triaged Inbox tasks (read-only, deep-links to Todoist) ----
  async function loadTodoistInbox(){
    try{
      var r=await call(TT.findTasks,{projectId:"inbox"});
      var o=(r&&r.tasks)?r:(toObj(r)||{});
      var list=(o&&o.tasks)||[];
      app.todoistInbox=list.filter(function(t){return !t.checked;}).length;
    }catch(e){ app.todoistInbox=null; DIAG.err=String((e&&e.message)||e); }
    return app.todoistInbox;
  }

  // ---- 3b/3d render (read-only; no data-act so the global toggle handler never fires) ----
  function tdRowHtml(t){
    var today=hstDate(), due=String(t.due||"").slice(0,10);
    var right=(due&&due<today)?'<span class="c-red">overdue · '+esc(prettyDate(due))+'</span>'
      :(due===today)?'<span class="c-amber">today</span>'
      :due?esc(prettyDate(due)):'open';
    var star=t.priority?'<span class="ptog on" role="img" aria-label="priority" title="Priority">★</span> ':'';
    var tag=t.area?'<span class="tag '+(AREA_TAG[t.area]||"cyan")+'">'+esc(t.area)+'</span>':'';
    return '<div class="ti">'+
      '<div class="chk" aria-hidden="true" style="visibility:hidden;"></div>'+
      '<div class="name" style="grid-column:2;">'+star+esc(t.title)+'</div>'+
      '<div class="right">'+right+'</div>'+
      (tag?'<div class="tags">'+tag+'</div>':'')+'</div>';
  }
  function renderTodoistToday(){
    var host=$("td-today-list"); if(!host) return;
    var panel=app.todoistPanel;
    if(!panel){ host.innerHTML='<div class="empty">Loading Todoist…</div>'; return; }
    var rows=panel.today.length?panel.today.map(tdRowHtml).join(""):'<div class="empty">Nothing due today.</div>';
    var over="";
    if(panel.overdueCount){
      if(panel.overdueCollapsed){
        over='<div class="ti td-open-inbox" role="button" title="Open Todoist to triage" style="cursor:pointer;opacity:.9;">'+
          '<div class="chk" aria-hidden="true" style="visibility:hidden;"></div>'+
          '<div class="name" style="grid-column:2;"><span class="c-red">'+panel.overdueCount+' overdue</span> — open in Todoist to triage</div>'+
          '<div class="right">›</div></div>';
      }else{
        over='<div class="section-label" style="padding:8px 14px 2px;">Overdue ('+panel.overdueCount+')</div>'+panel.overdue.map(tdRowHtml).join("");
      }
    }
    host.innerHTML=rows+over;
    var cc=$("td-today-count");
    if(cc) cc.textContent=panel.today.length+" today · "+panel.overdueCount+" overdue";
    var oi=host.querySelector(".td-open-inbox");
    if(oi) oi.addEventListener("click",openTodoistInbox);
  }
  function renderInboxChip(){
    var chip=$("td-inbox-chip"); if(!chip) return;
    if(app.todoistInbox==null){ chip.style.display="none"; return; }
    var n=app.todoistInbox;
    chip.style.display="";
    chip.textContent="Inbox "+n;
    chip.title=n+" un-triaged Inbox task"+(n===1?"":"s")+" — open in Todoist";
    chip.onclick=openTodoistInbox;
  }
  function openTodoistInbox(){ try{ window.open(TODOIST_INBOX_URL,"_blank","noopener"); }catch(e){} }

  // ---- combined non-blocking loader, fired from boot()'s live success path (no cutover) ----
  async function loadTodoist(){
    renderTodoistToday();           // paint "Loading…" immediately
    try{ await loadTodoistTiles(); }
    catch(e){ app.todoistPanel={today:[],overdue:[],overdueCount:0,overdueCollapsed:false,threshold:tdOverdueThreshold()}; }
    renderTodoistToday();
    await loadTodoistInbox();
    renderInboxChip();
    return app.todoistTiles;
  }
  try{ window.__ccLoadTodoistPanels=loadTodoist; }catch(e){}
