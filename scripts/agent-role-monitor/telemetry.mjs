#!/usr/bin/env node
/**
 * Telemetry root CLI — transcript metadata, provider JSONL tokens, account snapshots, reports.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultTelemetryLedgerPath, writeSecureFile } from './lib/telemetry-ledger.mjs';
import {
  collectTelemetry,
  buildTelemetryReport,
  snapshotAccountRateLimits,
  snapshotProviderBaseline,
} from './lib/usage.mjs';
import { repoRoot } from './lib/ledger.mjs';
import { formatTelemetryError, TelemetryError } from './lib/errors.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `Usage:
  node scripts/agent-role-monitor/telemetry.mjs <command> [options]

Commands:
  collect --role-id ID [--dispatch-id ID] [--run-id ID] [--thread-id ID] [--provider-file PATH]
      [--baseline-file PATH] [--comparison-key ID] [--telemetry-ledger PATH]

  snapshot-provider --provider-file PATH --thread-id ID --out PATH [--overwrite]

  snapshot --out PATH [--overwrite] [--run-id ID] [--dispatch-id ID] [--role-id ID]

  report [--run-id ID] [--baseline-run-id ID] [--comparison-key ID] [--out PATH] [--overwrite]

Env: ORCA_CLI_COMMAND, ORCA_TELEMETRY_LEDGER, CODEX_CLI_COMMAND, CODEX_TELEMETRY_APP_SERVER_FIXTURE
`;

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

function printJson(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function resolveTelemetryLedger(flags) {
  if (flags['telemetry-ledger']) return path.resolve(flags['telemetry-ledger']);
  if (process.env.ORCA_TELEMETRY_LEDGER) return path.resolve(process.env.ORCA_TELEMETRY_LEDGER);
  return defaultTelemetryLedgerPath();
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  const flags = parseFlags(argv.slice(1));
  const root = repoRoot();
  const telemetryLedger = resolveTelemetryLedger(flags);

  switch (cmd) {
    case 'collect': {
      if (!flags['role-id']) throw new TelemetryError('missing_role', '--role-id is required');
      if (flags['baseline-file'] && (!flags['provider-file'] || !flags['thread-id'])) {
        throw new TelemetryError(
          'baseline_requires_provider',
          '--baseline-file requires --provider-file and --thread-id',
        );
      }
      const result = collectTelemetry({
        root,
        telemetryLedger,
        metricsLedger: flags['metrics-ledger']
          ? path.resolve(flags['metrics-ledger'])
          : undefined,
        dispatchId: flags['dispatch-id'] || null,
        roleId: flags['role-id'],
        runId: flags['run-id'] || null,
        threadId: flags['thread-id'] || null,
        providerFile: flags['provider-file'] || null,
        baselineFile: flags['baseline-file'] || null,
        comparisonKey: flags['comparison-key'] || null,
      });
      printJson({
        ok: true,
        ledger: result.ledger,
        idempotent_replaced: result.idempotent,
        join_ambiguous: result.joinAmbiguous,
        transcript: result.event.attrs.transcript
          ? {
              sourceExact: result.event.attrs.transcript.sourceExact,
              contentComplete: result.event.attrs.transcript.contentComplete,
              clipping: result.event.attrs.transcript.clipping,
            }
          : null,
        dispatch_id: result.event.dispatch_id,
        run_id: result.event.run_id,
        thread_id: result.event.attrs.thread_id,
        workload_fingerprint: result.event.attrs.workload_fingerprint,
        tokens_task_delta: result.event.attrs.tokens_provider?.task_delta ?? null,
        tokens_session_range_delta: result.event.attrs.tokens_provider?.session_range_delta ?? null,
      });
      break;
    }
    case 'snapshot-provider': {
      if (!flags['provider-file'] || !flags['thread-id'] || !flags.out) {
        throw new TelemetryError(
          'snapshot_provider_args',
          '--provider-file, --thread-id, --out required',
        );
      }
      const result = snapshotProviderBaseline({
        providerFile: flags['provider-file'],
        threadId: flags['thread-id'],
        out: flags.out,
        overwrite: Boolean(flags.overwrite),
      });
      printJson({ ok: true, out: result.out, session_latest: result.session_latest });
      break;
    }
    case 'snapshot': {
      if (!flags.out) throw new TelemetryError('missing_out', '--out is required');
      const result = await snapshotAccountRateLimits({
        root,
        telemetryLedger,
        out: flags.out,
        overwrite: Boolean(flags.overwrite),
        runId: flags['run-id'] || null,
        dispatchId: flags['dispatch-id'] || null,
        roleId: flags['role-id'] || null,
      });
      printJson({ ok: true, out: result.outPath, snapshot: result.snapshot });
      break;
    }
    case 'report': {
      const report = buildTelemetryReport({
        root,
        telemetryLedger,
        runId: flags['run-id'] || null,
        baselineRunId: flags['baseline-run-id'] || null,
        comparisonKey: flags['comparison-key'] || null,
      });
      const text = `${JSON.stringify(report, null, 2)}\n`;
      if (flags.out) {
        writeSecureFile(path.resolve(flags.out), text, {
          mode: 0o600,
          overwrite: Boolean(flags.overwrite),
        });
      }
      process.stdout.write(text);
      break;
    }
    default:
      throw new TelemetryError('unknown_command', `Unknown command: ${cmd}`);
  }
}

main().catch((err) => {
  process.stderr.write(`${formatTelemetryError(err)}\n`);
  process.exit(1);
});
