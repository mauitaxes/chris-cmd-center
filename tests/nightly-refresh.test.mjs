import { test } from "node:test";
import assert from "node:assert/strict";

const { runNightly } = await import("../netlify/functions/nightly-refresh.js");

const FOCUS = "6gqCVgmmffVVc4HW";   // Focus & Work
const FIN = "6gqCVgwCWhQvhrvQ";     // Finances
const STATE_PAGE = "37478f3d-415b-814c-8c65-dd76b6ab9aa3";

// now such that hstDate(now) === "2026-06-08"
const NOW = Date.parse("2026-06-08T20:00:00Z");

function makeState(over) {
  return Object.assign({
    streak: 12, lastStreakDate: "2026-06-07", lastWinDate: "2026-06-08",
    retagTomorrow: ["R1"], taskIds: [], routineIds: [],
  }, over || {});
}

// minimal notion proxy emulation
function notionMock(state, routines, sink) {
  return async ({ name, args }) => {
    const op = name;
    if (op === "notion-fetch" && args.id === STATE_PAGE) {
      return { content: [{ type: "text", text: "```json\n" + JSON.stringify(state) + "\n```" }] };
    }
    if (op === "notion-search") {
      return { results: routines.map((r) => ({ id: r.id, title: r.name })) };
    }
    if (op === "notion-fetch") {
      const r = routines.find((x) => x.id === args.id) || {};
      const props = { Routine: r.name || "", Active: "__YES__", "Done Today": r.done ? "__YES__" : "__NO__", Order: r.order || 1 };
      return { content: [{ type: "text", text: "<properties>" + JSON.stringify(props) + "</properties>" }] };
    }
    if (op === "notion-update-page") { sink.notionWrites.push(args); return { ok: true }; }
    throw new Error("unexpected notion op " + op);
  };
}

function todoistMock(tasksByProject, events, sink) {
  return async ({ name, args }) => {
    if (name === "find-tasks") { return { tasks: (tasksByProject[args.projectId] || []) }; }
    if (name === "find-activity") { return { events }; }
    if (name === "update-tasks") { sink.todoistWrites.push(args); return { tasks: [], totalCount: 0 }; }
    throw new Error("unexpected todoist op " + name);
  };
}

test("runNightly: happy path — streak increments, batched relabel, single merged State write", async () => {
  const sink = { notionWrites: [], todoistWrites: [] };
  const state = makeState();
  const routines = [{ id: "rt1", name: "Water", done: true, order: 1 }, { id: "rt2", name: "Light", done: true, order: 2 }];
  const tasksByProject = {
    [FOCUS]: [{ id: "t1", content: "Do thing", projectId: FOCUS, priority: "p4", labels: ["today", "15m"], checked: false }],
    [FIN]: [{ id: "R1", content: "Retag me", projectId: FIN, priority: "p4", labels: ["energy-low"], checked: false }],
  };
  const events = [{ eventType: "completed", parentProjectId: FOCUS, eventDate: "2026-06-08T18:00:00.000Z" }];

  const report = await runNightly({
    now: NOW,
    notionDispatch: notionMock(state, routines, sink),
    todoistDispatch: todoistMock(tasksByProject, events, sink),
  });

  // streak: all 3 conditions met -> 12 -> 13, secured, stamped today
  assert.equal(report.streak, 13);
  assert.equal(report.streakSecured, true);
  assert.equal(report.completedToday, 1);
  assert.equal(report.hasWinToday, true);
  assert.deepEqual(report.routine, { done: 2, total: 2, pct: 1 });

  // ONE batched Todoist relabel call: t1 loses today, R1 gains today
  assert.equal(sink.todoistWrites.length, 1);
  assert.deepEqual(sink.todoistWrites[0].tasks, [
    { id: "t1", labels: ["15m"] },
    { id: "R1", labels: ["energy-low", "today"] },
  ]);

  // routine reset: 2 update_properties (Done Today -> __NO__) + 1 State update_content write
  const propWrites = sink.notionWrites.filter((w) => w.command === "update_properties");
  const stateWrites = sink.notionWrites.filter((w) => w.command === "update_content");
  assert.equal(propWrites.length, 2);
  assert.equal(propWrites[0].properties["Done Today"], "__NO__");
  assert.equal(stateWrites.length, 1);

  // the single merged State write carries the Task 7 fields
  const m = stateWrites[0].content_updates[0].new_str.match(/```json\s*([\s\S]*?)```/);
  const written = JSON.parse(m[1].trim());
  assert.equal(written.streak, 13);
  assert.equal(written.lastStreakDate, "2026-06-08");
  assert.equal(written.lastRefreshDate, "2026-06-08");
  assert.deepEqual(written.retagTomorrow, []);
  assert.deepEqual(written.plannedToday, ["R1"]); // post-relabel: only R1 carries "today"
  assert.equal(report.plannedToday, 1);
});

test("runNightly: routine below 80% -> streak not secured, unchanged", async () => {
  const sink = { notionWrites: [], todoistWrites: [] };
  const state = makeState();
  const routines = [
    { id: "rt1", name: "a", done: true, order: 1 }, { id: "rt2", name: "b", done: false, order: 2 },
    { id: "rt3", name: "c", done: false, order: 3 },
  ]; // 1/3 = 33%
  const events = [{ eventType: "completed", parentProjectId: FOCUS, eventDate: "2026-06-08T18:00:00.000Z" }];
  const report = await runNightly({
    now: NOW, notionDispatch: notionMock(state, routines, sink),
    todoistDispatch: todoistMock({}, events, sink),
  });
  assert.equal(report.streak, 12);
  assert.equal(report.streakSecured, false);
  // State still stamped/refreshed even when streak doesn't advance
  const sw = sink.notionWrites.filter((w) => w.command === "update_content")[0];
  const written = JSON.parse(sw.content_updates[0].new_str.match(/```json\s*([\s\S]*?)```/)[1].trim());
  assert.equal(written.lastRefreshDate, "2026-06-08");
  assert.deepEqual(written.retagTomorrow, []);
});
