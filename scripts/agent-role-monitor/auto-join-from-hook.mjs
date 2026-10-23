#!/usr/bin/env node
/**
 * beforeSubmitPrompt helper: stdin = hook JSON, join using .orca-metrics/active-dispatch.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isWorktreeDispatchAmbiguous } from './lib/usage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const activePath = path.join(repoRoot, '.orca-metrics', 'active-dispatch.json');
const cli = path.join(__dirname, 'cli.mjs');

const raw = fs.readFileSync(0, 'utf8');
let hook = {};
try {
  hook = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

if (!fs.existsSync(activePath)) process.exit(0);
let active = {};
try {
  active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
} catch {
  process.exit(0);
}

const cid = hook.conversation_id || hook.conversationId;
if (!cid || !active.dispatch_id || !active.role_id) process.exit(0);

// A shared active-dispatch file cannot identify concurrent conversations.
if (isWorktreeDispatchAmbiguous(repoRoot, process.env, active.dispatch_id)) process.exit(0);

const args = [
  cli,
  'record-join',
  '--conversation-id',
  String(cid),
  '--dispatch-id',
  String(active.dispatch_id),
  '--role-id',
  String(active.role_id),
];
if (active.task_id) args.push('--task-id', String(active.task_id));
if (active.run_id) args.push('--run-id', String(active.run_id));

const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(0);
