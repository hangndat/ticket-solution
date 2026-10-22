#!/usr/bin/env node
/**
 * PR822 WP-4 button unify — Orca browser UAT captures (marketing + attendee).
 * Run from repo root after `pnpm --filter @ticket/web build && pnpm start` on :3000.
 *
 * Env: UAT_PAGE_ID (Orca browserPageId), ORCA_WORKTREE (optional `path:<abs>`; default repo root).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const worktree =
  process.env.ORCA_WORKTREE ?? `path:${process.env.UIF_822_REPO_ROOT ?? repoRoot}`;
const PAGE = process.env.UAT_PAGE_ID;
if (!PAGE) {
  console.error('UAT_PAGE_ID is required (Orca browserPageId).');
  process.exit(1);
}

const SHA = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim().slice(0, 12);
const OUT = join(repoRoot, 'docs/reviews/assets/PR822');
mkdirSync(OUT, { recursive: true });

const base = process.env.UAT_BASE_URL ?? 'http://localhost:3000';

function orca(command) {
  let out;
  try {
    out = execFileSync(
      'orca',
      ['exec', '--page', PAGE, '--worktree', worktree, '--command', command, '--json'],
      { encoding: 'utf8' },
    );
  } catch (err) {
    const msg = err.stderr?.toString() || err.message || String(err);
    throw new Error(`orca exec failed for "${command}": ${msg}`);
  }
  const parsed = JSON.parse(out);
  if (!parsed.ok) {
    throw new Error(
      `orca command failed: ${command} — ${parsed.error?.message ?? JSON.stringify(parsed.error)}`,
    );
  }
  return parsed;
}

function md5File(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex');
}

function shot(name, w, h, url, after = [], { snapshotFirst = false } = {}) {
  orca(`set viewport ${w} ${h}`);
  orca(`goto ${url}`);
  orca('wait 2000');
  if (snapshotFirst) {
    orca('snapshot');
  }
  for (const cmd of after) {
    orca(cmd);
  }
  const { result } = orca('screenshot');
  const dest = join(OUT, `${name}-${SHA}.png`);
  copyFileSync(result.path, dest);
  const md5 = md5File(dest);
  console.log(`${name}\t${md5}\t${dest}`);
  return md5;
}

const md5ByName = {};

md5ByName['mkt-1280-default'] = shot(
  'mkt-1280-default',
  1280,
  900,
  `${base}/marketing#top`,
);
md5ByName['mkt-390-default'] = shot('mkt-390-default', 390, 844, `${base}/marketing#top`);
md5ByName['mkt-1280-hover'] = shot('mkt-1280-hover', 1280, 900, `${base}/marketing#top`, [
  'hover [data-testid=cta-demo]',
]);
md5ByName['mkt-1280-focus'] = shot('mkt-1280-focus', 1280, 900, `${base}/marketing#top`, [
  'focus [data-testid=cta-demo]',
]);
md5ByName['mkt-1280-disabled'] = shot(
  'mkt-1280-disabled',
  1280,
  900,
  `${base}/marketing#interest`,
  ['eval document.forms[0].elements[10].toggleAttribute(String.fromCharCode(100,105,115,97,98,108,101,100))'],
);

md5ByName['attendee-1280-default'] = shot(
  'attendee-1280-default',
  1280,
  900,
  `${base}/redeem`,
);
md5ByName['attendee-390-default'] = shot('attendee-390-default', 390, 844, `${base}/redeem`);
// Redeem guest gate uses asChild links — :hover often invisible on full-page PNG; wallet login CTA hovers reliably.
md5ByName['attendee-1280-hover'] = shot(
  'attendee-1280-hover',
  1280,
  900,
  `${base}/wallet`,
  ['hover e5'],
  { snapshotFirst: true },
);
md5ByName['attendee-1280-focus'] = shot(
  'attendee-1280-focus',
  1280,
  900,
  `${base}/redeem`,
  ['focus e7'],
  { snapshotFirst: true },
);
// Guest /redeem has no disabled <button>; capture unified Button disabled on attendee /invite.
md5ByName['attendee-1280-disabled'] = shot(
  'attendee-1280-disabled',
  1280,
  900,
  `${base}/invite`,
);

const groups = [
  ['mkt-1280-default', 'mkt-1280-hover', 'mkt-1280-focus', 'mkt-1280-disabled'],
  ['attendee-1280-default', 'attendee-1280-hover', 'attendee-1280-focus', 'attendee-1280-disabled'],
];

for (const names of groups) {
  const hashes = names.map((n) => md5ByName[n]);
  const unique = new Set(hashes);
  if (unique.size !== names.length) {
    console.error(`MD5 collision in group ${names.join(', ')}:`, md5ByName);
    process.exit(1);
  }
}

console.log(`OK — captures for SHA ${SHA}`);
