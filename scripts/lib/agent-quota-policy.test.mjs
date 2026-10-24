import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCodexQuota } from './agent-quota-policy.mjs';
import { whitelistAccountSnapshot } from '../agent-role-monitor/lib/codex-app-server.mjs';
const now=Date.now();
const window=(usedPercent=10)=>({usedPercent,windowDurationMins:10080,resetsAt:Math.floor(now/1000)+3600});
const snapshot=()=>({source:'codex.app-server.account/rateLimits/read',timestamp:new Date(now).toISOString(),accountIdHash:'fixture',buckets:[{limitId:'codex',primary:window(),secondary:null}]});
const check=(s,essential=false)=>assessCodexQuota(s,{limitIds:['codex'],now,essential});
test('reserve boundary and essential exception never bypass exhaustion',()=>{
 for(const [used,state] of [[79,'available'],[80,'reserved'],[99,'reserved'],[100,'exhausted']]) {
  const s=snapshot();s.buckets[0].primary=window(used);assert.equal(check(s).state,state);
  assert.equal(check(s,true).allowed,used<100);
 }
});
test('secondary and relevant buckets gate; unrelated quota does not',()=>{
 const s=snapshot();s.buckets.push({limitId:'other',primary:window(100)});assert.equal(check(s).allowed,true);
 s.buckets[0].secondary=window(100);assert.equal(check(s,true).state,'exhausted');
});
test('missing, stale, malformed, and reset-past quota fail closed',()=>{
 const changes=[s=>delete s.accountIdHash,s=>s.source='other',s=>s.buckets=[],s=>s.buckets.push(s.buckets[0]),s=>s.timestamp=new Date(now-300001).toISOString(),s=>s.timestamp=new Date(now+1).toISOString(),s=>s.buckets[0].primary.usedPercent=null,s=>s.buckets[0].primary.resetsAt=0,s=>s.buckets[0].primary=null];
 for(const change of changes){const s=snapshot();change(s);assert.equal(check(s,true).allowed,false);}
 assert.equal(check(null).allowed,false);
});
test('provider reached flag blocks even essential work',()=>{
 const s=snapshot();s.buckets[0].rateLimitReachedType='limit';assert.equal(check(s,true).state,'exhausted');
});
test('snapshot whitelist preserves both windows and buckets without raw sensitive fields',()=>{
 const raw={accountId:'private-account',rateLimits:{limitId:'codex',primary:window(5),secondary:window(40)},rateLimitsByLimitId:{codex:{primary:window(5),secondary:window(40),token:'secret'},other:{primary:window(90)}}};
 const s=whitelistAccountSnapshot(raw);assert.equal(s.buckets.length,2);assert.equal(s.buckets[0].secondary.usedPercent,40);
 assert.equal(s.usedPercent,5);assert.ok(!JSON.stringify(s).includes('secret'));assert.ok(!JSON.stringify(s).includes('private-account'));
});
