#!/usr/bin/env node
/**
 * Agent Role Monitor — local JSONL CLI (MVP).
 *
 * Commands:
 *   ingest-settlement     Append dispatch.settled (stdin or --file); idempotent
 *   record-opened         Append dispatch.opened (role_id required)
 *   record-join           Append join.conversation (conversation↔dispatch)
 *   ingest-cursor-turn    Append cursor.turn from Cursor hook JSON (stdin)
 *   rollup                Aggregate by_role (stdout / --out)
 *   host-sample           Optional ps sample → host.sample event
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  appendEvent,
  buildCursorTurnEvent,
  buildHeartbeatEvent,
  buildHostSampleEvent,
  buildJoinEvent,
  buildOpenedEvent,
  defaultLedgerPath,
  normalizeSettlementInput,
  readEvents,
  resolveJoinForHook,
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

  record-join --conversation-id ID --dispatch-id ID --role-id ID
      [--task-id ID] [--run-id ID] [--ledger PATH]
      Append join.conversation (idempotent on conversation_id+dispatch_id).

  ingest-cursor-turn [--file PATH] [--ledger PATH]
      Read Cursor stop|afterAgentResponse JSON from stdin/--file.
      Looks up join by conversation_id (or attrs.dispatch_id); appends
      cursor.turn with token_source=hooks. Idempotent on generation_id.
      Missing join → skip (exit 0) + stderr; no text/prompt fields stored.

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
    case 'record-join':
      cmdRecordJoin(flags, ledger);
      break;
    case 'ingest-cursor-turn':
      await cmdIngestCursorTurn(flags, ledger);
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

function cmdRecordJoin(flags, ledger) {
  const event = buildJoinEvent({
    conversation_id: flags['conversation-id'],
    dispatch_id: flags['dispatch-id'],
    role_id: flags['role-id'],
    task_id: flags['task-id'],
    run_id: flags['run-id'],
    agent: flags.agent,
    issue: flags.issue,
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

async function cmdIngestCursorTurn(flags, ledger) {
  let raw;
  if (flags.file) {
    raw = fs.readFileSync(path.resolve(flags.file), 'utf8');
  } else {
    raw = await readStdin();
  }
  if (!raw.trim()) {
    throw new Error('ingest-cursor-turn: empty input (pass JSON on stdin or --file)');
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON: ${err.message}`);
  }

  const hookEvent = input.hook_event_name || input.hookEventName || '';
  if (hookEvent && hookEvent !== 'stop' && hookEvent !== 'afterAgentResponse') {
    printJson({
      ok: true,
      ledger,
      appended: false,
      reason: 'ignored_hook_event',
      hook_event_name: hookEvent,
    });
    return;
  }

  const events = readEvents(ledger);
  const resolved = resolveJoinForHook(events, input);
  if (!resolved) {
    const conversationId = input.conversation_id || input.conversationId || null;
    const msg = `ingest-cursor-turn: join missing for conversation_id=${conversationId ?? 'null'} — skip (no cursor.turn)`;
    console.error(msg);
    printJson({
      ok: true,
      ledger,
      appended: false,
      reason: 'join_missing',
      conversation_id: conversationId,
    });
    return;
  }

  const event = buildCursorTurnEvent(input, resolved.join, {
    conversation_id: resolved.conversation_id,
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
