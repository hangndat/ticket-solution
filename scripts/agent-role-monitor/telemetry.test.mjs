import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  parseProviderTokenJsonl,
  extractStructuralTranscriptEvents,
  isWorktreeDispatchAmbiguous,
  buildTelemetryReport,
  readWorkerTranscriptMetadata,
  collectTelemetry,
  snapshotsComparable,
  dedupeStructuralEvents,
  buildWorkloadFingerprint,
  applyProviderBaseline,
  snapshotProviderBaseline,
  resolveGitSha,
} from './lib/usage.mjs';
import { repoRoot } from './lib/ledger.mjs';
import { sanitizeOrchestrationBlock } from './lib/transcript-sanitize.mjs';
import { invokeAppServer, whitelistAccountUsage, whitelistAccountSnapshot, assertNoForbiddenSnapshotKeys } from './lib/codex-app-server.mjs';
import { readTelemetryEvents, newestCollectByDispatch, appendTelemetryEvent, TELEMETRY_SCHEMA_VERSION } from './lib/telemetry-ledger.mjs';
import { appendEvent, buildCursorTurnEvent, buildJoinEvent } from './lib/ledger.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TELEMETRY_CLI = join(__dirname, 'telemetry.mjs');
const CLI = join(__dirname, 'cli.mjs');
const FIXTURES = join(__dirname, 'test/fixtures');
const FAKE_APP_SERVER = join(FIXTURES, 'fake-app-server.mjs');

function makeFakeOrca(handlers) {
  const dir = mkdtempSync(join(tmpdir(), 'orca-tel-'));
  const cli = join(dir, 'orca-fixture');
  const node = process.execPath.replace(/\\/g, '\\\\');
  writeFileSync(
    cli,
    `#!${node}
const map = ${JSON.stringify(handlers)};
const a = process.argv.slice(2);
const key = a.join(' ');
let result = map[key];
if (result === undefined && a[1] === 'worker-read') result = map['orchestration worker-read'];
if (result === undefined && a[1] === 'worker-list') result = map['orchestration worker-list'];
if (result === undefined && a[1] === 'worker-show') result = map['orchestration worker-show'];
if (result === undefined) { console.error('no fixture for ' + key); process.exit(1); }
console.log(JSON.stringify({ ok: true, result }));
`,
    { mode: 0o700 },
  );
  return { dir, cli };
}

test('parseProviderTokenJsonl actual event_msg + token_usage_record dedupe', () => {
  const parsed = parseProviderTokenJsonl(join(FIXTURES, 'provider-codex-actual.jsonl'), {
    threadId: 'thread_abc',
  });
  assert.equal(parsed.tokens.input, 160);
  assert.equal(parsed.tokens.cachedInput, 90);
  assert.equal(parsed.task_delta, null);
  assert.equal(parsed.session_range_delta.input, 40);
  assert.equal(parsed.session_range_delta.cachedInput, 10);
  assert.equal(parsed.session_range_delta.reasoning, 1);
  assert.equal(parsed.rawEventCount, 2);
  assert.equal(parsed.provenance.thread_id, 'thread_abc');
});

test('legacy provider-tokens.jsonl cumulative still works', () => {
  const parsed = parseProviderTokenJsonl(join(FIXTURES, 'provider-tokens.jsonl'));
  assert.equal(parsed.dedupeStrategy, 'cumulative_total');
  assert.equal(parsed.tokens.input, 500);
});

test('transcript flags stay unknown when API omits contentComplete', () => {
  const { dir, cli: orcaCli } = makeFakeOrca({
    'orchestration worker-read': {
      dispatchId: 'ctx_u',
      source: 'transcript',
      provider: 'codex',
      transcript: { messages: [] },
      cursor: null,
    },
  });
  const meta = readWorkerTranscriptMetadata('ctx_u', { env: { ORCA_CLI_COMMAND: orcaCli } });
  assert.equal(meta.contentComplete, null);
  assert.equal(meta.sourceExact, null);
  rmSync(dir, { recursive: true });
});

