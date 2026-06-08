  // ---- app.c.js : Todoist (+Calendar) read/write browser logic (Task 3+) ----
  // Concatenated between app.a.js and app.b.js inside the shared IIFE (build order a -> c -> b),
  // so these definitions exist before app.b.js wire()/boot() run. Keeps each build input < 40KB.
  var TODOIST_PROXY_URL="/.netlify/functions/todoist-proxy";
  // Todoist tool-name map (mirrors `T` for Notion). Browser -> todoist-proxy; Cowork -> MCP.
  var TT={
    findTasks:"todoist-find-tasks",
    findActivity:"todoist-find-activity",
    complete:"todoist-complete-tasks",
    quickAdd:"todoist-add-tasks",
    findProjects:"todoist-find-projects"
  };
