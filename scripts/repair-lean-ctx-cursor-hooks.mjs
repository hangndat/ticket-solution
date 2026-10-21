#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Only repair the known Cursor regression; preserve all other hook policies.
const args = process.argv.slice(2);
const check = args.includes('--check');
const configIndex = args.indexOf('--config');
if (
  args.some((arg, index) =>
    arg !== '--check' && arg !== '--config' && !(configIndex !== -1 && index === configIndex + 1)
  ) ||
  (configIndex !== -1 && (!args[configIndex + 1] || args[configIndex + 1].startsWith('--')))
) {
  throw new Error('Usage: node scripts/repair-lean-ctx-cursor-hooks.mjs [--check] [--config <path>]');
}
const path = configIndex === -1 ? join(homedir(), '.cursor', 'hooks.json') : args[configIndex + 1];
const original = readFileSync(path, 'utf8');
const config = JSON.parse(original);
let changed = 0;
for (const hook of config.hooks?.preToolUse ?? []) {
  if (
    hook.matcher === 'Grep|Glob' &&
    typeof hook.command === 'string' &&
    /(?:^|\/)lean-ctx hook deny$/.test(hook.command)
  ) {
    hook.command = hook.command.replace(/hook deny$/, 'hook redirect');
    changed++;
  }
}
if (!changed) {
  console.log('Không có hook Grep|Glob cần sửa.');
} else if (check) {
  console.error(`Phát hiện ${changed} hook Grep|Glob dùng deny: ${path}`);
  process.exitCode = 1;
} else {
  const backup = `${path}.before-glob-repair-${Date.now()}.bak`;
  writeFileSync(backup, original, { flag: 'wx', mode: 0o600 });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Đã chuyển ${changed} hook Grep|Glob sang redirect. Backup: ${backup}`);
}
