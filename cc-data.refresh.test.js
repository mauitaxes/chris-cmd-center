import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("./cc-data.js");

// ── Task 10: refresh/poll scheduling + in-session staleness ──────────────────

// ---- parseRetryAfter ----
test("parseRetryAfter: integer delta-seconds -> ms", () => {
  assert.equal(C.parseRetryAfter("30"), 30000);
  assert.equal(C.parseRetryAfter("0"), 0);
  assert.equal(C.parseRetryAfter(5), 5000);
});

test("parseRetryAfter: HTTP-date -> ms from now (clamped at 0)", () => {
  const now = Date.UTC(2026, 5, 8, 12, 0, 0);
  assert.equal(C.parseRetryAfter(new Date(now + 45000).toUTCString(), now), 45000);
  assert.equal(C.parseRetryAfter(new Date(now - 60000).toUTCString(), now), 0); // past -> 0
});

test("parseRetryAfter: missing/empty/garbage -> 0", () => {
  assert.equal(C.parseRetryAfter(null), 0);
  assert.equal(C.parseRetryAfter(undefined), 0);
  assert.equal(C.parseRetryAfter(""), 0);
  assert.equal(C.parseRetryAfter("   "), 0);
  assert.equal(C.parseRetryAfter("soon"), 0);
});

// ---- is429 ----
test("is429: number, message string, Error object", () => {
  assert.equal(C.is429(429), true);
  assert.equal(C.is429(503), false);
  assert.equal(C.is429("proxy 429 too many"), true);
  assert.equal(C.is429("Too Many Requests"), true);
  assert.equal(C.is429("rate limit exceeded"), true);
  assert.equal(C.is429(new Error("proxy 429 ...")), true);
  assert.equal(C.is429("proxy 4290 weird"), false); // not a bare 429
  assert.equal(C.is429("ok"), false);
  assert.equal(C.is429(null), false);
});

// ---- backoffDelay ----
test("backoffDelay: exponential from base, capped at max", () => {
  const o = { base: 5000, factor: 2, max: 60000 };
  assert.equal(C.backoffDelay(0, o), 0);
  assert.equal(C.backoffDelay(1, o), 5000);
  assert.equal(C.backoffDelay(2, o), 10000);
  assert.equal(C.backoffDelay(3, o), 20000);
  assert.equal(C.backoffDelay(10, o), 60000); // capped
});

// ---- nextRefreshDelay (the policy) ----
test("nextRefreshDelay: success -> steady cadence", () => {
  assert.equal(C.nextRefreshDelay({ ok: true, pollMs: 180000 }), 180000);
  assert.equal(C.nextRefreshDelay({ ok: true }), 180000); // default 3 min
});

test("nextRefreshDelay: 429 honors Retry-After when it exceeds backoff", () => {
  const d = C.nextRefreshDelay({ ok: false, status: 429, retryAfterMs: 90000, failures: 1, baseMs: 5000, maxMs: 300000 });
  assert.equal(d, 90000); // Retry-After (90s) > backoff(1)=5s
});

test("nextRefreshDelay: 429 falls back to backoff when Retry-After absent", () => {
  const d = C.nextRefreshDelay({ ok: false, status: 429, failures: 3, baseMs: 5000, maxMs: 300000 });
  assert.equal(d, 20000); // backoff(3) = 5000*2^2
});

test("nextRefreshDelay: non-429 error -> pure backoff", () => {
  assert.equal(C.nextRefreshDelay({ ok: false, status: 500, failures: 2, baseMs: 5000 }), 10000);
});

test("nextRefreshDelay: never polls faster than Retry-After even on first failure", () => {
  const d = C.nextRefreshDelay({ ok: false, retryAfterMs: 120000, failures: 1 });
  assert.equal(d, 120000);
});

// ---- refreshAge ----
test("refreshAge: buckets seconds/minutes/hours", () => {
  assert.equal(C.refreshAge(0), "just now");
  assert.equal(C.refreshAge(3000), "just now");
  assert.equal(C.refreshAge(20000), "20s ago");
  assert.equal(C.refreshAge(5 * 60000), "5m ago");
  assert.equal(C.refreshAge(2 * 3600000), "2h ago");
});

// ---- refreshStatus ----
test("refreshStatus: no success yet -> empty/neutral", () => {
  assert.deepEqual(C.refreshStatus({ lastSuccessTs: 0 }), { ageMs: null, stale: false, text: "" });
  assert.deepEqual(C.refreshStatus({}), { ageMs: null, stale: false, text: "" });
});

test("refreshStatus: fresh -> not stale, 'updated …'", () => {
  const now = 1_000_000_000;
  const r = C.refreshStatus({ lastSuccessTs: now - 90000, now, staleAfterMs: 600000 });
  assert.equal(r.stale, false);
  assert.equal(r.text, "updated 1m ago");
});

test("refreshStatus: past threshold -> stale prefix", () => {
  const now = 1_000_000_000;
  const r = C.refreshStatus({ lastSuccessTs: now - 12 * 60000, now, staleAfterMs: 600000 });
  assert.equal(r.stale, true);
  assert.equal(r.text, "stale · updated 12m ago");
  assert.equal(r.ageMs, 12 * 60000);
});
