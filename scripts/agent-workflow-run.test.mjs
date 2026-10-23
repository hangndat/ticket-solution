import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli=fileURLToPath(new URL('./agent-workflow-run.mjs',import.meta.url));
function fixture(fn) {
 const dir=mkdtempSync(join(tmpdir(),'measured-worker-'));
 const log=join(dir,'calls.jsonl'), orca=join(dir,'orca'), telemetry=join(dir,'telemetry.mjs');
 writeFileSync(log,'');
 writeFileSync(orca,`#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(2);fs.appendFileSync(process.env.FIX_LOG,JSON.stringify(a)+'\\n');
let result={};if(a[1]==='worker-start')result={runId:'run1',taskId:'task1',dispatchId:'ctx1',state:process.env.FIX_START||'ready',launch:{effective:{agent:'cursor',model:'composer-2.5'}}};
if(a[1]==='worker-show')result={dispatch:{id:'ctx1',runId:process.env.FIX_RUN||'run1',status:process.env.FIX_STATUS||'completed'}};
if(a[1]==='worker-release')result={state:'released'};
console.log(JSON.stringify({ok:true,result}));
`,{mode:0o700});
 writeFileSync(telemetry,`import fs from 'node:fs';const a=process.argv.slice(2);fs.appendFileSync(process.env.FIX_LOG,JSON.stringify(a)+'\\n');if(a[0]==='collect'&&process.env.FIX_COLLECT_FAIL){console.error('collect failed');process.exit(1);}if(a[0]==='snapshot'){const p=a[a.indexOf('--out')+1];if(process.env.FIX_SNAPSHOT_FAIL){console.error('unavailable');process.exit(1);}fs.writeFileSync(p,JSON.stringify({usedPercent:1}),{mode:0o600,flag:'wx'});}console.log(JSON.stringify({ok:true}));`);
 const run=(args,extra={})=>spawnSync(process.execPath,[cli,...args,'--dir',join(dir,'receipts')],{cwd:dir,encoding:'utf8',env:{...process.env,ORCA_CLI_COMMAND:orca,AGENT_TELEMETRY_CLI:telemetry,ORCA_METRICS_LEDGER:join(dir,'metrics.jsonl'),FIX_LOG:log,...extra}});
 const calls=()=>readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 try {fn({dir,run,calls});}finally{rmSync(dir,{recursive:true,force:true});}
}
const start=['start','--task','task1','--run-id','run1','--role-id','coordinator','--agent','cursor','--model','composer-2.5'];
const settle=['settle','--dispatch-id','ctx1','--run-id','run1','--role-id','coordinator'];
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
test('failed collect with --release skips worker-release',()=>fixture(({run,calls})=>{
 const r=run([...settle,'--release'],{FIX_COLLECT_FAIL:'1'});assert.equal(r.status,1,r.stderr);
 const j=JSON.parse(r.stdout);assert.equal(j.telemetryCollected,false);assert.equal(j.release,'skipped_collect_failed');assert.equal(j.nextAction,'retry_collect_before_release');
 assert.deepEqual(calls().map(a=>a[0]==='orchestration'?a[1]:a[0]),['worker-show','collect','snapshot']);
 assert.equal(calls().filter(a=>a[1]==='worker-release').length,0);
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
