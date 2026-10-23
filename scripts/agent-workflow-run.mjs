#!/usr/bin/env node
/** Measured Orca lifecycle: snapshots + start receipt, collect after proven settlement. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const telemetry = process.env.AGENT_TELEMETRY_CLI || join(ROOT, 'scripts/agent-role-monitor/telemetry.mjs');
const orca = process.env.ORCA_CLI_COMMAND || 'orca';
function child(bin, args) {
  const p = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 8e6, timeout: 90000, stdio: ['ignore','pipe','pipe'] });
  let data = null;
  try { data = JSON.parse(p.stdout); } catch { /* not a JSON receipt */ }
  return { ok: p.status === 0 && !p.error, data, exit: p.status };
}
function save(dir, name, value) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const file = join(dir, name);
  writeFileSync(file, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' });
  return file;
}
function snapshot(dir, name, run, dispatch, role) {
  const args = [telemetry,'snapshot','--out',join(dir,name),'--run-id',run,'--role-id',role];
  if (dispatch) args.push('--dispatch-id',dispatch);
  const r = child(process.execPath,args);
  if (!r.ok) save(dir, `${name}.unavailable`, { source:'account_snapshot', available:false, errorCode:'snapshot_unavailable', capturedAt:new Date().toISOString() });
  return r.ok;
}
function parse(argv) {
  const command = argv.shift(), flags = {};
  const values = new Set(['task','run-id','dispatch-id','role-id','agent','model','effort','worktree','dir','provider-file','retry-request','thread-id','baseline-file','comparison-key','display-name','task-title']);
  for(let i=0;i<argv.length;i++) {
    if(argv[i]==='--release') { flags.release=true;continue; }
    const key=argv[i].slice(2);
    if(!argv[i].startsWith('--') || !values.has(key) || flags[key]!==undefined || !argv[i+1] || argv[i+1].startsWith('--')) throw Error('invalid_arguments');
    flags[key]=argv[++i];
  }
  if(!['start','settle'].includes(command) || !flags['run-id'] || !flags['role-id']) throw Error('command_run_role_required');
  if(command==='start' && (!flags.task || !flags.agent || !flags.model || flags.release)) throw Error('start_task_agent_model_required');
  if(command==='settle' && !flags['dispatch-id']) throw Error('settle_dispatch_required');
  return {command,flags};
}
export function main(argv=process.argv.slice(2)) {
  if(argv.includes('--help')) {
    console.log('agent-workflow-run start --task ID --run-id ID --role-id ID --agent cursor --model composer-2.5 [--worktree current] [--effort LEVEL] [--retry-request REQUEST_ID]\nagent-workflow-run settle --dispatch-id ID --run-id ID --role-id ID [--provider-file PATH] [--release]\n--dir defaults to private .orca-metrics/lifecycle. Start snapshots quota, uses preflight and records receipt. Never automatically retries a failed/unknown start. Settle requires proven completed/failed dispatch; collects before optional release. Quota failure is recorded as unavailable, not zero.');return;
  }
  const {command,flags:f}=parse([...argv]);
  const run=f['run-id'], role=f['role-id'];
  const dir=resolve(f.dir || join(process.cwd(),'.orca-metrics/lifecycle'),`${Date.now()}-${randomUUID()}`);
  mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
  let output;
  if(command==='start') {
    const pin=['--agent',f.agent,'--model',f.model];if(f.effort)pin.push('--effort',f.effort);
    const preflight=child(process.execPath,[join(ROOT,'scripts/orca-spawn-model-preflight.mjs'),'--',...pin]);
    if(!preflight.ok)throw Error('model_preflight_failed');
    const quotaAvailable=snapshot(dir,'quota-before.json',run,null,role);
    const args=['orchestration','worker-start','--run',run,'--task',f.task,'--worktree',f.worktree||'current',...pin,'--json'];
    for (const key of ['display-name','task-title']) if(f[key])args.push(`--${key}`,f[key]);
    if(f['retry-request'])args.push('--retry-request',f['retry-request']);
    const receipt=child(orca,args);save(dir,'start-receipt.json',receipt.data || {available:false,errorCode:'receipt_unavailable'});
    const r=receipt.data?.result;
    if(!receipt.ok || !receipt.data?.ok || r?.state!=='ready' || r.runId!==run || r.taskId!==f.task || !r.dispatchId) {
      // Preserve original host recovery instructions; do not manufacture a new attempt.
      console.log(JSON.stringify({ok:false,errorCode:'start_not_ready',quotaAvailable,receipt:receipt.data,receiptDirectory:dir}));process.exitCode=1;return;
    }
    const opened=child(process.execPath,[join(ROOT,'scripts/agent-role-monitor/cli.mjs'),'record-opened','--dispatch-id',r.dispatchId,'--task-id',f.task,'--run-id',run,'--role-id',role,'--agent',f.agent]);
    save(dir,'opened-status.json',{recorded:opened.ok});
    if(!opened.ok)process.exitCode=1;
    output={ok:opened.ok,command,runId:run,taskId:f.task,dispatchId:r.dispatchId,state:r.state,agentReady:true,launch:r.launch,quotaAvailable,openedRecorded:opened.ok,telemetryStatus:opened.ok?'recorded':'degraded',nextAction:opened.ok?'supervise':'observe_existing_dispatch_do_not_restart',receiptDirectory:dir};
  } else {
    const id=f['dispatch-id'];
    const show=child(orca,['orchestration','worker-show','--dispatch',id,'--json']);
    const d=show.data?.result?.dispatch;
    if(!show.ok || !show.data?.ok || !d || !['completed','failed'].includes(d.status) || (d.runId || d.run_id)!==run)throw Error('dispatch_not_proven_settled_in_run');
    const args=[telemetry,'collect','--dispatch-id',id,'--role-id',role,'--run-id',run];
    for (const key of ['provider-file','thread-id','baseline-file','comparison-key']) if(f[key])args.push(`--${key}`,f[key]);
    const collected=child(process.execPath,args);save(dir,'collection-status.json',{available:collected.ok,result:collected.data});
    const quotaAvailable=snapshot(dir,'quota-after.json',run,id,role);
    let release=null;
    let nextAction;
    if(f.release) {
      if(!collected.ok) {
        release='skipped_collect_failed';
        nextAction='retry_collect_before_release';
      } else {
        const result=child(orca,['orchestration','worker-release','--dispatch',id,'--json']);save(dir,'release-receipt.json',result.data);
        release=result.data?.result?.state ?? 'unverifiable';
        if(!result.ok || !result.data?.ok || release!=='released')process.exitCode=1;
      }
    }
    if(!collected.ok)process.exitCode=1;
    output={ok:!process.exitCode,command,runId:run,dispatchId:id,telemetryCollected:collected.ok,quotaAvailable,release,receiptDirectory:dir};
    if(nextAction)output.nextAction=nextAction;
  }
  console.log(JSON.stringify(output));
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href) {
  try{main();}catch(e){console.error(JSON.stringify({ok:false,errorCode:e.message}));process.exitCode=1;}
}
