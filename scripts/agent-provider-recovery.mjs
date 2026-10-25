#!/usr/bin/env node
/** CLI: status | check | record-limit | route — provider recovery preflight for coordinators. */
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  checkProvider,
  getProviderStatus,
  recordProviderLimit,
  recommendRoute,
  runClaudeAuth,
} from './lib/agent-provider-recovery.mjs';
import { recoveryRoot, hashIdentity } from './lib/agent-provider-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parse(argv) {
  const command = argv.shift();
  const flags = {};
  const keys = new Set([
    'provider',
    'model',
    'effort',
    'cost-tier',
    'limited-at',
    'reset-at',
    'reason',
    'root',
    'codex-snapshot',
    'essential',
  ]);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') {
      flags.force = true;
      continue;
    }
    if (!argv[i].startsWith('--')) throw new Error('invalid_arguments');
    const key = argv[i].slice(2);
    if (!keys.has(key)) throw new Error('invalid_arguments');
    if (flags[key] !== undefined) throw new Error('invalid_arguments');
    const val = argv[++i];
    if (!val || val.startsWith('--')) throw new Error('invalid_arguments');
    flags[key] = val;
  }
  return { command, flags };
}

function loadCodexSnapshot(path) {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch {
    return null;
  }
}

function snapshotCodex(outPath) {
  const telemetry = process.env.AGENT_TELEMETRY_CLI || join(ROOT, 'scripts/agent-role-monitor/telemetry.mjs');
  const r = spawnSync(process.execPath, [telemetry, 'snapshot', '--out', outPath], {
    encoding: 'utf8',
    timeout: 90000,
    maxBuffer: 8e6,
  });
  if (r.status !== 0) return null;
  return loadCodexSnapshot(outPath);
}

export function main(argv = process.argv.slice(2)) {
  if (!argv.length || argv.includes('--help')) {
    console.log(
      'agent-provider-recovery status|check|record-limit|route\n' +
        '  status --provider claude|codex --model PIN [--effort LEVEL] [--root DIR] [--codex-snapshot PATH]\n' +
        '  check --provider claude|codex --model PIN [--effort LEVEL] [--force] [--codex-snapshot PATH] [--essential true]\n' +
        '  record-limit --provider claude|codex --model PIN --limited-at ISO [--reset-at ISO] [--effort LEVEL] [--reason TEXT]\n' +
        '  route --cost-tier focused|advanced|high [--force] [--codex-snapshot PATH] [--essential true]',
    );
    return;
  }
  const { command, flags: f } = parse([...argv]);
  const root = f.root ? resolve(f.root) : recoveryRoot();
  const essential = f.essential === 'true' || f.essential === '1';

  if (command === 'record-limit') {
    if (!f.provider || !f.model || !f['limited-at']) throw new Error('record_limit_fields_required');
    const { record } = recordProviderLimit(
      {
        provider: f.provider,
        model: f.model,
        effort: f.effort || null,
        limitedAt: f['limited-at'],
        resetAt: f['reset-at'] || null,
        reason: f.reason || 'manual_limit',
      },
      { root },
    );
    console.log(JSON.stringify({ ok: true, command, record }));
    return;
  }

  if (command === 'route') {
    if (!f['cost-tier']) throw new Error('cost_tier_required');
    let snapshot = loadCodexSnapshot(f['codex-snapshot']);
    if (!snapshot) {
      const tmp = join(root, '..', `codex-snapshot-${Date.now()}.json`);
      snapshot = snapshotCodex(tmp);
    }
    const result = recommendRoute(
      { costTier: f['cost-tier'], essential, codexSnapshot: snapshot, force: !!f.force },
      { root },
    );
    console.log(JSON.stringify({ ok: true, command, ...result }));
    return;
  }

  if (!f.provider || !f.model) throw new Error('provider_model_required');

  if (command === 'check') {
    const snapshot = f.provider === 'codex' ? loadCodexSnapshot(f['codex-snapshot']) : null;
    const result = checkProvider(
      {
        provider: f.provider,
        model: f.model,
        effort: f.effort || null,
        force: !!f.force,
        essential,
        codexSnapshot: snapshot,
      },
      { root },
    );
    console.log(JSON.stringify({ ok: true, command, ...result }));
    if (f.provider === 'claude' && !result.serviceAvailable && result.reason !== 'cooldown_cached') {
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'status') {
    let identityHash = null;
    if (f.provider === 'claude') {
      const auth = runClaudeAuth({});
      if (!auth.ok) {
        console.log(JSON.stringify({ ok: false, command, errorCode: auth.reason }));
        process.exitCode = 1;
        return;
      }
      identityHash = auth.identityHash;
    } else if (f.provider === 'codex') {
      const snapshot = loadCodexSnapshot(f['codex-snapshot']);
      if (!snapshot?.accountIdHash) {
        console.log(JSON.stringify({ ok: true, command, record: null, reason: 'codex_snapshot_required' }));
        return;
      }
      identityHash = hashIdentity({ provider: 'codex', accountIdHash: snapshot.accountIdHash });
    }
    const status = getProviderStatus(
      { provider: f.provider, model: f.model, effort: f.effort || null, identityHash },
      { root },
    );
    console.log(JSON.stringify({ ok: true, command, ...status }));
    return;
  }

  throw new Error('unknown_command');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (e) {
    console.error(JSON.stringify({ ok: false, errorCode: e.message }));
    process.exitCode = 1;
  }
}
