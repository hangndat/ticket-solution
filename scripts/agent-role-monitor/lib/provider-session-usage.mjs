import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Discover only the session bound by Orca's process incarnation. Search hits from
// a coordinator mentioning the dispatch are never sufficient evidence.
export function discoverSessionUsage({dispatchId, root, provenance, orcaJson, parseCodex, env}) {
  const incarnation = provenance.sessionIncarnation;
  if (!incarnation?.startsWith('structured:')) return { reason: 'session_binding_unavailable' };
  const session = incarnation.slice('structured:'.length);
  const response = orcaJson(['search', dispatchId, '--path', root, '--limit', '100', '--json'], env);
  const matches = (response.result?.hits ?? []).filter(hit =>
    hit.structuredSession?.sessionId === session && hit.cwd === root &&
    hit.source?.presence === 'present' && hit.source?.filePath &&
    ['codex','opencode','opencode2'].includes(hit.agent));
  const unique = [...new Map(matches.map(hit => [`${hit.sessionId}:${hit.source.filePath}`,hit])).values()];
  if (unique.length !== 1) return { reason: unique.length ? 'provider_source_ambiguous' : 'provider_source_not_indexed' };
  const hit = unique[0];
  if (hit.agent === 'codex' && provenance.provider === 'codex') {
    const usage = parseCodex(hit.source.filePath, {threadId:hit.sessionId});
    if (usage.provenance.observed_thread_id !== hit.sessionId) return {reason:'provider_session_mismatch'};
    return {usage, threadId:hit.sessionId, reason:usage.completeness === 'missing' ? 'provider_usage_missing' : null};
  }
  if (!['opencode','opencode2'].includes(hit.agent) || provenance.provider !== 'opencode') return {reason:'provider_mismatch'};
  if (!/^ses_[A-Za-z0-9_-]+$/.test(hit.sessionId) || path.extname(hit.source.filePath) !== '.db') return {reason:'invalid_provider_source'};
  // Read counters only. No message bodies, auth tables, credentials or prompts.
  const query = `SELECT id,directory,tokens_input,tokens_output,tokens_reasoning,tokens_cache_read,tokens_cache_write FROM session_v2 WHERE id='${hit.sessionId}'`;
  const rows = JSON.parse(execFileSync('sqlite3',['-readonly','-json',hit.source.filePath,query],{encoding:'utf8',env,maxBuffer:1e6,timeout:10000}));
  const row = rows[0];
  if (rows.length !== 1 || row.id !== hit.sessionId || path.resolve(row.directory) !== path.resolve(root)) return {reason:'provider_session_mismatch'};
  const counter = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  return {threadId:hit.sessionId, reason:null, usage:{
    source:'opencode_session_sqlite',
    provenance:{thread_id:hit.sessionId,provider_session:true,binding:'orca_process_incarnation'},
    tokens:{input:counter(row.tokens_input),output:counter(row.tokens_output),reasoning:counter(row.tokens_reasoning),cachedInput:counter(row.tokens_cache_read),cacheWrite:counter(row.tokens_cache_write)},
    completeness:'cumulative_session',task_delta:null,session_range_delta:null,
    note:'Provider session totals, not dispatch delta. OpenCode input/cache/reasoning counters retain native semantics; do not add or compare to Codex without normalization.',
  }};
}
