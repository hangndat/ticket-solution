import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendEvent, events, validateJournal } from './company-worklog.mjs';
const cli=fileURLToPath(new URL('./agent-workflow-run.mjs',import.meta.url));
function fixture(fn) {
 const dir=mkdtempSync(join(tmpdir(),'measured-worker-'));
 const log=join(dir,'calls.jsonl'), orca=join(dir,'orca'), telemetry=join(dir,'telemetry.mjs');
 writeFileSync(log,'');
 writeFileSync(orca,`#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(2);fs.appendFileSync(process.env.FIX_LOG,JSON.stringify(a)+'\\n');
const value=flag=>a[a.indexOf(flag)+1];
if(a[1]==='worker-start' && a.includes('--display-name') && !['new-child','new-top-level'].includes(value('--worktree'))) {console.log(JSON.stringify({ok:false,error:{code:'creation_flag_for_existing_worktree'}}));process.exit(1);}
let result={};if(a[1]==='worker-start')result={runId:'run1',taskId:'task1',dispatchId:'ctx1',state:process.env.FIX_START||'ready',launch:{effective:process.env.FIX_EFFECTIVE_JSON?JSON.parse(process.env.FIX_EFFECTIVE_JSON):{agent:value('--agent'),model:value('--model'),effort:a.includes('--effort')?value('--effort'):null}}};
if(a[1]==='worker-show')result={dispatch:{id:'ctx1',taskId:'task1',runId:process.env.FIX_RUN||'run1',status:process.env.FIX_STATUS||'completed'}};
if(a[1]==='worker-release')result={state:process.env.FIX_RELEASE||'released'};
console.log(JSON.stringify({ok:true,result}));
`,{mode:0o700});
 writeFileSync(telemetry,`import fs from 'node:fs';const a=process.argv.slice(2);fs.appendFileSync(process.env.FIX_LOG,JSON.stringify(a)+'\\n');if(a[0]==='collect'&&process.env.FIX_COLLECT_FAIL){console.error('collect failed');process.exit(1);}if(a[0]==='snapshot'){const p=a[a.indexOf('--out')+1];if(process.env.FIX_SNAPSHOT_FAIL){console.error('unavailable');process.exit(1);}fs.writeFileSync(p,JSON.stringify(process.env.FIX_QUOTA_JSON?JSON.parse(process.env.FIX_QUOTA_JSON):{source:'codex.app-server.account/rateLimits/read',timestamp:new Date().toISOString(),accountIdHash:'fixture',buckets:[{limitId:'codex',primary:{usedPercent:1,windowDurationMins:10080,resetsAt:Math.floor(Date.now()/1000)+3600},secondary:null}]}),{mode:0o600,flag:'wx'});}console.log(JSON.stringify({ok:true}));`);
 const claudeAuth=join(dir,'claude-auth'), claudeProbe=join(dir,'claude-probe');
 writeFileSync(claudeAuth,`#!/usr/bin/env node\nconsole.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',email:'fixture@example.com'}));\n`,{mode:0o700});
 writeFileSync(claudeProbe,`#!/usr/bin/env node\nconsole.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'OK'}));\n`,{mode:0o700});
 const run=(args,extra={})=>spawnSync(process.execPath,[cli,...args,'--dir',join(dir,'receipts')],{cwd:dir,encoding:'utf8',env:{...process.env,ORCA_CLI_COMMAND:orca,AGENT_TELEMETRY_CLI:telemetry,ORCA_METRICS_LEDGER:join(dir,'metrics.jsonl'),COMPANY_WORKLOG_FILE:join(dir,'work-events.jsonl'),AGENT_PROVIDER_CLAUDE_AUTH_BIN:claudeAuth,AGENT_PROVIDER_CLAUDE_BIN:claudeProbe,FIX_LOG:log,...extra}});
 const calls=()=>readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 try {fn({dir,run,calls});}finally{rmSync(dir,{recursive:true,force:true});}
}
const start=['start','--task','task1','--run-id','run1','--role-id','coordinator','--cost-tier','standard','--agent','cursor','--model','composer-2.5','--employee','minh','--task-title','Minh · wave'];
const settle=['settle','--dispatch-id','ctx1','--run-id','run1','--role-id','coordinator'];
test('company events normalize source UTC, dedupe and reject conflicting identities',()=>fixture(({dir})=>{
 const path=join(dir,'company.jsonl');
 const e={id:'checkpoint-1',employeeId:'linh',type:'checkpoint',runId:'run1',taskId:'task1',dispatchId:'ctx1',summary:'Kiểm tra card trên local.',occurredAt:'2026-10-24 08:00:00'};
 const r=appendEvent(e,path);assert.equal(r.event.occurredAt,'2026-10-24T08:00:00.000Z');
 assert.equal(appendEvent(e,path).recorded,false);assert.equal(events(path).length,1);
 assert.throws(()=>appendEvent({...e,employeeId:'liv'},path),/event_identity_conflict/);
 assert.throws(()=>appendEvent({...e,occurredAt:'invalid'},path),/invalid_event_timestamp/);
 assert.throws(()=>appendEvent({...e,issue:'869'},path),/invalid_event_reference/);
}));
test('multiple checkpoints survive and retry each event exactly once',()=>fixture(({dir})=>{
 const path=join(dir,'company.jsonl');
 const base={employeeId:'james',type:'checkpoint',runId:'run1',taskId:'task1',dispatchId:'ctx1',summary:'first'};
 const first=appendEvent(base,path).event;
 const second=appendEvent({...base,summary:'second'},path).event;
 assert.notEqual(first.id,second.id);
 assert.equal(appendEvent(first,path).recorded,false);
 assert.equal(appendEvent(second,path).recorded,false);
 assert.deepEqual(events(path).map(e=>e.summary),['first','second']);
 assert.throws(()=>appendEvent({...first,summary:'changed'},path),/event_identity_conflict/);
}));
test('dispatch and recovery keep employee/run/task across event types and validation',()=>fixture(({dir})=>{
 const path=join(dir,'company.jsonl');
 const assigned=appendEvent({employeeId:'james',type:'assigned',runId:'run1',taskId:'task1',dispatchId:'ctx1',summary:'assigned'},path).event;
 for(const change of [{employeeId:'linh'},{runId:'run2'},{taskId:'task2'}]) {
  assert.throws(()=>appendEvent({...assigned,id:'settled-new',type:'settled',...change},path),/dispatch_identity_conflict/);
  assert.throws(()=>validateJournal([assigned,{...assigned,id:'settled-new',type:'settled',...change}]),/dispatch_identity_conflict/);
  assert.throws(()=>appendEvent({...assigned,id:'recovered-new',type:'recovered',dispatchId:'ctx2',previousDispatchId:'ctx1',...change},path),/recovery_identity_conflict/);
 }
 appendEvent({...assigned,id:'recovered-good',type:'recovered',dispatchId:'ctx2',previousDispatchId:'ctx1'},path);
 appendEvent({...assigned,id:'settled-good',type:'settled',dispatchId:'ctx2'},path);
 assert.equal(validateJournal(events(path)).length,3);
 assert.throws(()=>validateJournal([{...assigned,id:'future-recovery',dispatchId:'ctx3',previousDispatchId:'ctx4'}, {...assigned,id:'later-source',dispatchId:'ctx4',employeeId:'linh'}]),/recovery_identity_conflict/);
}));
test('employee identity rejects role/title mismatch before launch and tracks settlement',()=>fixture(({dir,run,calls})=>{
 const withoutIdentity=start.slice(0,-4);
 assert.equal(run(withoutIdentity).status,1);assert.deepEqual(calls(),[]);
 assert.equal(run([...withoutIdentity,'--employee','linh','--task-title','Linh · web']).status,1);
 assert.deepEqual(calls(),[]);
 assert.equal(run([...withoutIdentity,'--employee','minh','--task-title','Linh · web']).status,1);
 assert.deepEqual(calls(),[]);
 const r=run(start);assert.equal(r.status,0,r.stderr);
 const wrong=run([...settle,'--employee','linh','--release']);assert.equal(wrong.status,1);
 assert.ok(!calls().some(a=>a[1]==='worker-release'));
 assert.equal(run([...settle,'--employee','minh','--release']).status,0);
 const log=readFileSync(join(dir,'work-events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.deepEqual(log.map(e=>e.type),['assigned','settled','released']);
 assert.ok(log.every(e=>e.employeeId==='minh'));
 assert.equal(log[0].model.effective.model,'composer-2.5');
}));
test('explicit recovery preserves failed dispatch identity without implicit retry',()=>fixture(({run,calls})=>{
 const r=run([...start,'--retry-of','ctx_failed','--worktree','current']);assert.equal(r.status,0,r.stderr);
 const launches=calls().filter(a=>a[1]==='worker-start');assert.equal(launches.length,1);
 assert.equal(launches[0][launches[0].indexOf('--retry-of')+1],'ctx_failed');
 assert.equal(launches[0][launches[0].indexOf('--task')+1],'task1');
}));
test('quota before start, private receipt and no implicit retries',()=>fixture(({run,calls})=>{
 const r=run(start);assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout);assert.equal(j.state,'ready');
 const c=calls();assert.equal(c[0][0],'snapshot');assert.equal(c[1][1],'worker-start');
 assert.equal(statSync(join(j.receiptDirectory,'start-receipt.json')).mode&0o777,0o600);
 const failed=run(start,{FIX_START:'outcome_unknown'});assert.equal(failed.status,1);assert.equal(JSON.parse(failed.stdout).errorCode,'start_not_ready');
 assert.equal(calls().filter(a=>a[1]==='worker-start').length,2);
}));
test('unsettled or wrong-run dispatch cannot collect or release',()=>fixture(({run,calls})=>{
 assert.equal(run([...settle,'--release'],{FIX_STATUS:'dispatched'}).status,1);
 assert.equal(run([...settle,'--release'],{FIX_RUN:'other'}).status,1);
 assert.equal(calls().filter(a=>a[0]==='collect'||a[1]==='worker-release').length,0);
}));
test('collect and snapshot precede explicitly requested release',()=>fixture(({run,calls})=>{
 const r=run([...settle,'--release']);assert.equal(r.status,0,r.stderr);
 assert.deepEqual(calls().map(a=>a[0]==='orchestration'?a[1]:a[0]),['worker-show','collect','snapshot','worker-release']);
 assert.equal(JSON.parse(r.stdout).release,'released');
}));
test('active dispatch never calls worker-release; unverifiable receipt still requests release once without released log',()=>fixture(({dir,run,calls})=>{
 run(start);
 assert.equal(run([...settle,'--release'],{FIX_STATUS:'dispatched'}).status,1);
 assert.equal(calls().filter(a=>a[1]==='worker-release').length,0);
 const bad=run([...settle,'--employee','minh','--release'],{FIX_RELEASE:'unverifiable'});
 assert.equal(bad.status,1);
 assert.equal(JSON.parse(bad.stdout).release,'unverifiable');
 assert.equal(calls().filter(a=>a[1]==='worker-release').length,1);
 const log=readFileSync(join(dir,'work-events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.ok(!log.some(e=>e.type==='released'));
}));
test('failed dispatch still collects; release receipt must be released',()=>fixture(({run,calls})=>{
 run(start);
 const ok=run([...settle,'--employee','minh','--release'],{FIX_STATUS:'failed'});
 assert.equal(ok.status,0,ok.stderr);
 assert.deepEqual(calls().filter(a=>a[1]==='worker-release').length,1);
}));
test('failed collect with --release skips worker-release',()=>fixture(({run,calls})=>{
 const r=run([...settle,'--release'],{FIX_COLLECT_FAIL:'1'});assert.equal(r.status,1,r.stderr);
 const j=JSON.parse(r.stdout);assert.equal(j.telemetryCollected,false);assert.equal(j.release,'skipped_collect_failed');assert.equal(j.nextAction,'retry_collect_before_release');
 assert.deepEqual(calls().map(a=>a[0]==='orchestration'?a[1]:a[0]),['worker-show','collect','snapshot']);
 assert.equal(calls().filter(a=>a[1]==='worker-release').length,0);
}));
test('settle retry preserves append-only event after telemetry recovers',()=>fixture(({dir,run,calls})=>{
 run(start);
 const first=run([...settle,'--employee','minh','--release'],{FIX_COLLECT_FAIL:'1'});
 assert.equal(first.status,1,first.stderr);
 const second=run([...settle,'--employee','minh','--release']);
 assert.equal(second.status,0,second.stderr);
 assert.equal(JSON.parse(second.stdout).companyTracking,'recorded');
 assert.equal(calls().filter(a=>a[1]==='worker-release').length,1);
 const log=events(join(dir,'work-events.jsonl'));
 assert.deepEqual(log.map(e=>e.type),['assigned','settled','released']);
 assert.match(log[1].summary,/telemetry unavailable/);
}));
test('quota unavailable recorded and never reported zero; start is not retried',()=>fixture(({run,calls})=>{
 const r=run(start,{FIX_SNAPSHOT_FAIL:'1'});assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout);assert.equal(j.quotaAvailable,false);
 assert.ok(readdirSync(j.receiptDirectory).some(n=>n.endsWith('.unavailable')));
 assert.equal(calls().filter(a=>a[1]==='worker-start').length,1);
}));
test('opened ledger failure is degraded; preserves ready dispatch and forbids restart',()=>fixture(({dir,run,calls})=>{
 const r=run(start,{ORCA_METRICS_LEDGER:dir});assert.equal(r.status,1);const j=JSON.parse(r.stdout);
 assert.equal(j.agentReady,true);assert.equal(j.state,'ready');assert.equal(j.ok,false);
 assert.equal(j.nextAction,'observe_existing_dispatch_do_not_restart');
 assert.equal(calls().filter(a=>a[1]==='worker-start').length,1);
}));
test('tier mismatch is rejected before snapshot or worker-start',()=>fixture(({run,calls})=>{
 const args=start.map(v=>v==='standard'?'high':v);
 const r=run(args);assert.equal(r.status,1);assert.equal(JSON.parse(r.stderr).errorCode,'model_preflight_failed');
 assert.deepEqual(calls(),[]);
}));
test('cost tier is required for a new start',()=>fixture(({run,calls})=>{
 const args=start.filter((v,i)=>v!=='--cost-tier'&&start[i-1]!=='--cost-tier');
 const r=run(args);assert.equal(r.status,1);assert.equal(JSON.parse(r.stderr).errorCode,'start_task_tier_agent_model_required');
 assert.deepEqual(calls(),[]);
}));
test('Codex tier is saved locally and not sent as an unsupported Orca flag',()=>fixture(({run,calls})=>{
 const args=start.map(v=>v==='standard'?'advanced':v==='cursor'?'codex':v==='composer-2.5'?'gpt-6-sol':v);
 const r=run([...args,'--effort','medium']);assert.equal(r.status,0,r.stderr);
 const j=JSON.parse(r.stdout);assert.equal(j.costTier,'advanced');
 const launch=calls().find(a=>a[1]==='worker-start');assert.ok(launch);assert.equal(launch.includes('--cost-tier'),false);
 assert.equal(launch[launch.indexOf('--model')+1],'gpt-6-sol');assert.equal(launch[launch.indexOf('--effort')+1],'medium');
 assert.deepEqual(JSON.parse(readFileSync(join(j.receiptDirectory,'routing.json'),'utf8')),{costTier:'advanced',agent:'codex',model:'gpt-6-sol',effort:'medium'});
}));

const codexStart=[...start.map(v=>v==='standard'?'advanced':v==='cursor'?'codex':v==='composer-2.5'?'gpt-6-sol':v),'--effort','medium'];
test('Codex missing quota blocks before launch',()=>fixture(({run,calls})=>{
 const r=run(codexStart,{FIX_SNAPSHOT_FAIL:'1'});assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).errorCode,'quota_unknown');assert.ok(!calls().some(a=>a[1]==='worker-start'));
}));
test('Codex reserve needs essential reason; exhausted cannot be bypassed',()=>fixture(({run,calls})=>{
 const quota=used=>JSON.stringify({source:'codex.app-server.account/rateLimits/read',timestamp:new Date().toISOString(),accountIdHash:'fixture',buckets:[{limitId:'codex',primary:{usedPercent:used,windowDurationMins:10080,resetsAt:Math.floor(Date.now()/1000)+3600}}]});
 assert.equal(run(codexStart,{FIX_QUOTA_JSON:quota(85)}).status,1);
 const r=run([...codexStart,'--essential-reason','production recovery'],{FIX_QUOTA_JSON:quota(85)});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).quotaCheck.state,'reserve_for_essential');
 assert.equal(run([...codexStart,'--essential-reason','production recovery'],{FIX_QUOTA_JSON:quota(100)}).status,1);
 const launches=calls().filter(a=>a[1]==='worker-start');assert.equal(launches.length,1);assert.equal(launches[0].includes('--essential-reason'),false);
}));
test('high reason required and remains local metadata',()=>fixture(({run,calls})=>{
 const args=codexStart.map(v=>v==='advanced'||v==='medium'?'high':v);
 assert.equal(run(args).status,1);
 const r=run([...args,'--tier-reason','tenant isolation']);assert.equal(r.status,0,r.stderr);
 const j=JSON.parse(r.stdout);assert.equal(JSON.parse(readFileSync(join(j.receiptDirectory,'routing.json'),'utf8')).tierReason,'tenant isolation');
 assert.equal(calls().find(a=>a[1]==='worker-start').includes('--tier-reason'),false);
}));

