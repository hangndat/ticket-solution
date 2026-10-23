#!/usr/bin/env node
/**
 * PR #830 — axe-core on /redeem states @390/@1280 (motion + reduced-motion).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axeCore from 'axe-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const VIEWPORTS = [
  { id: '390', width: 390, height: 844 },
  { id: '1280', width: 1280, height: 900 },
];

function die(msg, code = 1) {
  console.error(`pr830-redeem-a11y: ${msg}`);
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

async function settleAnimations(page) {
  await page.evaluate(async () => {
    const anims = document.getAnimations();
    if (anims.length) {
      await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    }
  });
  await page.waitForTimeout(1000);
}

async function runAxe(page) {
  await page.addScriptTag({ content: `${axeCore.source}` });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    return {
      violationCount: results.violations.length,
      seriousCritical: serious.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
      })),
    };
  });
}

async function loginAttendee(page, base) {
  const user = process.env.WEB_UAT_USER ?? 'attendee@example.com';
  const pass = process.env.WEB_UAT_PASS ?? 'attendee-demo';
  await page.goto(`${base}/api/auth/login?return=/redeem`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL(/openid-connect\/auth|login-actions/, { timeout: 45_000 });
  const userField = page
    .locator('#username')
    .or(page.getByLabel(/username|email/i))
    .first();
  await userField.waitFor({ state: 'visible', timeout: 20_000 });
  await userField.fill(user);
  await page.locator('#password').or(page.getByLabel(/password/i)).first().fill(pass);
  await page
    .locator('#kc-login')
    .or(page.getByRole('button', { name: /sign in|log in/i }))
    .first()
    .click();
  const baseUrl = new URL(base);
  await page.waitForURL(
    (url) =>
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.port === baseUrl.port &&
      url.pathname.startsWith('/redeem'),
    { timeout: 60_000 },
  );
}

const STATES = [
  {
    id: 'guest',
    ready: '[data-testid="redeem-auth-gate"], [data-testid="site-footer"]',
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
    ready: '.field-error, [data-testid^="redeem-ux-"]',
    setup: async (page, base) => {
      await loginAttendee(page, base);
      await page.getByTestId('redeem-global-resolve').click({ timeout: 10_000 }).catch(() =>
        page.getByRole('button', { name: 'Đổi mã lấy vé' }).click(),
      );
    },
  },
  {
    id: 'server-error',
    ready:
      '[data-testid="redeem-ux-error"], [data-testid="redeem-ux-invalid"], [data-testid="redeem-ux-denied"]',
    setup: async (page, base) => {
      await loginAttendee(page, base);
      await page.getByTestId('redeem-global-code').fill('NOT-A-VALID-REDEEM-CODE-000');
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
  const sha = process.argv[3];
  if (!base || !sha) {
    die('usage: node pr830-redeem-a11y.mjs <baseUrl> <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR830'),
    `a11y-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const shell = findCachedHeadlessShell();
  if (!shell) die('Playwright headless shell not found');
  const browser = await chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const reports = [];

  try {
    for (const motion of ['default', 'reduce']) {
      for (const vp of VIEWPORTS) {
        for (const state of STATES) {
          const context = await browser.newContext(
            motion === 'reduce' ? { reducedMotion: 'reduce' } : {},
          );
          const page = await context.newPage();
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(`${base}/redeem`, {
            waitUntil: 'domcontentloaded',
            timeout: 120_000,
          });
          await state.setup(page, base);
          await page.waitForSelector(state.ready, { timeout: 60_000 });
          await settleAnimations(page);
          const axe = await runAxe(page);
          reports.push({
            state: state.id,
            motion,
            viewport: vp.id,
            ...axe,
          });
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const seriousTotal = reports.reduce(
    (n, r) => n + r.seriousCritical.length,
    0,
  );
  writeFileSync(
    join(outDir, 'axe-summary.json'),
    JSON.stringify({ sha, reports, seriousTotal }, null, 2),
  );
  if (seriousTotal > 0) {
    die(`axe serious/critical = ${seriousTotal}`);
  }
  console.log(
    `axe ok serious/critical=0 (${reports.length} runs) → ${outDir}/axe-summary.json`,
  );
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
