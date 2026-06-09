import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("./cc-data.js");

// ── Task 8: streakStatus — display-only status text for the dashboard ───────
// Mirrors evaluateStreak's predicate (shared streakConditions), but never advances
// the streak. Returns { secured, needs:[win?,task?,routine?], warnZeroRoutine, graced }.

test("streakStatus: all 3 conditions met -> secured, no needs", () => {
  const r = C.streakStatus({hasWinToday:true,completedToday:2,routinePct:0.8,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.deepEqual(r, {secured:true,needs:[],warnZeroRoutine:false,graced:false});
});

test("streakStatus: missing win only -> needs ['win']", () => {
  const r = C.streakStatus({hasWinToday:false,completedToday:2,routinePct:1,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.deepEqual(r, {secured:false,needs:["win"],warnZeroRoutine:false,graced:false});
});

test("streakStatus: missing completed task only -> needs ['task']", () => {
  const r = C.streakStatus({hasWinToday:true,completedToday:0,routinePct:1,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.deepEqual(r, {secured:false,needs:["task"],warnZeroRoutine:false,graced:false});
});

test("streakStatus: routine below 80% only -> needs ['routine']", () => {
  const r = C.streakStatus({hasWinToday:true,completedToday:1,routinePct:0.6,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.deepEqual(r, {secured:false,needs:["routine"],warnZeroRoutine:false,graced:false});
});

test("streakStatus: all unmet -> needs in win/task/routine order", () => {
  const r = C.streakStatus({hasWinToday:false,completedToday:0,routinePct:0.1,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.deepEqual(r, {secured:false,needs:["win","task","routine"],warnZeroRoutine:false,graced:false});
});

test("streakStatus: completedToday accepts boolean false -> needs ['task']", () => {
  const r = C.streakStatus({hasWinToday:true,completedToday:false,routinePct:1,routineSteps:5,lastStreakDate:"",today:"2026-06-08"});
  assert.deepEqual(r, {secured:false,needs:["task"],warnZeroRoutine:false,graced:false});
});

test("streakStatus: zero routine steps -> routine omitted from needs + warn", () => {
  const r = C.streakStatus({hasWinToday:false,completedToday:0,routinePct:0,routineSteps:0,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.deepEqual(r, {secured:false,needs:["win","task"],warnZeroRoutine:true,graced:false});
});

test("streakStatus: zero routine steps but win+task met -> secured, warn still set", () => {
  const r = C.streakStatus({hasWinToday:true,completedToday:1,routinePct:0,routineSteps:0,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.deepEqual(r, {secured:true,needs:[],warnZeroRoutine:true,graced:false});
});

test("streakStatus: grace day secures even if conditions unmet -> graced:true", () => {
  const r = C.streakStatus({hasWinToday:false,completedToday:0,routinePct:0,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08",streakGraceUntil:"2026-06-08"});
  assert.deepEqual(r, {secured:true,needs:[],warnZeroRoutine:false,graced:true});
});

test("streakStatus: already secured today -> secured, no needs, not graced", () => {
  const r = C.streakStatus({hasWinToday:false,completedToday:0,routinePct:0,routineSteps:5,lastStreakDate:"2026-06-08",today:"2026-06-08"});
  assert.deepEqual(r, {secured:true,needs:[],warnZeroRoutine:false,graced:false});
});

test("streakStatus: never advances the streak (no streak field in output)", () => {
  const r = C.streakStatus({hasWinToday:true,completedToday:1,routinePct:1,routineSteps:3,streak:12,lastStreakDate:"2026-06-07",today:"2026-06-08"});
  assert.equal(r.streak, undefined);
  assert.equal(r.lastStreakDate, undefined);
});

// Parity guard: streakStatus.secured agrees with evaluateStreak.secured across cases.
test("streakStatus + evaluateStreak agree on 'secured' (shared predicate)", () => {
  const cases = [
    {hasWinToday:true,completedToday:2,routinePct:0.8,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08"},
    {hasWinToday:true,completedToday:1,routinePct:0.6,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08"},
    {hasWinToday:false,completedToday:3,routinePct:1,routineSteps:5,lastStreakDate:"",today:"2026-06-08"},
    {hasWinToday:true,completedToday:1,routinePct:0,routineSteps:0,lastStreakDate:"2026-06-07",today:"2026-06-08"},
    {hasWinToday:false,completedToday:0,routinePct:0,routineSteps:5,lastStreakDate:"2026-06-07",today:"2026-06-08",streakGraceUntil:"2026-06-08"},
    {hasWinToday:false,completedToday:0,routinePct:0,routineSteps:5,lastStreakDate:"2026-06-08",today:"2026-06-08"},
  ];
  cases.forEach((o) => {
    assert.equal(C.streakStatus(o).secured, C.evaluateStreak(Object.assign({streak:1},o)).secured);
  });
});
