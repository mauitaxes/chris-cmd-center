# Silent-Write Hardening Implementation Plan (Step 2 fixes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No write ever fails invisibly — every failed/offline Notion write is queued, retried, and honestly reported in the UI.

**Architecture:** Extend the existing queue-first/remove-on-success pattern (already used by toggleTask et al.) to the call sites that don't follow it; fix `flushPending()` so a failed replay is never destroyed; classify boot failures (config/auth/offline) with a pure, tested helper in `cc-data.js`; surface queued-write counts via the existing `setSync` pill. **No proxy changes** (see corrections below).

**Tech Stack:** Vanilla JS (ES5-style IIFE), `node --test`, `node cc-build.js` → single-file `dist/index.html`, Netlify functions (untouched this round).

---

## Audit corrections discovered while writing this plan (2026-06-05)

These were found by reading the actual source after the subagent audit; they supersede the findings doc where they conflict:

1. **H3 is a FALSE POSITIVE — drop it.** `Active: "checkbox"` IS present in `DS_SCHEMAS` for Routines (`netlify/functions/notion-proxy.js:22`). The proxy encodes it correctly. **No schema change needed.**
2. **NEW CRITICAL — C4: `flushPending()` destroys the queue even when every replay fails.** `src/app.a.js:194–206`: each op replay is wrapped in `try{...}catch(e){}` (swallowed), then `lsClear()` runs **unconditionally**. Boot with a bad token / unreachable proxy = all queued offline edits permanently wiped. This is the single worst bug found and makes C2's "changes saved locally" message actively false. (The earlier audit marked flushPending "working" — it replays fine on success, but the failure path is destructive.)
3. **M2 downgraded to not-a-bug on the canonical path.** The proxy's `update_content` branch (`notion-proxy.js:209–222`) PATCHes only the code block; page content (incl. any "do not edit" text) is never touched. No fix needed.

**Final fix list:** C4 (flush preserves failures), C2 (honest sync status), C1+M1 (saveState queue + surface), C3 (deleteCapture queue), H4 (promoteCapture source-cap queue), H1 (runDailyReset queue-on-fail), H2 (daily report queue).

**New pending-op types introduced:** `{t:"capDel",id}`, `{t:"report",date,txt}`, `{t:"state",updates}` — alongside existing `task/prio/routine/taskAdd/win/cap/focus`.

---

## Constraints (from project memory — do not relearn)

- **READ files with the Read tool, never bash** (bash mount serves stale copies). Edit with Edit tool. Bash ONLY for `node`/`git`/builds, at `/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact/`.
- Build: `node cc-build.js` → `dist/index.html`; aborts if any src input >40KB. After building, **grep dist for a string added in this plan (e.g. `classifySyncError`)** to detect a stale bash mount; if missing, wait and re-run the build.
- Tests: `node --test cc-data.test.js` (60 now, 65 after this plan) and `node --test tests/*.test.mjs` (17, unchanged). Keep test files OUT of `netlify/functions/`.
- Sandbox can't reach github.com: commit locally; **Chris pushes**.
- `NOTION_TOKEN` never appears in repo/client/memory.

---

### Task 0: Preflight — green baseline

**Files:** none modified.

- [ ] **Step 1: Confirm clean tree and green tests**

Run:
```bash
cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && git status --porcelain && node --test cc-data.test.js 2>&1 | tail -3 && node --test tests/notion-proxy.test.mjs 2>&1 | tail -3
```
Expected: no uncommitted changes (besides the two STEP2-*.md docs), `# pass 60`, `# pass 17`. If the baseline is red, STOP and report.

---

### Task 1: Pure helpers + tests in `cc-data.js` (TDD)

**Files:**
- Modify: `cc-data.js` (add `classifySyncError`; extend `applyOps`; export)
- Test: `cc-data.test.js` (append 5 tests)

- [ ] **Step 1: Write the failing tests** — append to the end of `cc-data.test.js` (before any final newline):

