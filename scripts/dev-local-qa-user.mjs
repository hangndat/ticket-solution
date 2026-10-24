#!/usr/bin/env node
// Synthetic identity only, in the isolated ui869dev Keycloak container.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const issuer='http://127.0.0.1:8080', username='qa-functions@example.com';
const state=fileURLToPath(new URL('../.local-dev/ui869/',import.meta.url));
const receiptPath=`${state}qa-identity.json`;
const project=execFileSync('docker',['inspect','--format','{{ index .Config.Labels "com.docker.compose.project" }}','ui869dev-keycloak-1'],{encoding:'utf8'}).trim();
if(project!=='ui869dev') throw Error('isolated_fixture_keycloak_required');
const response=await fetch(`${issuer}/realms/master/protocol/openid-connect/token`,{method:'POST',signal:AbortSignal.timeout(10000),body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:'admin'})});
const grant=await response.json();
if(!response.ok||!grant.access_token) throw Error('local_fixture_admin_auth_failed');
const headers={authorization:`Bearer ${grant.access_token}`,'content-type':'application/json'};
const existing=await fetch(`${issuer}/admin/realms/ticket/users?username=${encodeURIComponent(username)}&exact=true`,{headers,signal:AbortSignal.timeout(10000)});
if(!existing.ok) throw Error('local_fixture_identity_lookup_failed');
const users=await existing.json();
let created=false;
if(users.length===0){
  const result=await fetch(`${issuer}/admin/realms/ticket/users`,{method:'POST',headers,signal:AbortSignal.timeout(10000),body:JSON.stringify({username,email:username,firstName:'Local',lastName:'Function QA',enabled:true,emailVerified:true,requiredActions:[],credentials:[{type:'password',value:'qa-functions-demo',temporary:false}],attributes:{fixture:['ui869-function-qa']}})});
  if(!result.ok) throw Error('local_fixture_identity_create_failed');
  const id=result.headers.get('location')?.split('/').pop();
  if(!id) throw Error('local_fixture_identity_receipt_missing');
  mkdirSync(state,{recursive:true,mode:0o700});
  writeFileSync(receiptPath,JSON.stringify({issuer,realm:'ticket',username,id,fixture:'ui869-function-qa'})+'\n',{mode:0o600});
  chmodSync(receiptPath,0o600);
  created=true;
}else{
  // Keycloak can omit unmanaged attributes; a private receipt binds the exact
  // identity created by this helper without weakening collision checks.
  const receipt=existsSync(receiptPath)?JSON.parse(readFileSync(receiptPath,'utf8')):null;
  if(users.length!==1||receipt?.id!==users[0].id||receipt?.username!==username||
      receipt?.issuer!==issuer||receipt?.realm!=='ticket'||receipt?.fixture!=='ui869-function-qa'){
    throw Error('fixture_identity_collision');
  }
}
console.log(JSON.stringify({ok:true,fixture:true,created,username,role:'unprivileged attendee',purpose:'isolated account-deletion request UAT; no user/staff fixture modified'}));
