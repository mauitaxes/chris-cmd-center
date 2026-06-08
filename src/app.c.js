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
    return app.todoistTiles;
  }
  try{ window.__ccLoadTodoist=loadTodoistTiles; }catch(e){}