```js
// ── Step 2 hardening: classifySyncError + capDel/state ops ────────────────
test("classifySyncError: proxy 500 / not configured → config", () => {
  assert.equal(C.classifySyncError('proxy 500 {"error":"server not configured"}'), "config");
  assert.equal(C.classifySyncError("proxy 500"), "config");
});
test("classifySyncError: 401/403 → auth", () => {
  assert.equal(C.classifySyncError("proxy 401"), "auth");
  assert.equal(C.classifySyncError("proxy 403 restricted from accessing"), "auth");
});
test("classifySyncError: network/other/empty → offline", () => {
  assert.equal(C.classifySyncError("Failed to fetch"), "offline");
  assert.equal(C.classifySyncError(""), "offline");
  assert.equal(C.classifySyncError("proxy 502"), "offline");
});
test("applyOps: capDel removes cap by id", () => {
  const s = C.applyOps({tasks:[],wins:[],caps:[{id:"c1",item:"a"},{id:"c2",item:"b"}]}, [{t:"capDel",id:"c1"}]);
  assert.deepEqual(s.caps.map(c => c.id), ["c2"]);
});
test("applyOps: state op merges updates onto base", () => {
  const s = C.applyOps({tasks:[],wins:[],caps:[],streak:5}, [{t:"state",updates:{streak:6,lastCompleted:"2026-06-05"}}]);
  assert.equal(s.streak, 6);
  assert.equal(s.lastCompleted, "2026-06-05");
});
```

- [ ] **Step 2: Run tests to verify the 5 new ones fail**

Run: `cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && node --test cc-data.test.js 2>&1 | tail -5`
Expected: `# pass 60`, `# fail 5` (classifySyncError not a function; applyOps missing branches).

- [ ] **Step 3: Implement.** In `cc-data.js`:

(a) Insert after the `purgeRoutineOps` function (after its closing `}` around line 145):

```js
  // step-2 hardening: classify a sync failure message → "config" | "auth" | "offline" (pure)
  function classifySyncError(msg){
    var s=String(msg||"");
    if(/proxy 500|not configured/i.test(s)) return "config";
    if(/proxy 40[13]|unauthorized|restricted from accessing/i.test(s)) return "auth";
    return "offline";
  }
```

(b) In `applyOps`, add two branches after the `else if(op.t==="win"){...}` line (mirror existing style; check the focus branch nearby and keep ordering consistent):

```js
      else if(op.t==="capDel"){ s.caps=s.caps.filter(function(z){return z.id!==op.id;}); }
      else if(op.t==="state"){ for(var k in op.updates){ if(Object.prototype.hasOwnProperty.call(op.updates,k)) s[k]=op.updates[k]; } }
```

(c) Add to the export object (after `dailyReportText: dailyReportText` add a comma, then):

```js
    classifySyncError: classifySyncError
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `node --test cc-data.test.js 2>&1 | tail -3` → Expected: `# pass 65`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && git add cc-data.js cc-data.test.js && git commit -m "feat: classifySyncError + applyOps capDel/state ops (step-2 hardening)"
```
(If the bash mount shows stale content for these files, re-author the same change via a Python patch script with assert-checked replacements per project memory, then commit.)

---

### Task 2: `app.a.js` — flushPending preserves failures; saveState queues; new ops; surfacing helper

**Files:**
- Modify: `src/app.a.js` (call(), pushReportToNotion, applyLocal, flushPending, saveState→writeStateNow split, noteQueued, deleteCapture, promoteCapture, action catch-sites)

No unit tests exist for the browser IIFE (by design — pure logic lives in cc-data.js, covered in Task 1). Verification = Task 4 build + review.

- [ ] **Step 1: call() — include response body in thrown error** (lets classifySyncError see "server not configured"). Replace (line ~109):

```js
        if(!resp.ok)throw new Error("proxy "+resp.status);
```
with:
```js
        if(!resp.ok){var bt="";try{bt=await resp.text();}catch(_e){}throw new Error("proxy "+resp.status+(bt?(" "+bt.slice(0,140)):""));}
```

- [ ] **Step 2: pushReportToNotion — queue-first (fix H2).** Replace the whole function (lines ~81–86) with:

```js
  function pushReportToNotion(d,txt){
    var op={t:"report",date:d,txt:txt};
    lsPush(op);
    if(app.mode!=="live")return;
    call(T.create,{parent:{data_source_id:DBS.capture},pages:[{properties:{
      Item:"[Daily Report "+d+"]", Notes:txt, Processed:"__YES__", "date:Captured:start":d
    }}]}).then(function(){lsRemove(op);}).catch(function(){});
  }
