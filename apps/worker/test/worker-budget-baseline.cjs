/** Reproduce the sequential F03 baseline from the pre-change relay source. */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const repo = path.resolve(__dirname, '../../..');
const sourceSha = 'fb2da38e';
const source = execFileSync(
  'git',
  ['show', `${sourceSha}:apps/worker/src/worker-relay.ts`],
  { cwd: repo, encoding: 'utf8' },
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const filename = path.resolve(__dirname, '../dist/worker-relay-baseline.js');
const historical = new Module(filename, module);
historical.filename = filename;
historical.paths = Module._nodeModulePaths(path.dirname(filename));
historical._compile(js, filename);

const { WorkerRelay, DEFAULT_TICK_STEP_TIMEOUT_MS } = historical.exports;
const relay = new WorkerRelay(
  { $queryRaw: async () => [], $disconnect: async () => {} },
  {
    sendTicketIssued: async () => ({
      providerRef: 'fixture',
      providerStatus: 'ACCEPTED',
    }),
  },
  undefined,
  'baseline-fixture',
  false,
  0,
  'test-key-material-12345',
  {
    NODE_ENV: 'test',
    WORKER_TEST_HANG_TICK_STEP: 'relay_exports',
    MINIO_ENDPOINT: 'http://127.0.0.1:9000',
    MINIO_ACCESS_KEY: 'fixture',
    MINIO_SECRET_KEY: 'fixture',
  },
  { tickStepTimeoutMs: 100, shutdownTickTimeoutMs: 10 },
);

(async () => {
  const started = performance.now();
  await relay.runPollCycle();
  const firstCycleMs = Math.round(performance.now() - started);
  assert.equal(DEFAULT_TICK_STEP_TIMEOUT_MS, 120_000);
  assert.ok(
    firstCycleMs >= 95,
    `sequential cycle unexpectedly short: ${firstCycleMs}ms`,
  );
  console.info(
    JSON.stringify({
      event: 'worker_budget_baseline',
      sourceSha,
      scaledStepTimeoutMs: 100,
      firstCycleMs,
      defaultStepTimeoutMs: DEFAULT_TICK_STEP_TIMEOUT_MS,
      environment: 'local_synthetic_historical_relay_current_backend',
    }),
  );
  await relay.onModuleDestroy();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