test('dedupeStructuralEvents collapses duplicate message ids', () => {
  const events = dedupeStructuralEvents([
    { kind: 'transcript.message', id: 'm1', timestamp: 1 },
    { kind: 'transcript.message', id: 'm1', timestamp: 1 },
  ]);
  assert.equal(events.length, 1);
});

test('async fake app-server handshake returns rate limits', async () => {
  const res = await invokeAppServer(['account/rateLimits/read'], {
    CODEX_CLI_COMMAND: process.execPath,
    CODEX_TELEMETRY_APP_SERVER_SCRIPT: FAKE_APP_SERVER,
  });
  const snap = whitelistAccountSnapshot(res['account/rateLimits/read']);
  assert.equal(snap.usedPercent, 7);
  assert.equal(snap.limitId, 'codex');
  assert.ok(snap.accountIdHash);
  assertNoForbiddenSnapshotKeys(snap);
});

test('collect idempotent per dispatch+source', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tel-idem-'));
  const ledger = join(tmp, 't.jsonl');
  const file = join(FIXTURES, 'provider-codex-actual.jsonl');
  const base = {
    root: tmp,
    telemetryLedger: ledger,
    roleId: 'tooling',
    threadId: 'th_1',
    providerFile: file,
  };
  collectTelemetry(base);
  collectTelemetry(base);
  const events = readTelemetryEvents(ledger).filter((e) => e.event === 'telemetry.collect');
  assert.equal(newestCollectByDispatch(events).length, 1);
  rmSync(tmp, { recursive: true });
});

test('provider-only collect without dispatch-id', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tel-prov-'));
  const ledger = join(tmp, 't.jsonl');
  const r = collectTelemetry({
    root: tmp,
    telemetryLedger: ledger,
    roleId: 'tooling',
    threadId: 'thread_only',
    providerFile: join(FIXTURES, 'provider-codex-actual.jsonl'),
  });
  assert.equal(r.event.dispatch_id, null);
  assert.equal(r.event.attrs.thread_id, 'thread_only');
  rmSync(tmp, { recursive: true });
});

test('snapshotsComparable rejects window mismatch', () => {
  const a = {
    accountIdHash: 'abc',
    limitId: 'codex',
    plan: 'prolite',
    windowDurationMins: 10080,
    resetsAt: 1,
    usedPercent: 2,
    timestamp: '2026-10-23T00:00:00.000Z',
  };
  const b = { ...a, resetsAt: 2, timestamp: '2026-10-23T01:00:00.000Z' };
  assert.equal(snapshotsComparable(a, b).compatible, false);
});

test('report uses newest collect and account deltas when comparable', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tel-rep-'));
  const ledger = join(tmp, 't.jsonl');
  const snap = {
    timestamp: '2026-10-23T00:00:00.000Z',
    plan: 'prolite',
    limitId: 'codex',
    usedPercent: 2,
    windowDurationMins: 10080,
    resetsAt: 99,
    accountIdHash: 'deadbeef',
    source: 'test',
  };
  appendTelemetryEvent(ledger, {
    v: TELEMETRY_SCHEMA_VERSION,
    ts: snap.timestamp,
    event: 'telemetry.account_snapshot',
    run_id: 'run_a',
    attrs: { snapshot: snap },
  });
  appendTelemetryEvent(ledger, {
    v: TELEMETRY_SCHEMA_VERSION,
    ts: '2026-10-23T01:00:00.000Z',
    event: 'telemetry.account_snapshot',
    run_id: 'run_a',
    attrs: {
      snapshot: { ...snap, timestamp: '2026-10-23T01:00:00.000Z', usedPercent: 5 },
    },
  });
  appendTelemetryEvent(ledger, {
    v: TELEMETRY_SCHEMA_VERSION,
    ts: '2026-10-23T02:00:00.000Z',
    event: 'telemetry.collect',
    run_id: 'run_a',
    dispatch_id: 'ctx_old',
    role_id: 'r',
    attrs: { collect_key: 'old' },
  });
  appendTelemetryEvent(ledger, {
    v: TELEMETRY_SCHEMA_VERSION,
    ts: '2026-10-23T03:00:00.000Z',
    event: 'telemetry.collect',
    run_id: 'run_a',
    dispatch_id: 'ctx_old',
    role_id: 'r',
    attrs: { collect_key: 'new' },
  });
  const report = buildTelemetryReport({ telemetryLedger: ledger, runId: 'run_a' });
  assert.equal(report.dispatches.length, 1);
  assert.equal(report.account.within_run_deltaUsedPercentPoints, 3);
  rmSync(tmp, { recursive: true });
});