```
(Failure leaves the op queued for flushPending; success removes it.)

- [ ] **Step 3: applyLocal — handle the new ops.** After the `else if(op.t==="focus"){...}` line (~158), add:

```js
      else if(op.t==="capDel"){app.caps=app.caps.filter(function(z){return z.id!==op.id;});}
      else if(op.t==="state"){Object.assign(app.state,op.updates);}
```
(`report` ops need no local render — reports are hidden Processed items.)

- [ ] **Step 4: flushPending — keep failed ops, replay new ops, return failure count (fix C4).** Replace the whole function (lines ~194–206) with:

```js
  async function flushPending(){
    var o=lsGet();var p=o.pending||[];if(!p.length)return 0;
    var failed=[];
    for(var i=0;i<p.length;i++){var op=p[i];try{
      if(op.t==="task")await call(T.update,{page_id:op.id,command:"update_properties",properties:{Done:op.done?"__YES__":"__NO__"}});
      else if(op.t==="prio")await call(T.update,{page_id:op.id,command:"update_properties",properties:{Priority:op.priority?"__YES__":"__NO__"}});
      else if(op.t==="routine")await call(T.update,{page_id:op.id,command:"update_properties",properties:{"Done Today":op.done?"__YES__":"__NO__"}});
      else if(op.t==="taskAdd")await call(T.create,{parent:{data_source_id:DBS.tasks},pages:[{properties:{Task:op.title,Area:op.area||"Focus & Work",Done:"__NO__","date:Created:start":todayHST()}}]});
      else if(op.t==="win")await call(T.create,{parent:{data_source_id:DBS.wins},pages:[{properties:{Win:op.title,"date:Date:start":op.date}}]});
      else if(op.t==="cap")await call(T.create,{parent:{data_source_id:DBS.capture},pages:[{properties:{Item:op.item,Processed:"__NO__","date:Captured:start":todayHST()}}]});
      else if(op.t==="focus")await call(T.create,{parent:{data_source_id:DBS.focusSessions},pages:[{properties:{Session:"Focus "+op.min+"m "+todayHST(),"date:Date:start":todayHST(),Minutes:op.min,Type:"Focus"}}]});
      else if(op.t==="capDel")await call(T.update,{page_id:op.id,command:"update_properties",properties:{Processed:"__YES__"}});
      else if(op.t==="report")await call(T.create,{parent:{data_source_id:DBS.capture},pages:[{properties:{Item:"[Daily Report "+op.date+"]",Notes:op.txt,Processed:"__YES__","date:Captured:start":op.date}}]});
      else if(op.t==="state")await writeStateNow(op.updates);
    }catch(e){failed.push(op);}}
    var o2=lsGet();o2.pending=failed;lsSet(o2);
    return failed.length;
  }
```

- [ ] **Step 5: split saveState → writeStateNow + queueing wrapper (fix C1+M1).** Replace the whole `saveState` function (lines ~207–223) with:

```js
  async function writeStateNow(updates){
    var fresh=await call(T.fetch,{id:STATE_PAGE});
    var md=CCData.deepText(fresh);
    var mm=md.match(/```json\s*([\s\S]*?)```/);
    var curJson=mm?mm[1].trim():JSON.stringify(app.state);
    var newJson=CCData.mergeState(curJson,updates);
    var newMd=CCData.replaceStateBlock(md,newJson);
    await call(T.update,{page_id:STATE_PAGE,command:"update_content",content_updates:[{old_str:md,new_str:newMd}]});
    app.stateJson=newJson;app.state=JSON.parse(newJson);
  }
  async function saveState(updates){
    Object.assign(app.state,updates);
    if(app.mode!=="live"){lsPush({t:"state",updates:updates});return;}
    for(var attempt=0;attempt<2;attempt++){
      try{await writeStateNow(updates);return;}
      catch(e){if(attempt===1){DIAG.err="saveState failed: "+((e&&e.message)||e);lsPush({t:"state",updates:updates});noteQueued();}}
    }
  }
