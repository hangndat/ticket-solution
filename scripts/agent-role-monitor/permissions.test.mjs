import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { appendEvent, normalizeSettlementInput } from './lib/ledger.mjs';

const mode = file => fs.statSync(file).mode & 0o777;

test('ledger creates 0600 and repairs existing 0644 even for duplicate events', () => {
  const dir = fs.mkdtempSync(join(tmpdir(), 'ledger-perms-'));
  try {
    const ledger = join(dir, 'role-dispatch.jsonl');
    const event = normalizeSettlementInput({ dispatchId:'ctx_permissions', roleId:'tooling', outcome:'succeeded' });
    appendEvent(ledger, event);
    assert.equal(mode(ledger), 0o600);
    const before = fs.readFileSync(ledger);
    fs.chmodSync(ledger, 0o644);
    assert.equal(appendEvent(ledger, event).appended, false);
    assert.equal(mode(ledger), 0o600);
    assert.deepEqual(fs.readFileSync(ledger), before);
  } finally { fs.rmSync(dir, { recursive:true, force:true }); }
});

test('both Cursor hooks create private logs and repair 0644 logs without truncation', () => {
  for (const name of ['agent-metrics-cursor-turn.sh', 'agent-metrics-auto-join.sh']) {
    const dir = fs.mkdtempSync(join(tmpdir(), 'hook-perms-'));
    try {
      const hooks = join(dir, '.cursor/hooks'), scripts = join(dir, 'scripts/agent-role-monitor');
      fs.mkdirSync(hooks, { recursive:true }); fs.mkdirSync(scripts, { recursive:true });
      fs.mkdirSync(join(dir, '.orca-metrics'));
      fs.copyFileSync(fileURLToPath(new URL(`../../.cursor/hooks/${name}`, import.meta.url)), join(hooks, name));
      const fake = 'console.log(JSON.stringify({appended:true}));';
      fs.writeFileSync(join(scripts, 'cli.mjs'), fake);
      fs.writeFileSync(join(scripts, 'auto-join-from-hook.mjs'), fake);
      fs.writeFileSync(join(dir, '.orca-metrics/active-dispatch.json'), '{}');
      const log = join(dir, '.orca-metrics/cursor-hooks.log');
      for (const existing of [false, true]) {
        if (existing) { fs.writeFileSync(log, 'existing-log\n'); fs.chmodSync(log, 0o644); }
        const result = spawnSync('bash', [join(hooks, name)], { input:'{}', encoding:'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(result.stdout), {});
        assert.equal(mode(log), 0o600);
        if (existing) assert.ok(fs.readFileSync(log, 'utf8').startsWith('existing-log\n'));
      }
    } finally { fs.rmSync(dir, { recursive:true, force:true }); }
  }
});