test('telemetry CLI collect + snapshot + report integration', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'telemetry-cli-'));
  const telemetryLedger = join(tmp, 'telemetry.jsonl');
  const metricsLedger = join(tmp, 'metrics.jsonl');
  const { dir: orcaDir, cli: orcaCli } = makeFakeOrca({
    'orchestration worker-list': {
      workers: [
        {
          dispatchId: 'ctx_tel_1',
          terminalState: 'active',
          projection: { workspace: { id: `repo::${tmp}` } },
        },
      ],
    },
    'orchestration worker-read': {
      dispatchId: 'ctx_tel_1',
      source: 'terminal',
      fallbackReason: 'provider_unsupported',
      sourceExact: false,
      contentComplete: false,
      clipping: ['terminal_fallback'],
      terminal: { tail: ['line1'], returnedLineCount: 1, truncated: false },
      cursor: null,
      projection: { provider: { id: 'cursor' } },
    },
    'orchestration worker-show': {
      worker: {
        projection: { taskId: 'task_tel', runId: 'run_tel', provider: { id: 'cursor' } },
        startOptions: { launch: { effective: { model: 'composer-2.5' } } },
      },
    },
  });

  const rateFixture = join(tmp, 'rate.json');
  writeFileSync(
    rateFixture,
    JSON.stringify({
      results: {
        'account/rateLimits/read': JSON.parse(
          readFileSync(join(FIXTURES, 'rate-limits-response.json'), 'utf8'),
        ).result,
      },
    }),
  );

  const env = {
    ...process.env,
    ORCA_CLI_COMMAND: orcaCli,
    ORCA_TELEMETRY_LEDGER: telemetryLedger,
    CODEX_TELEMETRY_APP_SERVER_FIXTURE: rateFixture,
  };

  try {
    const collect = spawnSync(
      process.execPath,
      [
        TELEMETRY_CLI,
        'collect',
        '--dispatch-id',
        'ctx_tel_1',
        '--role-id',
        'coordinator-tooling',
        '--run-id',
        'run_tel',
        '--provider-file',
        join(FIXTURES, 'provider-codex-actual.jsonl'),
        '--thread-id',
        'th_cli',
        '--telemetry-ledger',
        telemetryLedger,
        '--metrics-ledger',
        metricsLedger,
      ],
      { encoding: 'utf8', env, cwd: fileURLToPath(new URL('../..', import.meta.url)) },
    );
    assert.equal(collect.status, 0, collect.stderr || collect.stdout);
    const collectEvents = readTelemetryEvents(telemetryLedger).filter((e) => e.event === 'telemetry.collect');
    assert.equal(collectEvents.length, 1);
    const expectedSha = resolveGitSha(repoRoot());
    if (expectedSha) {
      assert.equal(collectEvents[0].attrs.git_sha, expectedSha);
    }

    const snapOut = join(tmp, 'snap.json');
    const snap = spawnSync(
      process.execPath,
      [TELEMETRY_CLI, 'snapshot', '--out', snapOut, '--overwrite', '--telemetry-ledger', telemetryLedger],
      { encoding: 'utf8', env },
    );
    assert.equal(snap.status, 0, snap.stderr);
    assert.equal((statSync(snapOut).mode & 0o777), 0o600);

    const reportOut = join(tmp, 'report.json');
    const report = spawnSync(
      process.execPath,
      [TELEMETRY_CLI, 'report', '--run-id', 'run_tel', '--out', reportOut, '--overwrite', '--telemetry-ledger', telemetryLedger],
      { encoding: 'utf8', env },
    );
    assert.equal(report.status, 0, report.stderr);
    assert.equal((statSync(reportOut).mode & 0o777), 0o600);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(orcaDir, { recursive: true, force: true });
  }
});

