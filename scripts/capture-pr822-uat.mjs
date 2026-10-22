#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const PAGE = process.env.UAT_PAGE_ID ?? '1c89cfd0-09f7-497f-9d4b-9907cab0b56d';
const WT = 'path:/Users/admin/orca/workspaces/main/uif-822-button-unify';
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().slice(0, 12);
const OUT = join(process.cwd(), 'docs/reviews/assets/PR822');
mkdirSync(OUT, { recursive: true });

function orca(command) {
  const out = execFileSync(
    'orca',
    ['exec', '--page', PAGE, '--worktree', WT, '--command', command, '--json'],
    { encoding: 'utf8' },
  );
  return JSON.parse(out);
}

function shot(name, w, h, url, after = []) {
  orca(`set viewport ${w} ${h}`);
  orca(`goto ${url}`);
  orca('wait 2000');
  for (const cmd of after) {
    try {
      orca(cmd);
    } catch {
      /* hover/focus may be unsupported on some elements */
    }
  }
  const { result } = orca('screenshot');
  const dest = join(OUT, `${name}-${SHA}.png`);
  copyFileSync(result.path, dest);
  const md5 = createHash('md5').update(execFileSync('cat', [dest])).digest('hex');
  console.log(`${name}\t${md5}\t${dest}`);
}

const base = 'http://localhost:3000';
shot('mkt-1280-default', 1280, 900, `${base}/marketing#top`);
shot('mkt-390-default', 390, 844, `${base}/marketing#top`);
shot('mkt-1280-hover-demo', 1280, 900, `${base}/marketing#top`, ['hover [data-testid=cta-demo]']);
shot('mkt-1280-focus-demo', 1280, 900, `${base}/marketing#top`, ['focus [data-testid=cta-demo]']);
shot('mkt-390-disabled-interest', 390, 844, `${base}/marketing#interest`);
shot('attendee-1280-default', 1280, 900, `${base}/redeem`);
shot('attendee-390-default', 390, 844, `${base}/redeem`);
shot('attendee-1280-focus', 1280, 900, `${base}/redeem`, ['focus button[type=submit]']);
shot('attendee-1280-disabled', 1280, 900, `${base}/redeem`, [
  'screenshot --selector button[type=submit]:disabled',
]);
