#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cases = ['SEC-01', 'AUTH-03', 'GATE-01', 'GATE-03', 'DB-03'];
const args = process.argv.slice(2);
const caseFlag = args.indexOf('--case');
const selected = caseFlag < 0 ? null : args[caseFlag + 1];
const valid = args.every(
  (arg, index) =>
    arg === '--list' ||
    arg === '--help' ||
    arg === '--case' ||
    (index === caseFlag + 1 && cases.includes(arg)),
);
if (
  !valid ||
  (caseFlag >= 0 && !selected) ||
  (selected && !cases.includes(selected))
) {
  console.error(
    'Usage: node tests/e2e/http/entry.mjs [--list] [--case SEC-01|AUTH-03|GATE-01|GATE-03|DB-03]',
  );
  process.exit(2);
}
if (args.includes('--help')) {
  console.log('Usage: node tests/e2e/http/entry.mjs [--list] [--case ID]');
  process.exit(0);
}
if (args.includes('--list')) {
  console.log(JSON.stringify(selected ? [selected] : cases, null, 2));
  process.exit(0);
}
if (!process.env.E2E_MANIFEST) {
  console.error('BLOCKED: E2E_MANIFEST is required for live HTTP tests.');
  process.exit(2);
}
const file = fileURLToPath(new URL('./live.test.mjs', import.meta.url));
const result = spawnSync(process.execPath, ['--test', file], {
  stdio: 'inherit',
  env: { ...process.env, E2E_HTTP_CASE: selected ?? '' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
