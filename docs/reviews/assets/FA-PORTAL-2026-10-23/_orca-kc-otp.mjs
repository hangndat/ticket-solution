#!/usr/bin/env node
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(__dirname, '../../../..');
const page = process.argv[2];
if (!page) {
  console.error('usage: _orca-kc-otp.mjs <pageId>');
  process.exit(1);
}
execSync(`node ${WT}/.orca-metrics/fix-all/private/totp-current.mjs`, {
  stdio: 'inherit',
});
const totp = readFileSync(
  `${WT}/.orca-metrics/fix-all/private/totp-code.txt`,
  'utf8',
).trim();
const js = `(() => {
  const o = document.getElementById('otp');
  if (!o) return { err: 'no-otp' };
  o.value = '${totp}';
  o.dispatchEvent(new Event('input', { bubbles: true }));
  o.dispatchEvent(new Event('change', { bubbles: true }));
  const b = [...document.querySelectorAll('button')].find((x) =>
    /sign in/i.test(x.textContent || ''),
  );
  b?.click();
  return { len: o.value.length, clicked: !!b };
})()`;
const raw = execFileSync('orca', [
  'exec',
  '--page',
  page,
  '--command',
  `eval ${js}`,
  '--json',
]);
process.stdout.write(raw);
