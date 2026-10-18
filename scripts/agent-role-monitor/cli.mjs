#!/usr/bin/env node
/**
 * Agent Role Monitor — local JSONL CLI (MVP).
 *
 * Commands:
 *   ingest-settlement  Append dispatch.settled (stdin or --file); idempotent
 *   record-opened      Append dispatch.opened (role_id required)
 *   rollup             Aggregate by_role (stdout / --out)
 *   host-sample        Optional ps sample → host.sample event
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  appendEvent,
  buildHeartbeatEvent,
  buildHostSampleEvent,
  buildOpenedEvent,
  defaultLedgerPath,
  normalizeSettlementInput,
  readEvents,
  rollupByRole,
} from './lib/ledger.mjs';
import { samplePid } from './lib/host-sample.mjs';

const USAGE = `Usage:
  node scripts/agent-role-monitor/cli.mjs <command> [options]

Commands:
  ingest-settlement [--file PATH] [--ledger PATH] [--role-id ID]
      Read worker_done-ish JSON from stdin or --file; append dispatch.settled.
      roleId may be in JSON or via --role-id.

  record-opened --dispatch-id ID --role-id ID [--task-id ID] [--run-id ID]
      [--agent cursor] [--issue N] [--worktree PATH] [--ledger PATH]

  rollup [--ledger PATH] [--out PATH]
      Print by_role summary JSON; optional write --out.

  host-sample --pid N --dispatch-id ID [--role-id ID] [--task-id ID]
      [--run-id ID] [--ledger PATH]
      Sample RSS/CPU via ps and append host.sample.

  heartbeat --dispatch-id ID --phase PHASE [--role-id ID] [--ledger PATH]
      Optional dispatch.heartbeat append (not idempotent).

Env:
  ORCA_METRICS_LEDGER  Override default ledger path
                       (default: <repo>/.orca-metrics/role-dispatch.jsonl)
`;

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  const flags = parseFlags(argv.slice(1));
  const ledger = resolveLedger(flags);

  switch (cmd) {
    case 'ingest-settlement':
      await cmdIngestSettlement(flags, ledger);
      break;
    case 'record-opened':
      cmdRecordOpened(flags, ledger);
      break;
    case 'rollup':
      cmdRollup(flags, ledger);
      break;
    case 'host-sample':
      cmdHostSample(flags, ledger);
      break;
    case 'heartbeat':
      cmdHeartbeat(flags, ledger);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function cmdIngestSettlement(flags, ledger) {
  let raw;
  if (flags.file) {
    raw = fs.readFileSync(path.resolve(flags.file), 'utf8');
  } else {
    raw = await readStdin();
  }
  if (!raw.trim()) {
    throw new Error('ingest-settlement: empty input (pass JSON on stdin or --file)');
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON: ${err.message}`);
  }
  if (flags['role-id'] && !input.roleId && !input.role_id) {
    input.roleId = flags['role-id'];
  }
  const event = normalizeSettlementInput(input);
  const result = appendEvent(ledger, event);
  printJson({
    ok: true,
    ledger,
    appended: result.appended,
    reason: result.reason ?? null,
    event: result.event,
  });
  process.exit(0);
}

function cmdRecordOpened(flags, ledger) {
  const event = buildOpenedEvent({
    dispatch_id: flags['dispatch-id'],
    role_id: flags['role-id'],
    task_id: flags['task-id'],
    run_id: flags['run-id'],
    agent: flags.agent,
    issue: flags.issue,
    worktree: flags.worktree,
    architecture_impact: flags['architecture-impact'],
    spec_hash: flags['spec-hash'],
  });
  const result = appendEvent(ledger, event);
  printJson({
    ok: true,
    ledger,
    appended: result.appended,
    reason: result.reason ?? null,
    event: result.event,
  });
}

function cmdRollup(flags, ledger) {
  const events = readEvents(ledger);
  const summary = rollupByRole(events);
  const text = `${JSON.stringify(summary, null, 2)}\n`;
  if (flags.out) {
    const outPath = path.resolve(flags.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text, 'utf8');
  }
  process.stdout.write(text);
}

function cmdHostSample(flags, ledger) {
  if (!flags.pid) throw new Error('--pid is required');
  if (!flags['dispatch-id']) throw new Error('--dispatch-id is required');
  const sample = samplePid(flags.pid);
  const event = buildHostSampleEvent({
    dispatch_id: flags['dispatch-id'],
    role_id: flags['role-id'],
    task_id: flags['task-id'],
    run_id: flags['run-id'],
    agent: flags.agent,
    pid: sample.pid,
    cpu_pct: sample.cpu_pct,
    rss_mb: sample.rss_mb,
  });
  const result = appendEvent(ledger, event);
  printJson({
    ok: true,
    ledger,
    appended: result.appended,
    sample,
    event: result.event,
  });
}

function cmdHeartbeat(flags, ledger) {
  if (!flags['dispatch-id']) throw new Error('--dispatch-id is required');
  const event = buildHeartbeatEvent({
    dispatch_id: flags['dispatch-id'],
    role_id: flags['role-id'],
    task_id: flags['task-id'],
    run_id: flags['run-id'],
    phase: flags.phase || 'unknown',
    agent: flags.agent,
  });
  const result = appendEvent(ledger, event);
  printJson({
    ok: true,
    ledger,
    appended: result.appended,
    event: result.event,
  });
}

function resolveLedger(flags) {
  if (flags.ledger) return path.resolve(flags.ledger);
  if (process.env.ORCA_METRICS_LEDGER) return path.resolve(process.env.ORCA_METRICS_LEDGER);
  return defaultLedgerPath();
}

function parseFlags(args) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next != null && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

function printJson(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