test('Claude routes preserve requested model and effort; quota stays explicitly unknown',()=>fixture(({run,calls})=>{
 for(const [tier,model,effort] of [['focused','claude-sonnet-5','low'],['advanced','claude-sonnet-5','medium'],['high','claude-sonnet-5','high']]) {
  const args=start.map(v=>v==='standard'?tier:v==='cursor'?'claude':v==='composer-2.5'?model:v);
  const r=run([...args,'--effort',effort,...(tier==='high'?['--tier-reason','tenant isolation']:[])],{FIX_SNAPSHOT_FAIL:'1'});
  assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout);
  assert.deepEqual(j.quotaCheck,{enforced:false,provider:'claude',state:'unknown',reason:'adapter_unavailable'});
  assert.equal(j.quotaSnapshotProvider,'codex');assert.equal(j.quotaAvailable,false);
  const launch=calls().filter(a=>a[1]==='worker-start').at(-1);
  assert.equal(launch[launch.indexOf('--agent')+1],'claude');
  assert.equal(launch[launch.indexOf('--model')+1],model);assert.equal(launch[launch.indexOf('--effort')+1],effort);
  assert.equal(launch.includes('--cost-tier'),false);assert.equal(launch.includes('--tier-reason'),false);
 }
}));

test('Persona is local for existing worktrees and forwarded only for new placement',()=>fixture(({run,calls})=>{
 for(const worktree of ['current','path:/existing','new-child','new-top-level']) {
  const r=run([...start,'--worktree',worktree,'--display-name','Minh · wave']);assert.equal(r.status,0,r.stderr);
  const j=JSON.parse(r.stdout);assert.equal(JSON.parse(readFileSync(join(j.receiptDirectory,'routing.json'),'utf8')).displayName,'Minh · wave');
  const launch=calls().filter(a=>a[1]==='worker-start').at(-1);
  assert.equal(launch.includes('--display-name'),worktree.startsWith('new-'));assert.equal(launch.includes('--task-title'),true);
 }
}));
test('wrong or missing effective route preserves live dispatch and never retries',()=>fixture(({run,calls})=>{
 const cases=[null,{}, {agent:'codex',model:'gpt-6-sol'}, {agent:'cursor',model:'composer-2.5'}, {agent:'codex',model:'other',effort:'medium'}, {agent:'codex',model:'gpt-6-sol',effort:'high'}];
 for(const effective of cases) {
  const before=calls().filter(a=>a[1]==='worker-start').length;
  const r=run(codexStart,{FIX_EFFECTIVE_JSON:JSON.stringify(effective)});assert.equal(r.status,1,r.stderr);const j=JSON.parse(r.stdout);
  assert.equal(j.agentReady,true);assert.equal(j.dispatchId,'ctx1');assert.equal(j.openedRecorded,true);assert.equal(j.ok,false);
  assert.equal(j.nextAction,'observe_existing_dispatch_do_not_restart');assert.match(j.errorCode,/^effective_route_(unknown|mismatch)$/);
  assert.equal(calls().filter(a=>a[1]==='worker-start').length,before+1);
  assert.ok(!calls().some(a=>['worker-stop','worker-release'].includes(a[1])));
 }
}));
