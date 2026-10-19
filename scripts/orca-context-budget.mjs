#!/usr/bin/env node
/**
 * Estimate fixed agent context from rules (bytes + ~tokens).
 * Usage: node scripts/orca-context-budget.mjs [--json] [--user-rules]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const USER_RULES = path.join(process.env.HOME || '', '.cursor/rules');

function tok(bytes) {
  return Math.round(bytes / 3.5);
}

function scanMdc(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdc'))
    .map((f) => {
      const p = path.join(dir, f);
      const head = fs.readFileSync(p, 'utf8').slice(0, 900);
      const m = head.match(/alwaysApply:\s*(true|false)/);
      return { path: p, name: f, bytes: fs.statSync(p).size, always: m ? m[1] : '?' };
    });
}

function sum(list) {
  return list.reduce((s, x) => s + x.bytes, 0);
}

const jsonOut = process.argv.includes('--json');
const includeUser = process.argv.includes('--user-rules') || jsonOut;

const repoRules = scanMdc(path.join(REPO_ROOT, '.cursor/rules'));
const alwaysRepo = repoRules.filter((r) => r.always === 'true');
const requestableRepo = repoRules.filter((r) => r.always === 'false');

const extra = ['.cursorrules', 'AGENTS.md'].map((f) => {
  const p = path.join(REPO_ROOT, f);
  return { path: p, name: f, bytes: fs.existsSync(p) ? fs.statSync(p).size : 0, always: 'n/a' };
});

const userRules = includeUser ? scanMdc(USER_RULES) : [];
const userAlways = userRules.filter((r) => r.always === 'true');
const userGlobsOnly = userRules.filter((r) => r.always === 'false');

const workerFixed =
  sum(alwaysRepo) + sum(extra) + (includeUser ? sum(userAlways) : 0);
const leaderExtra = sum(requestableRepo);

const report = {
  ts: new Date().toISOString(),
  repo_always_bytes: sum(alwaysRepo),
  repo_always_tok: tok(sum(alwaysRepo)),
  repo_requestable_bytes: sum(requestableRepo),
  repo_requestable_tok: tok(sum(requestableRepo)),
  cursorrules_agents_bytes: sum(extra),
  user_always_bytes: includeUser ? sum(userAlways) : null,
  user_glob_scoped_bytes: includeUser ? sum(userGlobsOnly) : null,
  worker_fixed_bytes: workerFixed,
  worker_fixed_tok: tok(workerFixed),
  leader_read_all_requestable_tok: tok(workerFixed + leaderExtra),
  repo_always_files: alwaysRepo.map((r) => ({ name: r.name, bytes: r.bytes })),
  repo_requestable_files: requestableRepo.map((r) => ({ name: r.name, bytes: r.bytes })),
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('Context budget (rules on disk — ~tok = bytes/3.5)\n');
  console.log(`Worker fixed (alwaysApply + .cursorrules + AGENTS${includeUser ? ' + user always' : ''}):`);
  console.log(`  ${report.worker_fixed_bytes} bytes ≈ ${report.worker_fixed_tok} tok`);
  console.log(`Coordinator +requestable rules: +${report.repo_requestable_bytes} bytes ≈ ${report.repo_requestable_tok} tok`);
  console.log('\nAlwaysApply repo files:');
  for (const f of report.repo_always_files) {
    console.log(`  ${f.name.padEnd(42)} ${String(f.bytes).padStart(6)} B`);
  }
  if (includeUser && userAlways.length) {
    console.log('\nUser alwaysApply:');
    for (const r of userAlways) console.log(`  ${r.name.padEnd(42)} ${String(r.bytes).padStart(6)} B`);
  }
  if (includeUser && userGlobsOnly.length) {
    console.log('\nUser glob-scoped (not in worker fixed):');
    for (const r of userGlobsOnly) console.log(`  ${r.name.padEnd(42)} ${String(r.bytes).padStart(6)} B`);
  }
}
