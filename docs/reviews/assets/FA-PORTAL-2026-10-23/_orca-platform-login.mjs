#!/usr/bin/env node
/** Platform OIDC MFA after staff portal session. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(__dirname, '../../../..');
const page = process.argv[2];
const BASE = 'http://127.0.0.1:3013';
if (!page) process.exit(1);

function orca(command) {
  const raw = execFileSync(
    'orca',
    ['exec', '--page', page, '--command', command, '--json'],
    { encoding: 'utf8' },
  );
  const j = JSON.parse(raw);
  if (!j.ok) throw new Error(j.error?.message || 'orca failed');
  return j.result?.result ?? j.result;
}

async function waitNextTotpWindow() {
  const step = 30;
  const rem = step - ((Date.now() / 1000) % step);
  if (rem < 12) await sleep(Math.ceil((rem + 0.5) * 1000));
}

await orca(
  `goto ${BASE}/api/auth/platform/login?return=/platform`,
);
await orca('wait 3500');
await orca(
  'eval (() => { const e=document.querySelector(`input[name=username],input#username,input[type=email]`); const p=document.querySelector(`input[name=password],input#password,input[type=password]`); if(e){e.value=`staff@example.com`; e.dispatchEvent(new Event(`input`,{bubbles:true}));} if(p){p.value=`staff-demo`; p.dispatchEvent(new Event(`input`,{bubbles:true}));} const b=[...document.querySelectorAll(`button`)].find(x=>/sign in/i.test(x.textContent||``)); b?.click(); return !!b; })()',
);
await orca('wait 4500');
await waitNextTotpWindow();
execFileSync('node', [`${WT}/.orca-metrics/fix-all/private/totp-current.mjs`], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const totp = readFileSync(
  `${WT}/.orca-metrics/fix-all/private/totp-code.txt`,
  'utf8',
).trim();
const otpJs = `(() => { const o = document.getElementById(\`otp\`); if (!o) return { err: \`no-otp\` }; o.value = \`${totp}\`; o.dispatchEvent(new Event(\`input\`, { bubbles: true })); o.dispatchEvent(new Event(\`change\`, { bubbles: true })); const b = [...document.querySelectorAll(\`button\`)].find((x) => /sign in/i.test(x.textContent || \`\`)); b?.click(); return { len: o.value.length, clicked: !!b }; })()`;
const otpRes = await orca(`eval ${otpJs}`);
await orca('wait 15000');
const href = await orca('eval location.href');
const platformMe = await orca(
  'eval (async () => { const r = await fetch(`/api/bff/platform/me`, { credentials: `include` }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j }; })()',
);
console.log(
  JSON.stringify({
    otpRes,
    href: String(href).slice(0, 140),
    platformMe,
    utc: new Date().toISOString(),
  }),
);