test('ambiguous worktree blocks active-dispatch cursor join fallback', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ambig-'));
  const ledger = join(tmp, 'm.jsonl');
  const repoRootPath = fileURLToPath(new URL('../..', import.meta.url));
  const { dir: orcaDir, cli: orcaCli } = makeFakeOrca({
    'orchestration worker-list': {
      workers: [
        {
          dispatchId: 'ctx_a',
          terminalState: 'active',
          projection: { workspace: { id: `x::${repoRootPath}` } },
        },
        {
          dispatchId: 'ctx_b',
          terminalState: 'active',
          projection: { workspace: { id: `x::${repoRootPath}` } },
        },
      ],
    },
  });
  assert.equal(isWorktreeDispatchAmbiguous(repoRootPath, { ORCA_CLI_COMMAND: orcaCli }), true);

  const result = spawnSync(
    process.execPath,
    [CLI, 'ingest-cursor-turn', '--ledger', ledger],
    {
      input: JSON.stringify({
        hook_event_name: 'stop',
        conversation_id: 'conv_amb',
        generation_id: 'gen_amb',
        output_tokens: 3,
      }),
      encoding: 'utf8',
      env: { ...process.env, ORCA_CLI_COMMAND: orcaCli },
    },
  );
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).reason, 'join_missing');
  rmSync(tmp, { recursive: true });
  rmSync(orcaDir, { recursive: true });
});

test('cursor hook dedupe stop vs afterAgentResponse', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hooks-'));
  const ledger = join(tmp, 'm.jsonl');
  const joinRow = buildJoinEvent({
    conversation_id: 'c1',
    dispatch_id: 'ctx_h',
    role_id: 'backend',
  });
  appendEvent(ledger, joinRow);
  const hook = {
    hook_event_name: 'stop',
    conversation_id: 'c1',
    generation_id: 'g1',
    input_tokens: 10,
    output_tokens: 2,
  };
  appendEvent(ledger, buildCursorTurnEvent(hook, joinRow, { conversation_id: 'c1' }));
  const dup = appendEvent(
    ledger,
    buildCursorTurnEvent({ ...hook, hook_event_name: 'afterAgentResponse' }, joinRow, {
      conversation_id: 'c1',
    }),
  );
  assert.equal(dup.appended, false);
  rmSync(tmp, { recursive: true });
});

test('missing vs zero: null tokens stay null in provider parse', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nulltok-'));
  const f = join(dir, 'x.jsonl');
  writeFileSync(f, JSON.stringify({ type: 'event_msg', payload: { type: 'other' } }));
  const parsed = parseProviderTokenJsonl(f);
  assert.equal(parsed.tokens.input, null);
  assert.equal(parsed.completeness, 'missing');
  rmSync(dir, { recursive: true });
});

test('resolveGitSha null outside git root without stderr', () => {
  const badRoot = mkdtempSync(join(tmpdir(), 'nogit-'));
  const sha = resolveGitSha(badRoot);
  assert.equal(sha, null);
  rmSync(badRoot, { recursive: true });
});

test('TEL01 orchestration.message allowlist omits raw payload', () => {
  const events = extractStructuralTranscriptEvents({
    transcript: {
      messages: [
        {
          id: 'm1',
          from: {
            orchestration: {
              message: 'SECRET_RAW_TASK_BODY',
              dispatchId: 'ctx_x',
              taskId: 'task_x',
            },
          },
        },
        {
          id: 'm2',
          from: { orchestration: { message: 'task', dispatchId: 'ctx_y' } },
        },
      ],
    },
  });
  assert.ok(!JSON.stringify(events).includes('SECRET_RAW_TASK_BODY'));
  assert.equal(events[0].orchestration.messageOmitted, true);
  assert.equal(events[1].orchestration.message, 'task');
  assert.equal(sanitizeOrchestrationBlock({ message: 'worker_done' }).message, 'worker_done');
});