```
(Note: flushPending's `state` branch calls `writeStateNow` directly so a failure lands in `failed[]` instead of re-queueing twice.)

- [ ] **Step 6: add noteQueued helper.** Insert directly after the `toast` function (~line 137):

```js
  function noteQueued(){
    var pc=(lsGet().pending||[]).length;
    if(pc>0)setSync(app.mode==="live"?"live":"snap",pc+" change"+(pc===1?"":"s")+" queued — press Sync to retry");
  }
```

- [ ] **Step 7: deleteCapture — queue-first (fix C3).** Replace the whole function (lines ~266–270) with:

```js
  async function deleteCapture(idx){
    var c=app.caps[idx];if(!c)return;var capId=c.id;var item=c.item;
    app.caps.splice(idx,1);renderCaps();renderTopStats();toast("Deleted");
    if(!capId){
      var o=lsGet();o.pending=(o.pending||[]).filter(function(p){return !(p.t==="cap"&&p.item===item);});lsSet(o);
      return;
    }
    lsPush({t:"capDel",id:capId});
    if(app.mode==="live"){try{await call(T.update,{page_id:capId,command:"update_properties",properties:{Processed:"__YES__"}});lsRemove({t:"capDel",id:capId});}catch(e){noteQueued();}}
  }
```
(A cap with no id was created offline — cancel its queued create instead of queueing a delete.)

- [ ] **Step 8: promoteCapture — queue source-cap clear (fix H4).** Three edits inside the existing function (lines ~252–265):

(a) after `lsPush({t:"taskAdd",title:item,tmpid:tmp,area:area});` add:
```js
    if(capId)lsPush({t:"capDel",id:capId});
```
(b) change the Processed line to remove the queued op on success:
```js
      if(capId){await call(T.update,{page_id:capId,command:"update_properties",properties:{Processed:"__YES__"}});lsRemove({t:"capDel",id:capId});}
```
(c) change the catch to:
```js
    }catch(e){noteQueued();toast("Promote queued — will finish on next sync");}}
```

- [ ] **Step 9: surface failures at the seven queue-first action sites.** Change each empty/bare `catch(e){}` that follows a `lsPush`-protected live write to `catch(e){noteQueued();}` in: `toggleTask` (~230), `togglePriority` (~237), `toggleRoutine` (~242), `addTask` (~246), `addCapture` (~250), `addWin` (~273), `logFocus` (~278). (Exactly these seven — leave `fetchPage`/`searchIds` read catches alone.)

- [ ] **Step 10: Commit**

```bash
cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && git add src/app.a.js && git commit -m "fix: flushPending preserves failed ops; queue state/capDel/report ops; surface queued writes"
```

---

### Task 3: `app.b.js` — honest boot status + runDailyReset queue-on-fail

**Files:**
- Modify: `src/app.b.js` (runDailyReset ~line 265, boot ~lines 282–283)

- [ ] **Step 1: runDailyReset — queue a clear that fails (fix H1).** Replace (line ~265):

```js
        call(T.update,{page_id:id,command:"update_properties",properties:{"Done Today":"__NO__"}}).catch(function(){});
```
with:
```js
        call(T.update,{page_id:id,command:"update_properties",properties:{"Done Today":"__NO__"}}).catch(function(){lsPush({t:"routine",id:id,done:false});});
```
(Known residual, accepted: if the retry hasn't flushed by the NEXT daily reset, `purgeRoutineOps` drops it — rare double-failure across two days; YAGNI.)

- [ ] **Step 2: boot — distinguish config/auth/offline and show queued count (fix C2).** Replace the success+catch lines (~282–283):

```js
    try{await flushPending();await liveLoad();var didReset=runDailyReset();renderAll();if(didReset && typeof showTab==="function") showTab("routine");cacheSave();setSync("live",app.tasks.length+" tasks · "+steps().length+" routine steps · "+app.wins.length+" wins");if(isResync)toast("Synced");}
    catch(e){app.mode="snapshot";setSync("snap","offline snapshot · changes saved locally");renderAll();}
