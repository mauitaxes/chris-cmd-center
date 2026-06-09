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
    findProjects:TSERVER+"find-projects",
    update:TSERVER+"update-tasks"
  };
  var TODOIST_INBOX_URL="https://app.todoist.com/app/inbox";
  // ---- 3c: Google Calendar (read-only Schedule lane). MCP-only path for now (Cowork populates;
  // deployed site shows an empty state until a calendar-proxy is built — scope decided with Chris). ----
  var CALSERVER="mcp__a8aed00c-e9c0-4e6d-8e3a-64452207f54f__";
  var CAL={ listCalendars:CALSERVER+"list_calendars", listEvents:CALSERVER+"list_events" };
  var CAL_DEFAULT_ALLOW=["mauitaxes@gmail.com"]; // primary only; Holidays calendar declined.
  // allow-list lives in State (persisted once on first calendar load); falls back to the default.
  function calendarAllowList(){
    var a=app.state&&app.state.calendarAllowList;
    return (Array.isArray(a)&&a.length)?a:CAL_DEFAULT_ALLOW;
  }
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

  // ---- Task 10: completed-today (display-only). Activity log is the source of truth — recurring
  // completions appear here but NOT in find-completed-tasks (CP3 spike). Counts CC-tree projects only. ----
  async function loadTodoistCompletedToday(){
    var map=areaByProjectId(), ids=Object.keys(map), all=[], i, j;
    var w=CCData.hstDayUtcWindow(hstDate())||{};
    for(i=0;i<ids.length;i++){
      try{
        var r=await call(TT.findActivity,{projectId:ids[i],objectType:"item",eventType:"completed",limit:100});
        var o=(r&&r.events)?r:(toObj(r)||{});
        var evs=(o&&o.events)||[];
        for(j=0;j<evs.length;j++) all.push(evs[j]);
      }catch(e){ DIAG.err=String((e&&e.message)||e); }
    }
    app.todoistCompletedToday=CCData.completedInTreeOnDay(all, ids, w.since, w.until).length;
    return app.todoistCompletedToday;
  }
  try{ window.__ccLoadCompleted=loadTodoistCompletedToday; }catch(e){}

  // ---- 3b/3d render (read-only; no data-act so the global toggle handler never fires) ----
  function tdRowHtml(t){
    var today=hstDate(), due=String(t.due||"").slice(0,10);
    var right=(due&&due<today)?'<span class="c-red">overdue · '+esc(prettyDate(due))+'</span>'
      :(due===today)?'<span class="c-amber">today</span>'
      :due?esc(prettyDate(due)):'open';
    var star='<span class="ptog '+(t.priority?"on":"")+'" data-act="td-prio" data-id="'+esc(t.id)+'" role="button" title="Toggle priority" aria-label="Toggle priority">★</span>';
    var tag=t.area?'<span class="tag '+(AREA_TAG[t.area]||"cyan")+'">'+esc(t.area)+'</span>':'';
    var rec=t.recurring?'<span class="tag green" title="Recurring — defer opens Todoist">↻</span>':'';
    var deferSel='<select class="ipt td-defer-sel" data-act="td-defer" data-id="'+esc(t.id)+'" title="Defer this task" style="flex:0 0 auto;max-width:104px;cursor:pointer;font-size:11px;padding:2px 4px;">'+
      '<option value="">Defer…</option><option value="not-today">Not today</option><option value="tomorrow">Tomorrow</option><option value="specific">Pick date ›</option></select>';
    return '<div class="ti">'+
      '<div class="chk" data-act="td-check" data-id="'+esc(t.id)+'" role="button" title="Complete" aria-label="Complete" style="cursor:pointer;"></div>'+
      '<div class="name" style="grid-column:2;">'+star+' '+esc(t.title)+'</div>'+
      '<div class="right">'+right+'</div>'+
      '<div class="tags">'+tag+rec+deferSel+'</div>'+'</div>';
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
    if(cc) cc.textContent=panel.today.length+" today · "+panel.overdueCount+" overdue"+(app.todoistCompletedToday!=null?(" · "+app.todoistCompletedToday+" done today"):"");
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

  // ---- Task 5 WRITES: optimistic check-off (+rollback) and quick-add. Smoke-hookable
  // (window.__ccCheckOff / __ccQuickAdd) so writes are live-verifiable BEFORE the read-only
  // panel is flipped interactive (UI placement / cutover is a separate, deliberate step). ----
  function tdRepaintFrom(list){
    app.todoistTasks=list;
    app.todoistTiles=CCData.todoistTileCounts(list);
    app.todoistPanel=CCData.splitTodayPanel(list,{today:hstDate(),threshold:tdOverdueThreshold()});
    renderTodoistToday();
    if(typeof renderTodoistSections==="function") renderTodoistSections();
  }
  // Optimistic complete: drop the row immediately, POST close, restore the snapshot on failure.
  // One idempotency key per attempt (reused on retry by the offline queue in Task 9).
  async function tdCheckOff(id){
    if(!id) return {ok:false, error:"no id"};
    var snapshot=app.todoistTasks||[];                 // optimisticRemove is non-mutating -> safe rollback
    var key=CCData.idempotencyKey("done");
    tdRepaintFrom(CCData.optimisticRemove(snapshot, id));
    try{
      await call(TT.complete, CCData.buildCompleteArgs(id, key));
      return {ok:true, id:String(id), key:key};
    }catch(e){
      // Task 9: durably queue the check-off (SAME key -> X-Request-Id dedupe on flush) instead of
      // losing it. Keep the optimistic removal: the row stays gone, the op flushes on reconnect.
      DIAG.err=String((e&&e.message)||e);
      var qd=CCData.queueTodoistDone({id:id, key:key});
      if(qd){ lsPush(qd); noteQueued(); }
      else { tdRepaintFrom(snapshot); }                 // no id to queue -> roll back as before
      return {ok:false, id:String(id), key:key, queued:!!qd, error:DIAG.err};
    }
  }
  // Quick-add: area -> its sub-project, global -> Inbox (routing in CCData.buildQuickAddArgs).
  // Authoritative refresh on success (no tmp-id juggling); empty title -> no-op.
  async function tdQuickAdd(title, area){
    var tp=(app.state&&app.state.todoistProjects)||{};
    var key=CCData.idempotencyKey("add");
    var args=CCData.buildQuickAddArgs(title, area, tp, key);
    if(!args) return {ok:false, error:"empty title"};
    try{
      var r=await call(TT.quickAdd, args);
      try{ await loadTodoistTiles(); renderTodoistToday(); renderTodoistSections(); }catch(e2){}
      var o=(r&&r.tasks)?r:(toObj(r)||{});
      var created=(o&&o.tasks&&o.tasks[0])||null;
      return {ok:true, projectId:args.tasks[0].projectId, id:created&&created.id, key:key};
    }catch(e){
      // Task 9: durably queue the capture (SAME key -> X-Request-Id dedupe on flush). Global/unknown
      // area routes to Inbox via buildQuickAddArgs at flush time. Empty title can't reach here.
      DIAG.err=String((e&&e.message)||e);
      var qa=CCData.queueTodoistAdd({title:title, area:area, key:key});
      if(qa){ lsPush(qa); noteQueued(); }
      return {ok:false, key:key, queued:!!qa, error:DIAG.err};
    }
  }
  // ---- Task 6 WRITE: 3-way defer. Same optimistic+rollback shape as tdCheckOff. Recurring/specific-date
  // deep-link (NEVER mutate recurrence via API); not-today/tomorrow-dated/tomorrow-undated go through
  // update-tasks (drop "today", optionally snooze due+1 HST). Undated also queues retagTomorrow[] (Task 7
  // re-applies @today tomorrow). Smoke-hookable (__ccDefer); panel stays read-only until cutover. ----
  var TODOIST_TASK_URL="https://app.todoist.com/app/task/";
  async function tdDefer(id, choice){
    if(!id) return {ok:false, error:"no id"};
    var snapshot=app.todoistTasks||[];                 // non-mutating helpers -> safe rollback snapshot
    var task=null, i;
    for(i=0;i<snapshot.length;i++){ if(snapshot[i] && String(snapshot[i].id)===String(id)){ task=snapshot[i]; break; } }
    if(!task) return {ok:false, id:String(id), error:"task not found"};
    var cls=CCData.classifyDefer(task, choice);
    if(cls==="deep-link"){                              // recurring or user-picked specific date: no API mutation
      try{ window.open(TODOIST_TASK_URL+encodeURIComponent(id),"_blank","noopener"); }catch(e){}
      return {ok:true, id:String(id), classification:cls, deepLink:true};
    }
    var key=CCData.idempotencyKey("defer");
    var args=CCData.buildDeferArgs(task, choice, hstDate(), key);
    tdRepaintFrom(CCData.optimisticRemove(snapshot, id));   // deferring removes it from the Today panel
    try{
      await call(TT.update, args);
      if(cls==="tomorrow-undated"){                    // queue id so the nightly job re-tags @today tomorrow
        try{ await saveState({retagTomorrow: CCData.registerId(app.state&&app.state.retagTomorrow, String(id))}); }catch(e2){}
      }
      return {ok:true, id:String(id), classification:cls, key:key};
    }catch(e){
      tdRepaintFrom(snapshot);                          // rollback
      DIAG.err=String((e&&e.message)||e);
      return {ok:false, id:String(id), classification:cls, key:key, error:DIAG.err};
    }
  }
  try{ window.__ccCheckOff=tdCheckOff; window.__ccQuickAdd=tdQuickAdd; window.__ccDefer=tdDefer; }catch(e){}

  // ---- 3c calendar: normalize MCP event -> small shape; all-day uses start.date, timed uses start.dateTime ----
  function normalizeCalEvent(raw, calendarId){
    raw=raw||{}; var st=raw.start||{}, en=raw.end||{};
    return {
      id:String(raw.id||""),
      start:String(st.dateTime||st.date||""),
      end:String(en.dateTime||en.date||""),
      title:String(raw.summary||"(busy)"),
      allDay:!!(st.date && !st.dateTime),
      calendarId:calendarId||"",
      htmlLink:String(raw.htmlLink||"")
    };
  }
  // Fetch today's events (HST window) for each allowed calendar, normalize, merge. Read-only; never
  // touches app.tasks. Populates app.calendarEvents for the Schedule lane.
  async function loadCalendar(){
    var allow=calendarAllowList();
    // persist the allow-list once so it survives reloads (do not re-prompt).
    try{ if(app.state && !Array.isArray(app.state.calendarAllowList)){ await saveState({calendarAllowList:allow}); } }catch(e){}
    var w=CCData.hstDayUtcWindow(hstDate())||{}; var arrays=[], i, j;
    for(i=0;i<allow.length;i++){
      try{
        var r=await call(CAL.listEvents,{calendarId:allow[i],startTime:w.since,endTime:w.until,orderBy:"startTime",pageSize:50});
        var o=(r&&r.events)?r:(toObj(r)||{});
        var list=(o&&o.events)||[];
        var norm=[];
        for(j=0;j<list.length;j++){
          if(list[j] && list[j].status==="cancelled") continue;
          norm.push(normalizeCalEvent(list[j], allow[i]));
        }
        arrays.push(norm);
      }catch(e){ DIAG.err=String((e&&e.message)||e); }
    }
    app.calendarEvents=CCData.mergeCalendarEvents(arrays);
    return app.calendarEvents;
  }
  try{ window.__ccLoadCalendar=loadCalendar; }catch(e){}

  // ---- 3c render (read-only; appointments are NOT deferrable: time + open-in-calendar link only) ----
  function calTimeLabel(ev){
    if(ev.allDay) return "all day";
    var d=new Date(String(ev.start||""));
    if(!isNaN(d.getTime())){
      try{ return new Intl.DateTimeFormat("en-US",{timeZone:"Pacific/Honolulu",hour:"numeric",minute:"2-digit"}).format(d); }catch(e){}
    }
    var m=/T(\d{2}):(\d{2})/.exec(String(ev.start||"")); return m?(m[1]+":"+m[2]):"";
  }
  function calRowHtml(ev){
    var link=ev.htmlLink
      ? '<a class="right" href="'+esc(ev.htmlLink)+'" target="_blank" rel="noopener" title="Open in Google Calendar">open \u203A</a>'
      : '<div class="right"></div>';
    return '<div class="ti">'+
      '<div class="chk" aria-hidden="true" style="visibility:hidden;"></div>'+
      '<div class="name" style="grid-column:2;"><span class="c-amber">'+esc(calTimeLabel(ev))+'</span> &nbsp;'+esc(ev.title)+'</div>'+
      link+'</div>';
  }
  function renderScheduleToday(){
    var host=$("td-sched-list"); if(!host) return;
    var evs=app.calendarEvents;
    if(evs==null){ host.innerHTML='<div class="empty">Loading schedule\u2026</div>'; return; }
    host.innerHTML=evs.length?evs.map(calRowHtml).join(""):'<div class="empty">No appointments today.</div>';
    var cc=$("td-sched-count");
    if(cc) cc.textContent=evs.length+(evs.length===1?" appt":" appts");
  }

  // ---- combined non-blocking loader, fired from boot()'s live success path (no cutover) ----
  async function loadTodoistAndCalendar(){
    renderTodoistToday();           // paint "Loading\u2026" immediately
    renderTodoistSections();
    renderScheduleToday();
    try{ await loadTodoistTiles(); }
    catch(e){ app.todoistPanel={today:[],overdue:[],overdueCount:0,overdueCollapsed:false,threshold:tdOverdueThreshold()}; }
    renderTodoistToday();
    renderTodoistSections();
    await loadTodoistInbox();
    renderInboxChip();
    try{ await loadTodoistCompletedToday(); }catch(e){}
    renderTodoistToday();                 // repaint count line with "N done today"
    try{ await loadCalendar(); }
    catch(e){ app.calendarEvents=[]; }
    renderScheduleToday();
    try{ if(typeof cacheSave==="function") cacheSave(); }catch(e){}   // Task 10: cache read-only panels for instant reloads
    return app.todoistTiles;
  }
  // ---- Phase 2 cutover: INTERACTIVE Todoist area sections (replaces the Notion #task-sections grid).
  // Renders app.todoistTasks grouped by the 7 CC areas with live complete / priority / defer / quick-add,
  // all routed to the already-tested write fns (tdCheckOff / tdSetPriority / tdDefer / tdQuickAdd). ----
  function tdSectionRowHtml(t){
    var today=hstDate(), due=String(t.due||"").slice(0,10);
    var right=(due&&due<today)?'<span class="c-red">overdue · '+esc(prettyDate(due))+'</span>'
      :(due===today)?'<span class="c-amber">today</span>'
      :due?esc(prettyDate(due)):'open';
    var star='<span class="ptog '+(t.priority?"on":"")+'" data-act="td-prio" data-id="'+esc(t.id)+'" role="button" title="Toggle priority" aria-label="Toggle priority">★</span>';
    var labelTags=(Array.isArray(t.labels)?t.labels:[]).filter(function(l){return l!=="today";}).slice(0,3)
      .map(function(l){return '<span class="tag cyan">'+esc(l)+'</span>';}).join("");
    var rec=t.recurring?'<span class="tag green" title="Recurring — defer opens Todoist">↻</span>':'';
    var deferSel='<select class="ipt td-defer-sel" data-act="td-defer" data-id="'+esc(t.id)+'" title="Defer this task" style="flex:0 0 auto;max-width:108px;cursor:pointer;font-size:11px;padding:2px 4px;">'+
      '<option value="">Defer…</option>'+
      '<option value="not-today">Not today</option>'+
      '<option value="tomorrow">Tomorrow</option>'+
      '<option value="specific">Pick date ›</option>'+
    '</select>';
    return '<div class="ti">'+
      '<div class="chk" data-act="td-check" data-id="'+esc(t.id)+'" role="button" title="Complete" aria-label="Complete" style="cursor:pointer;"></div>'+
      '<div class="name" style="grid-column:2;">'+star+' '+esc(t.title)+'</div>'+
      '<div class="right">'+right+'</div>'+
      '<div class="tags">'+labelTags+rec+deferSel+'</div>'+
    '</div>';
  }
  function renderTodoistSections(){
    var host=$("task-sections"); if(!host) return;
    var loaded=(app.todoistTiles!=null)||(Array.isArray(app.todoistTasks)&&app.todoistTasks.length>0);
    if(!loaded){ host.innerHTML='<div class="empty">Connecting to Todoist…</div>'; return; }
    var open=(app.todoistTasks||[]).filter(function(t){return !t.done;});
    var groups=CCData.groupTasksByArea(open, AREAS);
    host.innerHTML=groups.map(function(g){
      var dot='<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--'+(AREA_TAG[g.area]||"cyan")+',#5cc8ff);margin-right:7px;vertical-align:middle;"></span>';
      var rows=g.tasks.length?g.tasks.map(tdSectionRowHtml).join(""):'<div class="empty">No open tasks.</div>';
      return '<div class="card" style="padding:0;">'+
        '<div class="panel-head">'+dot+'<span class="panel-title">'+esc(g.area)+'</span><div class="spacer"></div><span class="count-chip">'+g.tasks.length+'</span></div>'+
        '<div class="quickadd"><input class="ipt" data-td-sec-area="'+esc(g.area)+'" placeholder="+ Add to '+esc(g.area)+'…" /><button class="btn cyan" data-act="td-add-section" data-area="'+esc(g.area)+'">Add</button></div>'+
        '<div>'+rows+'</div>'+
      '</div>';
    }).join("");
  }
  // toggle priority: optimistic in-place flip + recompute tiles/panel, revert on failure.
  async function tdSetPriority(id){
    var list=app.todoistTasks||[], t=null, i;
    for(i=0;i<list.length;i++){ if(list[i] && String(list[i].id)===String(id)){ t=list[i]; break; } }
    if(!t) return {ok:false, error:"task not found"};
    var newOn=!t.priority, key=CCData.idempotencyKey("prio");
    t.priority=newOn;                                  // optimistic
    tdRepaintFrom(list);                               // recompute tiles/panel + repaint today+sections
    try{ await call(TT.update, CCData.buildPriorityArgs(id, newOn, key)); return {ok:true, id:String(id), priority:newOn?"p1":"p4", key:key}; }
    catch(e){ t.priority=!newOn; tdRepaintFrom(list); DIAG.err=String((e&&e.message)||e); return {ok:false, id:String(id), error:DIAG.err}; }
  }
  function tdSectionAdd(title, area){ title=(title||"").trim(); if(!title) return; tdQuickAdd(title, area); }
  // bind interactive handlers on #task-sections once (guarded). Distinct td-* acts so the legacy
  // Notion handlers (data-act="task"/"prio"/"task-add-section") never collide.
  // Bind interactive handlers on BOTH Todoist task surfaces: the area grid (#task-sections, Tasks tab)
  // and the Today panel (#td-today-list, Today tab). Per-host guard so re-renders never double-bind.
  function _wireTdHost(host){
    if(!host || host._tdWired) return; host._tdWired=true;
    host.addEventListener("click", function(e){
      var el=e.target.closest("[data-act]"); if(!el) return;
      var act=el.getAttribute("data-act"), id=el.getAttribute("data-id");
      if(act==="td-check"){ tdCheckOff(id); }
      else if(act==="td-prio"){ tdSetPriority(id); }
      else if(act==="td-add-section"){
        var area=el.getAttribute("data-area");
        var inp=host.querySelector('input[data-td-sec-area="'+area+'"]');
        if(inp){ var v=inp.value; inp.value=""; tdSectionAdd(v, area); }
      }
    });
    host.addEventListener("change", function(e){
      var sel=e.target.closest('[data-act="td-defer"]'); if(!sel) return;
      var id=sel.getAttribute("data-id"), choice=sel.value; sel.value="";
      if(choice) tdDefer(id, choice);
    });
    host.addEventListener("keydown", function(e){
      if(e.key!=="Enter") return;
      var inp=e.target.closest('input[data-td-sec-area]'); if(!inp) return;
      var area=inp.getAttribute("data-td-sec-area"), v=inp.value; inp.value=""; tdSectionAdd(v, area);
    });
  }
  function wireTodoistSections(){ _wireTdHost($("task-sections")); _wireTdHost($("td-today-list")); }
  try{ window.__ccRenderTodoistSections=renderTodoistSections; window.__ccWireTodoistSections=wireTodoistSections; }catch(e){}

  try{ window.__ccLoadTodoistPanels=loadTodoistAndCalendar; }catch(e){}
