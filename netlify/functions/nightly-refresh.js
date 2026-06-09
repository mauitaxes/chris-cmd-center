// netlify/functions/nightly-refresh.js
// Task 7 — nightly scheduled function. Cron "0 10 * * *" UTC = 00:00 HST (HST = UTC-10, no DST).
// Schedule is declared in netlify.toml. Uses the NEW Netlify function API (export default async (req)).
//
// Thin orchestration over the TESTED cc-data pure helpers + both proxies' fetch-injectable dispatch.
// All decidable logic lives in cc-data.js (unit-tested); this file only sequences the 6 ordered steps,
// batching to protect the 30s scheduled-function budget: ONE Todoist relabel call + ONE State write.
//
// 6 ordered steps (see TASK7-START-HERE.md §2):
//   1. Evaluate + record streak (evaluateStreak; completed-today via find-activity per CP3, NOT find-completed-tasks)
//   2. Save brief/progress to State (State-only)
//   3. Clear all @today + apply retagTomorrow[] in ONE batched update-tasks; then clear retagTomorrow -> []
//   4. Reset morning routine (Done Today -> __NO__)
//   5. Snapshot plannedToday[] (frozen denominator)
//   6. Stamp lastRefreshDate = todayHST
// Steps 1,2,5,6 + the retagTomorrow clear are folded into ONE merged State write at the end.

import { dispatch as notionDispatch } from "./notion-proxy.js";
import { dispatch as todoistDispatch } from "./todoist-proxy.js";
// cc-data.js is CommonJS; esbuild/Node ESM interop gives the exported api object as the default import.
import CC from "../../cc-data.js";

const STATE_PAGE = "37478f3d-415b-814c-8c65-dd76b6ab9aa3";
const ROUTINES_DB = "17f7f036-e24c-40ce-9d41-db5d8a66b618";

// 7 CC area projects (children of Command Center). Used to scope task/activity reads non-recursively.
const CC_PROJECTS = {
  "Daily Routines": "6gqCVgp6xQ44R2V3",
  "Focus & Work": "6gqCVgmmffVVc4HW",
  "Health & Sleep": "6gqCVgmmg96jc96q",
  "Finances": "6gqCVgwCWhQvhrvQ",
  "Home & Space": "6gqCVgmcWrQfFr2H",
  "Relationships": "6gqCVgmFXX6gJhjJ",
  "Claude Tasks": "6gqCVgmP6rq8wv7G",
};

// HST (UTC-10) calendar date for an instant. Pure-ish (Date only).
function hstDate(now) {
  return new Date((now || Date.now()) - 10 * 3600 * 1000).toISOString().slice(0, 10);
}

function extractStateJson(markdown) {
  const m = String(markdown || "").match(/```json\s*([\s\S]*?)```/);
  return m ? m[1].trim() : "";
}