test('baseline boundary produces task_delta only with matching identity', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tel-base-'));
  const provider = join(FIXTURES, 'provider-codex-actual.jsonl');
  const baselinePath = join(tmp, 'baseline.json');
  snapshotProviderBaseline({
    providerFile: provider,
    threadId: 'thread_abc',
    out: baselinePath,
    overwrite: true,
  });
  const parsed = parseProviderTokenJsonl(provider, { threadId: 'thread_abc' });
  const meta = { basename: 'provider-codex-actual.jsonl', byteSize: fs.statSync(provider).size, mtimeMs: fs.statSync(provider).mtimeMs };
  const withDelta = applyProviderBaseline(parsed, baselinePath, 'thread_abc', meta, provider);
  assert.equal(withDelta.task_delta_source, 'baseline_boundary');
  assert.equal(withDelta.task_delta.input, 0);
  assert.throws(() => applyProviderBaseline(parsed, baselinePath, 'wrong_thread', meta));
  rmSync(tmp, { recursive: true });
});

test('snapshotsComparable rejects null window fields', () => {
  const a = {
    accountIdHash: 'x',
    limitId: 'codex',
    plan: 'prolite',
    windowDurationMins: null,
    resetsAt: 99,
    usedPercent: 1,
    timestamp: '2026-10-23T00:00:00.000Z',
  };
  const b = { ...a, timestamp: '2026-10-23T01:00:00.000Z', usedPercent: 2 };
  assert.equal(snapshotsComparable(a, b).compatible, false);
});

test('stress parse >2000 nested event_msg lines stable', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'stress-'));
  const file = join(tmp, 'big.jsonl');
  const lines = [];
  for (let i = 0; i < 2001; i++) {
    lines.push(
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              input_tokens: 100 + i,
              cached_input_tokens: i,
              output_tokens: 10,
              reasoning_output_tokens: 1,
            },
          },
        },
      }),
    );
  }
  writeFileSync(file, lines.join('\n'));
  const p1 = parseProviderTokenJsonl(file, { threadId: 'stress_th' });
  const p2 = parseProviderTokenJsonl(file, { threadId: 'stress_th' });
  assert.equal(p1.tokens.input, 2100);
  assert.equal(p1.rawEventCount, 2001);
  assert.equal(p2.rawEventCount, 2001);
  rmSync(tmp, { recursive: true });
});

test('thread_id mismatch in session_meta rejected', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tm-'));
  const file = join(tmp, 't.jsonl');
  writeFileSync(
    file,
    [
      JSON.stringify({ session_meta: { thread_id: 'th_a' }, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 1, output_tokens: 1 } } } }),
    ].join('\n'),
  );
  assert.throws(() => parseProviderTokenJsonl(file, { threadId: 'th_b' }));
  rmSync(tmp, { recursive: true });
});

test('extractStructuralTranscriptEvents strips text bodies', () => {
  const events = extractStructuralTranscriptEvents({
    transcript: {
      messages: [
        {
          id: 'm1',
          timestamp: 1,
          role: 'user',
          blocks: [{ type: 'text', text: 'SECRET_PROMPT' }],
        },
      ],
    },
  });
  assert.ok(!JSON.stringify(events).includes('SECRET_PROMPT'));
});

