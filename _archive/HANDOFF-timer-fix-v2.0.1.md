# Handoff: Pomodoro timer fix (v2.0.1)

## Goal
Fix the Focus-page pomodoro so it tracks real elapsed time instead of pausing/drifting
when the page is backgrounded or the machine sleeps. Ship as version 2.0.1.

## DONE (verified in src/ via reliable file reader)
- `src/app.b.js` lines 197–204: timer rewritten to compute remaining seconds from a
  stored `endAt` timestamp (`Date.now()`), not by decrementing a counter per setInterval
  tick. Start/Pause, Reset, and +5 all keep `endAt` in sync. Self-corrects on tab return.
- `src/index.html` line 23: version badge changed `v2.0.0` -> `v2.0.1`.

## NOT DONE — the one remaining step
- Regenerate `dist/index.html` from src by running: `node cc-build.js`
  (assembles src/index.html + src/styles.css + app.a.js + app.c.js + app.b.js + cc-data.js).
- `dist/index.html` is still the OLD v2.0.0 build. The fix is NOT live until rebuilt.

## WHY it wasn't finished here (important)
- This session's Linux sandbox mount reads the larger source files NON-DETERMINISTICALLY —
  `app.b.js` (~31KB) and `cc-data.js` (~36KB) sometimes return full content, sometimes
  truncated mid-file. `cc-build.js`'s guard only checks file *size* (stat), so a truncated
  read would silently produce a broken dist. So the build was intentionally skipped.

## How to finish safely
- Best: run `node cc-build.js` in a trusted environment (your machine), then deploy `dist/`.
- If building in-sandbox: after building, VERIFY the output by reading the TAIL of
  dist/index.html with the reliable file reader — it must end with:
  `  wire();resetTimer();tick();setInterval(tick,1000);boot(false);` then `})();` then
  `</script></body></html>`. Also confirm the new timer line (`timer.endAt=Date.now()+timer.left*1000`)
  and `v2.0.1` are present. If the tail is missing, the read truncated — do not deploy.

## Scope note
- No behavior beyond the timer + version was changed. Tests/build infra were not modified.
- Known caveat of the fix: timer is accurate on return to the page, but does NOT fire a
  completion alert while the tab is fully asleep (would need Web Notifications/scheduled audio).
