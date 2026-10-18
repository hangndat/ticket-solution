import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  appendEvent,
  normalizeSettlementInput,
  readEvents,
  rollupByRole,
} from './lib/ledger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, 'cli.mjs');

describe('agent-role-monitor ledger', () => {
  /** @type {string} */
  let tmpDir;
  /** @type {string} */
  let ledger;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-smoke-'));
    ledger = path.join(tmpDir, 'role-dispatch.jsonl');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ingests two settled rows with one duplicate; rollup successRate = 1', () => {
    const base = {
      dispatchId: 'ctx_smoke_001',
      taskId: 'task_smoke_001',
      runId: 'run_smoke_001',
      roleId: 'backend',
      outcome: 'succeeded',
      subject: 'smoke ok',
      agent: 'cursor',
    };

    const first = appendEvent(ledger, normalizeSettlementInput(base));
    assert.equal(first.appended, true);

    const dup = appendEvent(ledger, normalizeSettlementInput(base));
    assert.equal(dup.appended, false);
    assert.equal(dup.reason, 'duplicate_dispatch_event');

    const second = appendEvent(
      ledger,
      normalizeSettlementInput({
        ...base,
        dispatchId: 'ctx_smoke_002',
        taskId: 'task_smoke_002',
        outcome: 'succeeded',
      }),
    );
    assert.equal(second.appended, true);

    const events = readEvents(ledger);
    assert.equal(events.length, 2);
    assert.equal(events.filter((e) => e.event === 'dispatch.settled').length, 2);

    const summary = rollupByRole(events);
    const backend = summary.by_role.find((r) => r.role_id === 'backend');
    assert.ok(backend);
    assert.equal(backend.settled_count, 2);
    assert.equal(backend.succeeded_count, 2);
    assert.equal(backend.success_rate, 1);
    assert.equal(backend.dispatch_count, 2);
  });

  it('CLI ingest-settlement + rollup end-to-end', () => {
    const ledger2 = path.join(tmpDir, 'cli-ledger.jsonl');
    const payload = {
      dispatch_id: 'ctx_cli_1',
      task_id: 'task_cli_1',
      run_id: 'run_cli_1',
      role_id: 'web',
      outcome: 'succeeded',
      subject: 'cli smoke',
    };
    const ingest = spawnSync(process.execPath, [CLI, 'ingest-settlement', '--ledger', ledger2], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
    });
    assert.equal(ingest.status, 0, ingest.stderr || ingest.stdout);
    const body = JSON.parse(ingest.stdout);
    assert.equal(body.appended, true);

    const ingestDup = spawnSync(
      process.execPath,
      [CLI, 'ingest-settlement', '--ledger', ledger2],
      { input: JSON.stringify(payload), encoding: 'utf8' },
    );
    assert.equal(ingestDup.status, 0);
    assert.equal(JSON.parse(ingestDup.stdout).appended, false);

    const opened = spawnSync(
      process.execPath,
      [
        CLI,
        'record-opened',
        '--ledger',
        ledger2,
        '--dispatch-id',
        'ctx_cli_2',
        '--role-id',
        'web',
        '--task-id',
        'task_cli_2',
        '--run-id',
        'run_cli_1',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(opened.status, 0, opened.stderr);

    const settled2 = spawnSync(
      process.execPath,
      [CLI, 'ingest-settlement', '--ledger', ledger2],
      {
        input: JSON.stringify({
          dispatchId: 'ctx_cli_2',
          taskId: 'task_cli_2',
          runId: 'run_cli_1',
          roleId: 'web',
          outcome: 'failed',
        }),
        encoding: 'utf8',
      },
    );
    assert.equal(settled2.status, 0);

    const outFile = path.join(tmpDir, 'by_role.json');
    const rollup = spawnSync(
      process.execPath,
      [CLI, 'rollup', '--ledger', ledger2, '--out', outFile],
      { encoding: 'utf8' },
    );
    assert.equal(rollup.status, 0, rollup.stderr);
    const summary = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const web = summary.by_role.find((r) => r.role_id === 'web');
    assert.ok(web);
    assert.equal(web.settled_count, 2);
    assert.equal(web.succeeded_count, 1);
    assert.equal(web.success_rate, 0.5);
  });
});
