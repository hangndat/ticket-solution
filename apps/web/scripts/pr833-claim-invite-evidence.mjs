#!/usr/bin/env node
/**
 * PR #833 — visual evidence: claim / invite / error / not-found / redeem spot-check.
 * Usage:
 *   WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
 *     node apps/web/scripts/pr833-claim-invite-evidence.mjs http://127.0.0.1:3456 before|after <sha>
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const VIEWPORTS = [
  { id: '390', width: 390, height: 844 },
  { id: '1280', width: 1280, height: 900 },
];

function die(msg, code = 1) {
  console.error(`pr833-claim-invite-evidence: ${msg}`);
  process.exit(code);
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

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  if (!shell) die('Playwright headless shell not found');
  return chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
}

async function settleAnimations(page) {
  await page.evaluate(async () => {
    const anims = document.getAnimations();
    if (anims.length) {
      await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    }
  });
  await page.waitForTimeout(1000);
}

async function shot(page, file, locator) {
  if (locator) {
    await locator.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: false });
  }
  const md5 = createHash('md5').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.md5.txt`, `${md5}\n`);
  console.log(`captured ${file} md5=${md5}`);
  return md5;
}

async function captureRoute(page, base, route, stateId, readySelector, outDir, phase, setup) {
  await page.goto(`${base}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (setup) await setup(page, base);
  if (readySelector) {
    await page.waitForSelector(readySelector, { timeout: 60_000 });
  }
  await page.evaluate(() => document.fonts?.ready);
  await settleAnimations(page);
  const md5s = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await settleAnimations(page);
    md5s.push(
      await shot(page, join(outDir, `${stateId}-${vp.id}-${phase}.png`), null),
    );
  }
  return md5s;
}

async function loginAttendee(page, base, returnPath) {
  const user = process.env.WEB_UAT_USER ?? 'attendee@example.com';
  const pass = process.env.WEB_UAT_PASS ?? 'attendee-demo';
  await page.goto(`${base}/api/auth/login?return=${encodeURIComponent(returnPath)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, {
    timeout: 45_000,
  });
  const userField = page
    .locator('#username')
    .or(page.getByLabel(/username|email/i))
    .first();
  const passField = page.locator('#password').or(page.getByLabel(/password/i)).first();
  await userField.waitFor({ state: 'visible', timeout: 20_000 });
  await userField.fill(user);
  await passField.fill(pass);
  await page
    .locator('#kc-login')
    .or(page.getByRole('button', { name: /sign in|log in/i }))
    .first()
    .click();
  const baseUrl = new URL(base);
  const appHosts = new Set(['127.0.0.1', 'localhost', baseUrl.hostname]);
  await page.waitForURL(
    (url) => appHosts.has(url.hostname) && url.pathname.startsWith(returnPath),
    { timeout: 60_000 },
  );
}

const ROUTES = [
  {
    route: '/claim',
    id: 'claim-empty',
    ready: '[data-testid="claim-token-empty"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
  },
  {
    route: '/invite',
    id: 'invite-empty',
    ready: '[data-testid="invite-token-empty"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
  },
  {
    route: '/invite',
    id: 'invite-token-invalid',
    ready: '[data-testid="invite-accept-result"]',
    setup: async (page, base) => {
      await loginAttendee(page, base, '/invite');
      await page.getByLabel('Mã lời mời').fill('not-a-real-invite-token');
      await page.getByTestId('invite-accept-submit').click();
      await page.waitForSelector('[data-testid="invite-accept-result"]', {
        timeout: 30_000,
      });
    },
  },
  {
    route: '/redeem',
    id: 'redeem-guest',
    ready: '[data-testid="redeem-auth-gate"], [data-testid="site-footer"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
  },
  {
    route: '/__not_real__',
    id: 'not-found',
    ready: '[data-testid="route-not-found"]',
    setup: async (page, base) => {
      await page.goto(`${base}/this-route-does-not-exist-833`, {
        waitUntil: 'domcontentloaded',
      });
    },
  },
];

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const phase = process.argv[3];
  const sha = process.argv[4];
  if (!base || !phase || !sha) {
    die('usage: node pr833-claim-invite-evidence.mjs <baseUrl> before|after <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR833'),
    `${phase}-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const md5s = [];

  try {
    for (const item of ROUTES) {
      const context = await browser.newContext();
      const statePage = await context.newPage();
      try {
        md5s.push(
          ...(await captureRoute(
            statePage,
            base,
            item.route,
            item.id,
            item.ready,
            outDir,
            phase,
            item.setup,
          )),
        );
      } finally {
        await context.close();
      }
    }
    // error.tsx — trigger via client navigation hack: use dev-only if unavailable skip
    writeFileSync(
      join(outDir, `manifest-${phase}.json`),
      JSON.stringify({ sha, phase, md5Count: md5s.length }, null, 2),
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => die(err?.message ?? String(err)));
