#!/usr/bin/env node
/**
 * PR #835 — visual evidence: /account + /privacy @390/@1280.
 * Usage:
 *   WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
 *     node apps/web/scripts/pr835-account-evidence.mjs http://127.0.0.1:3000 before|after <sha>
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
  console.error(`pr835-account-evidence: ${msg}`);
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

async function shot(page, file) {
  await page.screenshot({ path: file, fullPage: true });
  const md5 = createHash('md5').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.md5.txt`, `${md5}\n`);
  console.log(`captured ${file} md5=${md5}`);
  return md5;
}

async function loginAttendee(page, base, returnPath = '/account') {
  const user = process.env.WEB_UAT_USER ?? 'attendee@example.com';
  const pass = process.env.WEB_UAT_PASS ?? 'attendee-demo';
  await page.goto(`${base}/api/auth/login?return=${encodeURIComponent(returnPath)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 45_000 });

  let prefer = process.env.KEYCLOAK_PUBLIC_HOST || '';
  if (!prefer) {
    try {
      const disc = await page.request.get(
        'http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration',
      );
      if (disc.ok()) {
        const body = await disc.json();
        prefer = new URL(body.issuer).hostname;
      }
    } catch {
      prefer = '';
    }
  }
  if (!prefer) prefer = '127.0.0.1';
  const u = new URL(page.url());
  if (u.port === '8080' && u.hostname !== prefer) {
    u.hostname = prefer;
    await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
  }

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
    (url) =>
      appHosts.has(url.hostname) && !url.pathname.startsWith('/api/auth/login'),
    { timeout: 60_000 },
  );
  const pathOnly = returnPath.split('#')[0];
  if (!page.url().includes(pathOnly)) {
    await page.goto(`${base}${returnPath}`, { waitUntil: 'domcontentloaded' });
  }
  if (pathOnly === '/account') {
    await page
      .waitForSelector('[data-testid="account-session-signed-in"]', { timeout: 30_000 })
      .catch(() => undefined);
  }
}

async function captureState(page, base, stateId, path, ready, outDir, phase, setup) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (setup) await setup(page, base);
  await page.waitForSelector(ready, { timeout: 60_000 });
  await page.evaluate(() => document.fonts?.ready);
  await settleAnimations(page);
  const md5s = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await settleAnimations(page);
    md5s.push(
      await shot(page, join(outDir, `${stateId}-${vp.id}-${phase}.png`)),
    );
  }
  return md5s;
}

const STATES = [
  {
    id: 'account-signed-out',
    path: '/account',
    ready: '[data-testid="account-session-signed-out"]',
    setup: async (page) => {
      await page.context().clearCookies();
      await page.reload();
    },
  },
  {
    id: 'account-signed-in',
    path: '/account',
    ready: '[data-testid="account-session-signed-in"]',
    setup: async (page, base) => {
      await loginAttendee(page, base, '/account');
    },
  },
  {
    id: 'account-deletion',
    path: '/account#account-deletion',
    ready: '#account-deletion',
    setup: async (page, base) => {
      await loginAttendee(page, base, '/account#account-deletion');
      await page.locator('#account-deletion').scrollIntoViewIfNeeded();
    },
  },
  {
    id: 'privacy',
    path: '/privacy',
    ready: '[data-testid="privacy-product"]',
    setup: async (page, base) => {
      await loginAttendee(page, base, '/privacy');
    },
  },
  {
    id: 'account-after-logout',
    path: '/account',
    ready: '[data-testid="account-session-signed-out"]',
    setup: async (page, base) => {
      await loginAttendee(page, base, '/account');
      await page.waitForSelector('[data-testid="account-session-signed-in"]', {
        timeout: 30_000,
      });
      await page.getByRole('link', { name: 'Đăng xuất' }).click();
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
      await page.goto(`${base}/account`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="account-session-signed-out"]', {
        timeout: 30_000,
      });
    },
  },
];

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const phase = process.argv[3];
  const sha = process.argv[4];
  if (!base || !phase || !sha) {
    die('usage: node pr835-account-evidence.mjs <baseUrl> before|after <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR835'),
    `${phase}-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const md5s = [];

  try {
    for (const state of STATES) {
      const context = await browser.newContext();
      const statePage = await context.newPage();
      try {
        md5s.push(
          ...(await captureState(
            statePage,
            base,
            state.id,
            state.path,
            state.ready,
            outDir,
            phase,
            state.setup,
          )),
        );
      } catch (err) {
        die(`state ${state.id} failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  writeFileSync(
    join(outDir, 'SKIP-NOTES.md'),
    `# PR835 capture notes (${phase})\n\n- **Multi-session list (≥2 devices):** skipped — \`/account\` only renders \`SessionPanel\` (current device); no session list / revoke-other UI in apps/web.\n`,
  );
  console.log(`done ${outDir} (${md5s.length} images)`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