test('provider boundary accepts real appends and rejects changed prefix or thread', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tel-append-'));
  try {
    const file = join(tmp, 'rollout.jsonl'), base = join(tmp, 'base.json');
    const event = input => JSON.stringify({type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{input_tokens:input,cached_input_tokens:input/2,output_tokens:20,reasoning_output_tokens:5}}}})+'\n';
    const initial = JSON.stringify({type:'session_meta',payload:{id:'thread-real'}})+'\n'+event(100);
    writeFileSync(file, initial);
    snapshotProviderBaseline({providerFile:file,threadId:'thread-real',out:base});
    fs.appendFileSync(file,event(160));
    const meta = {basename:'rollout.jsonl',byteSize:statSync(file).size,mtimeMs:statSync(file).mtimeMs};
    const parsed = parseProviderTokenJsonl(file,{threadId:'thread-real'});
    assert.equal(applyProviderBaseline(parsed,base,'thread-real',meta,file).task_delta.input,60);
    assert.throws(()=>parseProviderTokenJsonl(file,{threadId:'wrong'}),/thread_id/);
    writeFileSync(file, initial.replace('100','101')+event(160));
    assert.throws(()=>applyProviderBaseline(parsed,base,'thread-real',meta,file),/boundary/);
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
test('workload comparison identity excludes session-specific file and thread', () => {
  const common={comparison_key:'same-ac-and-input',model:'m',provider:'codex',tokens_provider:{task_delta_source:'baseline_boundary',baseline:{file_identity:'file1'}}};
  assert.equal(buildWorkloadFingerprint({...common,thread_id:'thread1'}),buildWorkloadFingerprint({...common,thread_id:'thread2',tokens_provider:{...common.tokens_provider,baseline:{file_identity:'file2'}}}));
  assert.notEqual(buildWorkloadFingerprint(common),buildWorkloadFingerprint({...common,comparison_key:'different-input'}));
});

test('account usage retains documented summaries and drops arbitrary payload', () => {
  const safe=whitelistAccountUsage({summary:{lifetimeTokens:100,peakDailyTokens:null,prompt:'secret'},dailyUsageBuckets:[{startDate:'2026-10-23',tokens:10,email:'secret'}],auth:'secret'});
  assert.equal(safe.summary.lifetimeTokens,100); assert.equal(safe.summary.peakDailyTokens,null);
  assert.deepEqual(safe.dailyUsageBuckets,[{startDate:'2026-10-23',tokens:10}]);
  assert.ok(!JSON.stringify(safe).includes('secret'));
});

test('active-dispatch fallback requires exactly one matching live dispatch', () => {
  const wt=tmpdir();
  for (const [ids,expected] of [[[],true],[['ctx-other'],true],[['ctx-target'],false]]) {
    const fake=makeFakeOrca({'orchestration worker-list':{workers:ids.map(dispatchId=>({dispatchId,terminalState:'active',projection:{workspace:{id:wt}}}))}});
    try {assert.equal(isWorktreeDispatchAmbiguous(wt,{...process.env,ORCA_CLI_COMMAND:fake.cli},'ctx-target'),expected);}finally{rmSync(fake.dir,{recursive:true,force:true});}
  }
});

test('worktree match uses exact resolved path not prefix (uuid::path)', () => {
  const base = join(tmpdir(), 'wt');
  const proj = join(base, 'proj');
  const proj2 = join(base, 'proj-2');
  const ws = (p) => `00000000-0000-4000-8000-000000000001::${p}`;
  const fake = makeFakeOrca({
    'orchestration worker-list': {
      workers: [
        { dispatchId: 'ctx1', terminalState: 'active', projection: { workspace: { id: ws(proj) } } },
        { dispatchId: 'ctx2', terminalState: 'active', projection: { workspace: { id: ws(proj2) } } },
      ],
    },
  });
  try {
    assert.equal(isWorktreeDispatchAmbiguous(proj, { ...process.env, ORCA_CLI_COMMAND: fake.cli }, 'ctx1'), false);
    const dup = makeFakeOrca({
      'orchestration worker-list': {
        workers: [
          { dispatchId: 'ctx-a', terminalState: 'active', projection: { workspace: { id: ws(proj) } } },
          { dispatchId: 'ctx-b', terminalState: 'active', projection: { workspace: { id: proj } } },
        ],
      },
    });
    try {
      assert.equal(isWorktreeDispatchAmbiguous(proj, { ...process.env, ORCA_CLI_COMMAND: dup.cli }, 'ctx-a'), true);
    } finally {
      rmSync(dup.dir, { recursive: true, force: true });
    }
  } finally {
    rmSync(fake.dir, { recursive: true, force: true });
  }
});