```
with:
```js
    try{var fl=await flushPending();await liveLoad();var didReset=runDailyReset();renderAll();if(didReset && typeof showTab==="function") showTab("routine");cacheSave();setSync("live",app.tasks.length+" tasks · "+steps().length+" routine steps · "+app.wins.length+" wins"+(fl?(" · "+fl+" queued"):""));if(isResync)toast("Synced");}
    catch(e){
      app.mode="snapshot";renderAll();
      var kind=CCData.classifySyncError(String((e&&e.message)||e)||DIAG.err);
      var pc=(lsGet().pending||[]).length;
      var qmsg=pc?(" · "+pc+" change"+(pc===1?"":"s")+" queued"):"";
      if(kind==="config")setSync("err","Notion not configured — NOT syncing"+qmsg);
      else if(kind==="auth")setSync("err","Notion access failed — NOT syncing"+qmsg);
      else setSync("snap","offline — will sync when reconnected"+qmsg);
    }
```

- [ ] **Step 3: Commit**

```bash
cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && git add src/app.b.js && git commit -m "fix: honest sync status (config/auth/offline) + queue failed daily-reset clears"
```

---

### Task 4: Build, full verification, final commit

**Files:**
- Generated: `dist/index.html`

- [ ] **Step 1: Full test suites**

Run: `cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && node --test cc-data.test.js 2>&1 | tail -3 && node --test tests/notion-proxy.test.mjs 2>&1 | tail -3`
Expected: `# pass 65` and `# pass 17`, zero fails.

- [ ] **Step 2: Size guard** — confirm every `src/` input and `cc-data.js` are <40KB:

Run: `ls -l "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact/src/" "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact/cc-data.js"`
Expected: all sizes <40960. (The build also enforces this.)

- [ ] **Step 3: Build + stale-mount check**

Run: `cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && node cc-build.js && grep -c "classifySyncError" dist/index.html && grep -c "capDel" dist/index.html`
Expected: build OK; both grep counts ≥1. **If 0, the bash mount is stale** — wait ~30s, re-check the mount copy matches (e.g. `grep -c classifySyncError cc-data.js`), and re-run the build before proceeding.

- [ ] **Step 4: Syntax sanity of bundled output**

Run: `node -e "var s=require('fs').readFileSync('/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact/dist/index.html','utf8');var m=s.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('script parses OK', s.length+'B')"`
Expected: `script parses OK <size>B`.

- [ ] **Step 5: Final commit**

```bash
cd "/sessions/intelligent-adoring-bohr/mnt/Command Center Artifact" && git add dist/index.html && git commit -m "build: dist for step-2 silent-write hardening" && git log --oneline -5
```

- [ ] **Step 6: Review pass** — REQUIRED SUB-SKILL: `superpowers:requesting-code-review` (one review subagent over the combined diff: `git diff <baseline>..HEAD`). Fix anything real; re-run Step 1 + Step 3 after any fix.

- [ ] **Step 7: Hand off** — Chris runs `git push` → Netlify auto-rebuilds https://chris-cmd-center.netlify.app. Post-deploy manual smoke (Chris, normal browser): load app, toggle a task, check pill text; optionally DevTools-offline → delete a capture → reload → confirm it stays deleted and pill shows "1 change queued".

---

## Self-review (done at write time)

- **Coverage:** C4→Task 2 Step 4; C2→Task 2 Step 1 + Task 3 Step 2; C1+M1→Task 2 Step 5 (+ flush `state` branch); C3→Task 2 Step 7; H4→Task 2 Step 8; H1→Task 3 Step 1; H2→Task 2 Step 2; surfacing→Task 2 Steps 6+9. H3/M2 intentionally no-op (corrections above). ✓
- **No placeholders:** every step has exact code/commands. ✓
- **Type/name consistency:** `writeStateNow` defined Task 2 Step 5, used Step 4 (same file, function hoisting OK); `classifySyncError` exported Task 1, used Task 3 via `CCData`; `noteQueued` defined Step 6, used Steps 5/7/8/9 (hoisted). New op shapes match between lsPush sites, applyLocal, applyOps, flushPending. ✓
