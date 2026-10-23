#!/usr/bin/env node
/**
 * Minimal fake codex app-server for telemetry handshake tests (stdio NDJSON).
 */
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  if (msg.method === 'initialize' && msg.id != null) {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { clientInfo: { name: 'fake' } },
      })}\n`,
    );
    return;
  }
  if (msg.method === 'account/rateLimits/read' && msg.id != null) {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          accountId: 'secret-acct',
          rateLimits: {
            limitId: 'codex',
            planType: 'prolite',
            primary: { usedPercent: 7, windowDurationMins: 10080, resetsAt: 1793336928 },
          },
        },
      })}\n`,
    );
  }
});
