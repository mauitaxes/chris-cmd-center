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
    for(var k in updates){
      if(!Object.prototype.hasOwnProperty.call(updates,k)) continue;
      // taskIds ONLY: union (base order kept, new appended, no dupes) so a stale
      // snapshot in `updates` can never drop ids registered by another writer.
      // All other keys (incl. routineIds, which legitimately shrinks) replace.
      if(k==="taskIds"&&Array.isArray(base.taskIds)&&Array.isArray(updates.taskIds)){
        var merged=base.taskIds.slice();
        updates.taskIds.forEach(function(id){ if(merged.indexOf(id)===-1) merged.push(id); });
        base.taskIds=merged;
      } else {
        base[k]=updates[k];
      }
    }
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
      else if(op.t==="taskAdd"){ if(!s.tasks.some(function(z){return z.id===op.tmpid;})) s.tasks.unshift({id:op.tmpid,title:op.title,area:op.area||"Focus & Work",done:false,priority:false,due:"",energy:"",time:""}); }
      else if(op.t==="win"){ s.wins.unshift({title:op.title,date:op.date}); }
      else if(op.t==="cap"){ s.caps.unshift({id:null,item:op.item}); }
      else if(op.t==="focus"){ s.focusMinutesToday=(+s.focusMinutesToday||0)+op.min; }
      else if(op.t==="capDel"){ s.caps=s.caps.filter(function(z){return z.id!==op.id;}); }
      else if(op.t==="state"){ for(var k in op.updates){ if(Object.prototype.hasOwnProperty.call(op.updates,k)) s[k]=op.updates[k]; } }
    });
    return s;
  }
  function assertReadComplete(ids, rows){
    var have={}; (rows||[]).forEach(function(r){ have[r.id]=1; });
    var missing=(ids||[]).filter(function(id){ return !have[id]; });
    return { ok: missing.length===0, missing: missing };
  }

  // -- Group 6: routine editing + task grouping (v1.4.0) --
  // field ∈ {name,why,mins,when,order}; returns the Notion properties patch for one edit
  function routinePropsFor(field, value){
    if(field==="name") return {Routine:String(value)};
    if(field==="why")  return {Why:String(value)};
    if(field==="mins") return {Mins:(+value||0)};
    if(field==="when") return {"Time Of Day":String(value)};
    if(field==="order")return {Order:(+value||0)};
    return {};
  }
  // properties for a brand-new routine page
  function newRoutineProps(r){
    r=r||{};
    return {Routine:String(r.name||""),Active:"__YES__","Done Today":"__NO__",
      "Time Of Day":String(r.when||"Morning"),Mins:(+r.mins||0),Why:String(r.why||""),Order:(+r.order||99)};
  }
  // swap one routine's Order with its neighbor in direction dir ∈ {-1,+1}
  // returns [{id,order},...] writes needed (empty if no move possible). Pure.
  function reorderSwap(routines, id, dir){
    var s=(routines||[]).slice().sort(function(a,b){return a.order-b.order;});
    var i=s.findIndex(function(r){return r.id===id;});
    var j=i+dir; if(i<0||j<0||j>=s.length) return [];
    var a=s[i],b=s[j];
    return [{id:a.id,order:b.order},{id:b.id,order:a.order}];
  }
  // group tasks into the fixed areas, busiest-open first, empty areas last
  function groupTasksByArea(tasks, areas){
    var groups=(areas||[]).map(function(area,i){
      var list=(tasks||[]).filter(function(t){return (t.area||"")===area;});
      var open=list.filter(function(t){return !t.done;}).length;
      return {area:area, tasks:list, open:open, _i:i};
    });
    groups.sort(function(a,b){ return (b.open-a.open) || (b.tasks.length-a.tasks.length) || (a._i-b._i); });
    return groups;
  }

  // v1.5.0: true when the stored reset date is missing or not today (HST string compare)
  function needsDailyReset(lastResetDate, todayStr){
    if(!lastResetDate) return true;
    return String(lastResetDate) !== String(todayStr);
  }

  // v1.5.0: return a copy of routines with every done flag cleared (pure)
  function clearedRoutines(routines){
    return (routines||[]).map(function(r){
      var c={}; for(var k in r){ if(Object.prototype.hasOwnProperty.call(r,k)) c[k]=r[k]; }
      c.done=false; return c;
    });
  }

  // v1.5.0: drop routine ops from a pending-overlay op array (pure)
  function purgeRoutineOps(ops){
    return (ops||[]).filter(function(op){ return op && op.t!=="routine"; });
  }

  // step-2 hardening: classify a sync failure message → "config" | "auth" | "offline" (pure)
  function classifySyncError(msg){
    var s=String(msg||"");
    if(/proxy 500|not configured/i.test(s)) return "config";
    if(/proxy 40[13]|unauthorized|restricted from accessing/i.test(s)) return "auth";
    return "offline";
  }

  // v1.5.0: append id to a list if truthy and not already present (pure)
  function registerId(ids, id){
    var list=(ids||[]).slice();
    if(id && list.indexOf(id)===-1) list.push(id);
    return list;
  }

  // v1.5.0: plain-text end-of-day report from the ending state (pure)
  function dailyReportText(dateStr, tasks, routines, wins){
    tasks=tasks||[]; routines=routines||[]; wins=wins||[];
    var td=tasks.filter(function(t){return t.done;}).length;
    var rd=routines.filter(function(r){return r.done;}).length;
    var dayWins=wins.filter(function(w){return (w.date||"")===dateStr;});
    var lines=[];
    lines.push("Daily report — "+dateStr);
    lines.push("Tasks: "+td+" of "+tasks.length+" done.");
    lines.push("Routine: "+rd+" of "+routines.length+" steps done.");
    if(dayWins.length){ lines.push("Wins: "+dayWins.map(function(w){return w.title;}).join("; ")); }
    else { lines.push("Wins: none logged."); }
    return lines.join("\n");
  }

  // -- Task 0: D9 runtime DB-id resolution --
  // required keys absent or falsy in the databases map (pure)
  function missingDbKeys(dbs, required){
    dbs=dbs||{};
    return (required||[]).filter(function(k){ return !dbs[k]; });
  }
  // merge resolved ids into a databases map without overwriting existing (pure)
  function mergeResolvedDatabases(databases, resolved){
    var out={}, k;
    for(k in (databases||{})){ if(Object.prototype.hasOwnProperty.call(databases,k)) out[k]=databases[k]; }
    for(k in (resolved||{})){ if(Object.prototype.hasOwnProperty.call(resolved,k) && !out[k]) out[k]=resolved[k]; }
    return out;
  }

  // -- Task 1: Todoist structure spec + State-payload builder (pure) --
  function ccTodoistSpec(){
    return {
      parent:"Command Center",
      areas:["Daily Routines","Focus & Work","Health & Sleep","Finances","Home & Space","Relationships","Claude Tasks"],
      labels:["today","energy-low","energy-med","energy-high","5m","15m","30m","1h","2h"]
    };
  }
  // map created area-projects + labels (each {name,id}) to State id dicts (pure)
  function buildTodoistStatePayload(parentId, areaProjects, labels){
    var projects={}, labelMap={};
    (areaProjects||[]).forEach(function(p){ if(p&&p.name) projects[p.name]=p.id; });
    (labels||[]).forEach(function(l){ if(l&&l.name) labelMap[l.name]=l.id; });
    return { todoistParentId:parentId||"", todoistProjects:projects, todoistLabels:labelMap };
  }

  // -- Task 2: pure migration transforms --
  // deterministic 8-char FNV-1a hash of a notion page id (no deps)
  function migrationIdKey(pageId){
    var s=String(pageId||""), h=0x811c9dc5;
    for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
    return ("0000000"+h.toString(16)).slice(-8);
  }
  // map a Notion task object -> Todoist add-tasks payload + [ccid] marker (pure)
  function notionTaskToTodoist(task, opts){
    task=task||{}; opts=opts||{};
    var projectId=(opts.projectByArea&&task.area&&opts.projectByArea[task.area])||opts.parentId||"";
    var labels=[];
    var el=opts.energyLabelMap&&task.energy&&opts.energyLabelMap[task.energy]; if(el) labels.push(el);
    var tl=opts.timeLabelMap&&task.time&&opts.timeLabelMap[task.time]; if(tl) labels.push(tl);
    var marker="[ccid:"+migrationIdKey(task.id)+"]";
    var notes=String(task.notes||"");
    var created=task.created?("[created "+String(task.created).slice(0,10)+"] "):"";
    var description=(created+notes).trim();
    description=(description?description+" ":"")+marker;
    var out={ content:String(task.title||"(task)"), projectId:projectId,
              priority:task.priority?"p1":"p4", labels:labels, description:description };
    if(task.due) out.dueString=String(task.due).slice(0,10);
    return out;
  }
  // map a Notion capture object -> Todoist inbox payload + [ccid] marker (pure)
  function notionCaptureToTodoist(cap){
    cap=cap||{};
    var marker="[ccid:"+migrationIdKey(cap.id)+"]";
    var notes=String(cap.notes||"");
    var description=(notes?notes+" ":"")+marker;
    return { content:String(cap.item||"(note)"), projectId:"inbox", description:description };
  }
  // compare expected vs actual count maps -> per-row + overall reconciliation (pure)
  function reconcileCounts(expected, actual){
    expected=expected||{}; actual=actual||{};
    var keys={}, k; for(k in expected) keys[k]=1; for(k in actual) keys[k]=1;
    var rows=[], allOk=true;
    Object.keys(keys).forEach(function(key){
      var e=+expected[key]||0, a=+actual[key]||0, ok=(e===a);
      if(!ok) allOk=false;
      rows.push({key:key, expected:e, actual:a, ok:ok});
    });
    return { ok:allOk, rows:rows };
  }

  // HST (UTC-10, no DST) local day -> [since,until) UTC window for completed-by-completion queries (pure, D10)
  function hstDayUtcWindow(localDate){
    var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(localDate||""));
    if(!m) return null;
    var sinceMs=Date.UTC(+m[1], +m[2]-1, +m[3], 10, 0, 0, 0); // local midnight HST = 10:00Z
    var untilMs=sinceMs + 24*60*60*1000;
    return { since:new Date(sinceMs).toISOString(), until:new Date(untilMs).toISOString() };
  }
  // filter Todoist activity-log "completed" events to a project-id set within a UTC [since,until) window (pure).
  // Source of truth for the streak/progress "completed today" signal: recurring completions appear HERE
  // (with extraData.isRecurring) but NOT in find-completed-tasks (CP3 spike, 2026-06-08).
  function completedInTreeOnDay(events, treeProjectIds, sinceUtcISO, untilUtcISO){
    var set={}; (treeProjectIds||[]).forEach(function(id){ if(id) set[id]=1; });
    var since=Date.parse(sinceUtcISO), until=Date.parse(untilUtcISO);
    return (events||[]).filter(function(e){
      if(!e || e.eventType!=="completed") return false;
      if(!set[e.parentProjectId]) return false;
      var t=Date.parse(e.eventDate);
      return t>=since && t<until;
    });
  }

  // strip migration markers ([created YYYY-MM-DD] prefix, [ccid:hash] suffix) from a Todoist description (pure)
  function stripCcMarkers(s){
    return String(s||"")
      .replace(/\[created\s+\d{4}-\d{2}-\d{2}\]\s*/g,"")
      .replace(/\s*\[ccid:[0-9a-f]{8}\]/g,"")
      .trim();
  }
  // Todoist (MCP/proxy) task shape -> the dashboard's app.tasks model so existing render reuses (pure)
  function normalizeTodoistTask(raw, areaByProjectId){
    raw=raw||{}; areaByProjectId=areaByProjectId||{};
    return {
      id:String(raw.id||""),
      title:String(raw.content||""),
      area:areaByProjectId[raw.projectId]||"",
      priority:raw.priority==="p1",
      done:!!raw.checked,
      due:raw.dueDate||"",
      labels:Array.isArray(raw.labels)?raw.labels:[],
      recurring:!!raw.recurring,
      notes:stripCcMarkers(raw.description)
    };
  }
  // dashboard tile numbers from normalized tasks: open count, p1 count, per-area, active-area count (pure)
  function todoistTileCounts(tasks){
    tasks=tasks||[];
    var open=0,p1=0,byArea={},areas={};
    tasks.forEach(function(t){
      if(t.done) return;
      open++;
      if(t.priority) p1++;
      var a=t.area||"(none)";
      byArea[a]=(byArea[a]||0)+1; areas[a]=1;
    });
    return { open:open, p1:p1, areasActive:Object.keys(areas).length, byArea:byArea };
  }

  // Today panel split: bucket open tasks into today vs overdue (HST date strings), collapse a long
  // overdue list past threshold. due compared on date-prefix so MCP datetimes ("...T08:00:00") and
  // proxy date-only both work. today = due-today | labelled "today" | priority (future/no-due). (pure, Task 3b)
  function splitTodayPanel(tasks, opts){
    opts=opts||{};
    var todayStr=String(opts.today||"");
    var threshold=(opts.threshold==null)?5:opts.threshold;
    var today=[], overdue=[];
    (tasks||[]).forEach(function(t){
      if(t.done) return;
      var due=String(t.due||"").slice(0,10);
      var labels=Array.isArray(t.labels)?t.labels:[];
      if(due && todayStr && due<todayStr){ overdue.push(t); }
      else if(due===todayStr || labels.indexOf("today")!==-1 || t.priority){ today.push(t); }
    });
    today.sort(function(a,b){
      var ap=a.priority?0:1, bp=b.priority?0:1; if(ap!==bp) return ap-bp;
      var ad=String(a.due||"").slice(0,10)||"9999-99-99", bd=String(b.due||"").slice(0,10)||"9999-99-99";
      if(ad<bd) return -1; if(ad>bd) return 1;
      return String(a.title||"").localeCompare(String(b.title||""));
    });
    overdue.sort(function(a,b){
      var ad=String(a.due||"").slice(0,10), bd=String(b.due||"").slice(0,10);
      return ad<bd?-1:(ad>bd?1:0);
    });
    return { today:today, overdue:overdue, overdueCount:overdue.length,
      overdueCollapsed:overdue.length>threshold, threshold:threshold };
  }


  // Merge normalized calendar events from N calendars into one time-ordered, de-duped list (pure, Task 3c).
  // Input: array of arrays of {start,end,title,allDay,calendarId,htmlLink,id}. De-dupe so an appointment that
  // appears in two calendars shows once (same start+title => same appointment); the first occurrence wins.
  // All-day events (start "YYYY-MM-DD") sort before timed events the same day; unparseable starts sort last.
  function mergeCalendarEvents(eventsArrays){
    var seen={}, out=[];
    (eventsArrays||[]).forEach(function(arr){
      (arr||[]).forEach(function(e){
        if(!e) return;
        var key=String(e.start||"")+"\u0000"+String(e.title||"");
        if(seen[key]) return;
        seen[key]=1; out.push(e);
      });
    });
    out.sort(function(a,b){
      var ta=Date.parse(a.start), tb=Date.parse(b.start), na=isNaN(ta), nb=isNaN(tb);
      if(na&&nb) return String(a.title||"").localeCompare(String(b.title||""));
      if(na) return 1; if(nb) return -1;
      if(ta!==tb) return ta-tb;
      return String(a.title||"").localeCompare(String(b.title||""));
    });
    return out;
  }

  // ---- Task 5: pure write helpers (quick-add resolution, idempotency, MCP arg builders) ----
  // Resolve a CC area name -> its Todoist sub-project id; unknown/global capture -> "inbox".
  function quickAddProjectId(area, todoistProjects){
    todoistProjects=todoistProjects||{};
    var pid=area?todoistProjects[area]:"";
    return pid?String(pid):"inbox";
  }
  // Stable-per-write idempotency key (generated once, reused on retry via the offline queue) so a
  // retried POST de-dupes server-side via the proxy's X-Request-Id. Unique per call.
  function idempotencyKey(prefix){
    prefix=prefix||"cc";
    var rnd=Math.random().toString(36).slice(2,10);
    return String(prefix)+"-"+Date.now().toString(36)+"-"+rnd;
  }
  // Build MCP add-tasks args from a quick-add. Returns null for empty titles. Same shape across the
  // Cowork-MCP and deployed-proxy paths; the proxy lifts requestId into X-Request-Id.
  function buildQuickAddArgs(title, area, todoistProjects, key){
    title=(title||"").trim();
    if(!title) return null;
    return { tasks:[{content:title, projectId:quickAddProjectId(area, todoistProjects)}],
             requestId:key||idempotencyKey("add") };
  }
  // Build MCP complete-tasks args for a single optimistic check-off.
  function buildCompleteArgs(id, key){
    return { ids:[String(id)], requestId:key||idempotencyKey("done") };
  }
  // Optimistic check-off: return a NEW array with the matching id removed (id string-coerced).
  // Non-mutating so the caller can keep the original as a rollback snapshot. Null/empty -> [].
  function optimisticRemove(tasks, id){
    if(!Array.isArray(tasks)) return [];
    var target=String(id);
    return tasks.filter(function(t){ return t && String(t.id)!==target; });
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
    assertReadComplete: assertReadComplete,
    routinePropsFor: routinePropsFor,
    newRoutineProps: newRoutineProps,
    reorderSwap: reorderSwap,
    groupTasksByArea: groupTasksByArea,
    registerId: registerId,
    needsDailyReset: needsDailyReset,
    clearedRoutines: clearedRoutines,
    purgeRoutineOps: purgeRoutineOps,
    dailyReportText: dailyReportText,
    classifySyncError: classifySyncError,
    missingDbKeys: missingDbKeys,
    mergeResolvedDatabases: mergeResolvedDatabases,
    ccTodoistSpec: ccTodoistSpec,
    buildTodoistStatePayload: buildTodoistStatePayload,
    migrationIdKey: migrationIdKey,
    notionTaskToTodoist: notionTaskToTodoist,
    notionCaptureToTodoist: notionCaptureToTodoist,
    reconcileCounts: reconcileCounts,
    hstDayUtcWindow: hstDayUtcWindow,
    completedInTreeOnDay: completedInTreeOnDay,
    stripCcMarkers: stripCcMarkers,
    normalizeTodoistTask: normalizeTodoistTask,
    todoistTileCounts: todoistTileCounts,
    splitTodayPanel: splitTodayPanel,
    mergeCalendarEvents: mergeCalendarEvents,
    quickAddProjectId: quickAddProjectId,
    idempotencyKey: idempotencyKey,
    buildQuickAddArgs: buildQuickAddArgs,
    buildCompleteArgs: buildCompleteArgs,
    optimisticRemove: optimisticRemove
  };
});
/*__CC_DATA_END__*/
