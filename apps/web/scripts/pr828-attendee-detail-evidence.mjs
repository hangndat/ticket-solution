#!/usr/bin/env node
/**
 * PR #828 — visual evidence: event detail, ticket detail, wallet @390/@1280.
 * Usage:
 *   pnpm --filter @ticket/web start --port 3456 &
 *   node apps/web/scripts/pr828-attendee-detail-evidence.mjs http://127.0.0.1:3456 before|after <sha>
 *
 * Optional authenticated captures (wallet grid, ticket QR):
 *   WEB_UAT_USER=… WEB_UAT_PASS=… node …
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const ROUTES = [
  {
    id: 'event-detail',
    path: '/t/mfest-demo/events/mfest',
    ready:
      '[data-testid="event-published"], [data-testid="event-unreachable"]',
  },
  {
    id: 'ticket-need-login',
    path: '/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6',
    ready: '[data-testid="owner-ticket-need-login"]',
  },
  {
    id: 'ticket-invalid',
    path: '/t/uat-device/tickets/not-a-valid-uuid',
    ready: '[data-testid="owner-ticket-invalid"]',
  },
  {
    id: 'wallet-need-login',
    path: '/wallet',
    ready: '[data-testid="wallet-need-login"]',
  },
];

function die(msg, code = 1) {
  console.error(`pr828-attendee-detail-evidence: ${msg}`);
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

const VIEWPORTS = [
  { id: '390', width: 390, height: 844 },
  { id: '1280', width: 1280, height: 900 },
];

async function settleAnimations(page) {
  await page.evaluate(async () => {
    const anims = document.getAnimations();
    if (anims.length) {
      await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    }
  });
  await page.waitForTimeout(1000);
}

async function shot(page, file) {
  await page.screenshot({ path: file, fullPage: false });
  const md5 = createHash('md5').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.md5.txt`, `${md5}\n`);
  console.log(`captured ${file} md5=${md5}`);
  return md5;
}

async function captureRoute(page, base, route, phase, outDir) {
  const res = await page.goto(`${base}${route.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (!res || !res.ok()) {
    die(`navigation failed ${route.path} status=${res?.status()}`);
  }
  await page.waitForSelector(route.ready, { timeout: 60_000 });
  await page.evaluate(() => document.fonts?.ready);
  await settleAnimations(page);
  const md5s = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await settleAnimations(page);
    md5s.push(
      await shot(page, join(outDir, `${route.id}-${vp.id}-${phase}.png`)),
    );
  }
  return md5s;
}

async function loginForWallet(page, base) {
  const user = process.env.WEB_UAT_USER;
  const pass = process.env.WEB_UAT_PASS;
  if (!user || !pass) return false;
  await page.goto(`${base}/api/auth/login?return=/wallet`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions|\/wallet/, {
    timeout: 45_000,
  });
  if (page.url().includes('/wallet')) return true;
  await page.locator('#username').first().fill(user);
  await page.locator('#password').first().fill(pass);
  await page.locator('#kc-login').first().click();
  await page.waitForURL(/\/wallet/, { timeout: 60_000 });
  return true;
}

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const phase = process.argv[3];
  const sha = process.argv[4];
  if (!base || !phase || !sha) {
    die('usage: node pr828-attendee-detail-evidence.mjs <baseUrl> before|after <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR828'),
    `${phase}-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  const md5s = [];

  try {
    for (const route of ROUTES) {
      md5s.push(...(await captureRoute(page, base, route, phase, outDir)));
    }

    const authed = await loginForWallet(page, base);
    if (authed) {
      await page.goto(`${base}/wallet`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="wallet-ready"]', {
        timeout: 60_000,
      });
      const hasGrid = await page
        .getByTestId('wallet-ticket-grid')
        .waitFor({ state: 'visible', timeout: 60_000 })
        .then(() => true)
        .catch(() => false);
      const walletShotId = hasGrid ? 'wallet-ready' : 'wallet-empty';
      await settleAnimations(page);
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        md5s.push(
          await shot(
            page,
            join(outDir, `${walletShotId}-${vp.id}-${phase}.png`),
          ),
        );
      }
      if (hasGrid) {
        const ticket = page.locator('a[data-testid^="wallet-ticket-"]').first();
        if ((await ticket.count()) > 0) {
          await ticket.click();
          await page.waitForSelector('[data-testid="owner-ticket-ready"]', {
            timeout: 60_000,
          });
          await settleAnimations(page);
          for (const vp of VIEWPORTS) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            md5s.push(
              await shot(
                page,
                join(outDir, `ticket-ready-${vp.id}-${phase}.png`),
              ),
            );
          }
        }
      }
    }
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  const unique = new Set(md5s);
  if (unique.size < md5s.length) {
    die('duplicate md5 among captures — states must differ');
  }
  console.log(`done ${outDir} (${md5s.length} images)`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
