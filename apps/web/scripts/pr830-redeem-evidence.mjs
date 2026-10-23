#!/usr/bin/env node
/**
 * PR #830 — visual evidence: /redeem states @390/@1280.
 * Usage:
 *   WEB_UAT_USER=attendee@example.com WEB_UAT_PASS=attendee-demo \
 *     node apps/web/scripts/pr830-redeem-evidence.mjs http://127.0.0.1:3456 before|after <sha>
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
  console.error(`pr830-redeem-evidence: ${msg}`);
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

async function captureState(page, base, stateId, readySelector, outDir, phase, setup, shotLocator) {
  await page.goto(`${base}/redeem`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (setup) await setup(page, base);
  await page.waitForSelector(readySelector, { timeout: 60_000 });
  await page.evaluate(() => document.fonts?.ready);
  await settleAnimations(page);
  const md5s = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await settleAnimations(page);
    md5s.push(
      await shot(
        page,
        join(outDir, `${stateId}-${vp.id}-${phase}.png`),
        shotLocator ? shotLocator(page) : null,
      ),
    );
  }
  return md5s;
}

async function loginAttendee(page, base) {
  const user = process.env.WEB_UAT_USER ?? 'attendee@example.com';
  const pass = process.env.WEB_UAT_PASS ?? 'attendee-demo';
  await page.goto(`${base}/api/auth/login?return=/redeem`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, {
    timeout: 45_000,
  });

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
    (url) => appHosts.has(url.hostname) && url.pathname.startsWith('/redeem'),
    { timeout: 60_000 },
  );
}

const STATES = [
  {
    id: 'guest',
    ready: '[data-testid="site-footer"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
  },
  {
    id: 'auth-gate',
    ready: '[data-testid="redeem-auth-gate"]',
    setup: async (page) => {
      await page.context().clearCookies();
    },
    shotLocator: (page) => page.getByTestId('redeem-auth-gate'),
  },
  {
    id: 'form-empty',
    ready: '[data-testid="redeem-global-code"], input[name="code"]',
    setup: async (page, base) => {
      await loginAttendee(page, base);
    },
  },
  {
    id: 'validate-error',
    ready: '[data-testid="redeem-ux-error"], [data-testid="redeem-ux-invalid"], .field-error',
    setup: async (page, base) => {
      await loginAttendee(page, base);
      await page.getByTestId('redeem-global-resolve').click({ timeout: 10_000 }).catch(() =>
        page.getByRole('button', { name: 'Đổi mã lấy vé' }).click(),
      );
    },
  },
  {
    id: 'processing',
    ready: '[aria-busy="true"], button[aria-busy="true"]',
    setup: async (page, base) => {
      await loginAttendee(page, base);
      const code = process.env.WEB_UAT_REDEEM_PROCESSING_CODE ?? 'DEMO-MFEST-009';
      await page.getByTestId('redeem-global-code').fill(code).catch(async () => {
        await page.locator('input[name="code"]').first().fill(code);
      });
      await page.getByTestId('redeem-global-resolve').click();
      await page.waitForSelector('[aria-busy="true"]', { timeout: 15_000 }).catch(() => undefined);
    },
  },
  {
    id: 'success',
    ready: '[data-testid="redeem-ux-success"]',
    setup: async (page, base) => {
      await loginAttendee(page, base);
      const tenantId =
        process.env.WEB_UAT_TENANT_ID ?? 'd9d9f001-0001-4000-8000-000000000001';
      const eventId =
        process.env.WEB_UAT_EVENT_ID ?? 'd9d9f001-0002-4000-8000-000000000001';
      const code =
        process.env.WEB_UAT_REDEEM_SUCCESS_CODE ??
        process.env.WEB_UAT_REDEEM_CODE ??
        'DEMO-MFEST-005';
      const redeemUrl =
        `${base}/redeem?tenantId=${encodeURIComponent(tenantId)}` +
        `&eventId=${encodeURIComponent(eventId)}` +
        '&tenantSlug=mfest-demo&eventSlug=mfest';
      await page.goto(redeemUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="redeem-terms-consent"]', {
        timeout: 90_000,
      });
      await page.locator('input[name="code"]').first().fill(code);
      await page.locator('#terms-accepted').check({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Đổi mã lấy vé' }).click();
      await page.waitForSelector('[data-testid="redeem-ux-success"]', {
        timeout: 90_000,
      });
    },
  },
  {
    id: 'server-error',
    ready:
      '[data-testid="redeem-ux-error"], [data-testid="redeem-ux-invalid"], [data-testid="redeem-ux-denied"]',
    setup: async (page, base) => {
      await loginAttendee(page, base);
      await page.getByTestId('redeem-global-code').fill('NOT-A-VALID-REDEEM-CODE-000').catch(
        async () => {
          await page.locator('input[name="code"]').first().fill('NOT-A-VALID-REDEEM-CODE-000');
        },
      );
      await page.getByTestId('redeem-global-resolve').click();
      await page.waitForSelector(
        '[data-testid="redeem-ux-error"], [data-testid="redeem-ux-invalid"], [data-testid="redeem-ux-denied"]',
        { timeout: 60_000 },
      );
    },
  },
];

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const phase = process.argv[3];
  const sha = process.argv[4];
  if (!base || !phase || !sha) {
    die('usage: node pr830-redeem-evidence.mjs <baseUrl> before|after <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR830'),
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
            state.ready,
            outDir,
            phase,
            state.setup,
            state.shotLocator,
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

  const unique = new Set(md5s);
  if (unique.size < md5s.length) {
    die('duplicate md5 among captures — states must differ');
  }
  console.log(`done ${outDir} (${md5s.length} images)`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
