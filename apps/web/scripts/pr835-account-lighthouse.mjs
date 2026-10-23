#!/usr/bin/env node
/**
 * PR #835 — Lighthouse mobile /account (signed-in), median ≥3 runs.
 * Bootstraps session cookies via Playwright, passes Cookie header to Lighthouse.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const LABEL = process.argv[3] ?? 'unknown';
const OUT = resolve(
  process.argv[4] ?? join(ROOT, 'docs/reviews/assets/PR835/lighthouse'),
);
const RUNS = Math.max(3, Number(process.argv[5] ?? 3));

function die(msg, code = 1) {
  console.error(`pr835-account-lighthouse: ${msg}`);
  process.exit(code);
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function lighthouseVersion() {
  return execFileSync('npx', ['lighthouse', '--version'], { encoding: 'utf8' }).trim();
}

function findCachedHeadlessShell() {
  if (process.env.WEB_UAT_EXECUTABLE) return process.env.WEB_UAT_EXECUTABLE;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const dir of dirs) {
    for (const arch of [
      'chrome-headless-shell-mac-arm64',
      'chrome-headless-shell-mac-x64',
    ]) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function loginCookieHeader(base) {
  const shell = findCachedHeadlessShell();
  if (!shell) die('Playwright headless shell not found');
  const user = process.env.WEB_UAT_USER ?? 'attendee@example.com';
  const pass = process.env.WEB_UAT_PASS ?? 'attendee-demo';
  const browser = await chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/api/auth/login?return=%2Faccount`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 45_000 });
  const u = new URL(page.url());
  if (u.port === '8080' && u.hostname !== '127.0.0.1') {
    u.hostname = '127.0.0.1';
    await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
  }
  await page.locator('#username').first().fill(user);
  await page.locator('#password').first().fill(pass);
  await page.locator('#kc-login').first().click();
  const baseUrl = new URL(base);
  await page.waitForURL(
    (url) =>
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.port === baseUrl.port &&
      !url.pathname.startsWith('/api/auth/login'),
    { timeout: 60_000 },
  );
  const cookies = await context.cookies();
  await browser.close();
  const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  if (!header) die('no cookies after login');
  return header;
}

function runOnce(url, cookieHeader) {
  const args = [
    'lighthouse',
    url,
    '--quiet',
    '--chrome-flags=--headless --disable-dev-shm-usage',
    '--form-factor=mobile',
    '--screen-emulation.mobile',
    '--screen-emulation.width=390',
    '--screen-emulation.height=844',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    '--output-path=stdout',
    `--extra-headers=${JSON.stringify({ Cookie: cookieHeader })}`,
  ];
  const json = execFileSync('npx', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const report = JSON.parse(json);
  const c = report.categories;
  return {
    performance: Math.round((c.performance?.score ?? 0) * 100),
    accessibility: Math.round((c.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((c['best-practices']?.score ?? 0) * 100),
    seo: Math.round((c.seo?.score ?? 0) * 100),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const lhVersion = lighthouseVersion();
  const cookieHeader = await loginCookieHeader(BASE);
  const route = { id: 'account', path: '/account' };
  const url = `${BASE}${route.path}`;
  const scores = [];

  for (let i = 0; i < RUNS; i += 1) {
    const runId = `${LABEL}-${route.id}-run${i + 1}`;
    process.stderr.write(`${runId} …\n`);
    const s = runOnce(url, cookieHeader);
    scores.push(s);
    writeFileSync(
      join(OUT, `${runId}.json`),
      JSON.stringify(
        { label: LABEL, route, run: i + 1, lighthouse: lhVersion, scores: s },
        null,
        2,
      ),
    );
  }

  const medianScores = {
    performance: median(scores.map((s) => s.performance)),
    accessibility: median(scores.map((s) => s.accessibility)),
    bestPractices: median(scores.map((s) => s.bestPractices)),
    seo: median(scores.map((s) => s.seo)),
  };

  writeFileSync(
    join(OUT, `${LABEL}-${route.id}-median.json`),
    JSON.stringify(
      { label: LABEL, route, lighthouse: lhVersion, medianScores, runs: RUNS },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ label: LABEL, medianScores }, null, 2));
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