// Orchestrator, fetch- and dispatch-injectable for unit tests. Returns a plain report object.
export async function runNightly(opts) {
  opts = opts || {};
  const nd = opts.notionDispatch || ((a) => notionDispatch(a));
  const td = opts.todoistDispatch || ((a) => todoistDispatch(a));
  const now = opts.now || Date.now();
  const today = hstDate(now);

  // --- read State ---
  const stateRes = await nd({ name: "notion-fetch", args: { id: STATE_PAGE } });
  const stateMd = CC.deepText(stateRes);
  const curJson = extractStateJson(stateMd) || JSON.stringify({});
  let state = {};
  try { state = JSON.parse(curJson) || {}; } catch (_) { state = {}; }

  // CC project id map (prefer State.todoistProjects area->id, else the hardcoded tree).
  const projMap = (state.todoistProjects && Object.keys(state.todoistProjects).length) ? state.todoistProjects : CC_PROJECTS;
  const ccIds = Object.keys(projMap).map((a) => String(projMap[a])).filter(Boolean);
  const areaByProjectId = {};
  Object.keys(projMap).forEach((a) => { areaByProjectId[String(projMap[a])] = a; });

  // --- read routines (search -> fetch each -> normalize -> active only) for routine % ---
  let routines = [];
  try {
    const rdb = (state.databases && state.databases.routines) || ROUTINES_DB;
    const sr = await nd({ name: "notion-search", args: { data_source_url: "collection://" + rdb, page_size: 50 } });
    const so = JSON.parse(CC.deepText(sr) || "{}");
    const rids = ((so && so.results) || []).map((x) => x.id).filter(Boolean);
    for (const id of rids) {
      const pr = await nd({ name: "notion-fetch", args: { id } });
      const p = CC.parseProps(pr);
      if (!p) continue;
      const nr = CC.normalizeRoutine(id, p);
      if (nr.active) routines.push(nr);
    }
  } catch (_) { routines = []; }
  const rp = CC.routinePct(routines);

  // --- read all OPEN CC tasks across the 7 projects (one call each) ---
  const allTasks = [];
  for (const pid of ccIds) {
    try {
      const tr = await td({ name: "find-tasks", args: { projectId: pid } });
      const to = (tr && tr.tasks) ? tr : JSON.parse(CC.deepText(tr) || "{}");
      ((to && to.tasks) || []).forEach((raw) => allTasks.push(CC.normalizeTodoistTask(raw, areaByProjectId)));
    } catch (_) { /* skip project on error */ }
  }
  const byId = {};
  allTasks.forEach((t) => { byId[String(t.id)] = t; });
  const todayTasks = allTasks.filter((t) => Array.isArray(t.labels) && t.labels.indexOf("today") !== -1);
  const retagIds = Array.isArray(state.retagTomorrow) ? state.retagTomorrow.map(String) : [];
  const retagTasks = retagIds.map((id) => byId[id]).filter(Boolean);

  // --- completed-today numerator (find-activity, workspace-wide, filtered to CC tree + HST window) ---
  let completedToday = 0;
  try {
    const win = CC.hstDayUtcWindow(today);
    const ar = await td({ name: "find-activity", args: { objectType: "item", eventType: "completed", limit: 200 } });
    const ao = (ar && ar.events) ? ar : JSON.parse(CC.deepText(ar) || "{}");
    const events = (ao && ao.events) || [];
    completedToday = win ? CC.completedInTreeOnDay(events, ccIds, win.since, win.until).length : 0;
  } catch (_) { completedToday = 0; }

  // === Step 1: streak ===
  const hasWinToday = String(state.lastWinDate || "") === today;
  const streakRes = CC.evaluateStreak({
    hasWinToday: hasWinToday, completedToday: completedToday,
    routinePct: rp.pct, routineSteps: rp.total,
    streak: state.streak, lastStreakDate: state.lastStreakDate,
    today: today, streakGraceUntil: state.streakGraceUntil,
  });

  // === Step 3: ONE batched Todoist relabel (clear @today, add today to retag set) ===
  const relabel = CC.buildNightlyTodoistArgs(todayTasks, retagTasks, "nightly-" + today);
  let relabeled = 0;
  if (relabel.tasks.length) {
    try {
      await td({ name: "update-tasks", args: relabel });
      relabeled = relabel.tasks.length;
      // reflect the relabel in our in-memory model so the plannedToday snapshot is post-relabel
      relabel.tasks.forEach((u) => { if (byId[String(u.id)]) byId[String(u.id)].labels = u.labels.slice(); });
    } catch (_) { relabeled = -1; }
  }

  // === Step 4: reset morning routine (Done Today -> __NO__ for those currently done) ===
  let routinesReset = 0;
  for (const r of routines) {
    if (!r.done) continue;
    try {
      await nd({ name: "notion-update-page", args: { page_id: r.id, command: "update_properties", properties: { "Done Today": "__NO__" } } });
      routinesReset++;
    } catch (_) { /* best-effort */ }
  }

  // === Step 5: snapshot plannedToday[] (frozen denominator), computed on post-relabel tasks ===
  const postTasks = Object.keys(byId).map((k) => byId[k]);
  const plannedToday = CC.splitTodayPanel(postTasks, { today: today }).today.map((t) => String(t.id));

  // progress summary for State (lean; no Daily Log page in v1)
  const progress = {
    date: today, completedToday: completedToday,
    plannedCount: plannedToday.length,
    routineDone: rp.done, routineTotal: rp.total,
    streakSecured: streakRes.secured, warnZeroRoutine: streakRes.warnZeroRoutine,
  };

  // === Steps 1,2,5,6 + retag clear -> ONE merged State write ===
  const updates = CC.buildNightlyStateUpdates({
    streak: streakRes.streak, lastStreakDate: streakRes.lastStreakDate,
    plannedToday: plannedToday, lastRefreshDate: today, progress: progress,
  });
  const newJson = CC.mergeState(curJson, updates);
  const newMd = "```json\n" + newJson + "\n```";
  await nd({ name: "notion-update-page", args: { page_id: STATE_PAGE, command: "update_content", content_updates: [{ old_str: stateMd, new_str: newMd }] } });

  return {
    ok: true, today: today,
    streak: streakRes.streak, streakSecured: streakRes.secured, warnZeroRoutine: streakRes.warnZeroRoutine,
    hasWinToday: hasWinToday, completedToday: completedToday,
    routine: { done: rp.done, total: rp.total, pct: rp.pct },
    todayCleared: todayTasks.length, retagApplied: retagTasks.length, relabeled: relabeled,
    routinesReset: routinesReset, plannedToday: plannedToday.length,
  };
}

// Netlify scheduled-function entrypoint (new API). Receives { next_run }; no input payload.
export default async (req) => {
  try {
    const report = await runNightly({});
    return new Response(JSON.stringify(report), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
