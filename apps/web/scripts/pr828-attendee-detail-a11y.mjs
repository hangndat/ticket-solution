#!/usr/bin/env node
/**
 * PR #828 axe-core on event detail, wallet, ticket @390/@1280 (motion + reduced-motion).
 * Guest routes + optional authenticated wallet/ticket when WEB_UAT_USER/PASS set.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axeCore from 'axe-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const GUEST_ROUTES = [
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
    id: 'wallet-need-login',
    path: '/wallet',
    ready: '[data-testid="wallet-need-login"]',
  },
];

function die(msg, code = 1) {
  console.error(`pr828-attendee-detail-a11y: ${msg}`);
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

async function runAxe(page) {
  await page.addScriptTag({ content: `${axeCore.source}` });
  return page.evaluate(async () => {
    // @ts-expect-error axe injected
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

async function axeRoute(page, base, route, motion, vp, reports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  const res = await page.goto(`${base}${route.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (!res?.ok()) {
    die(`${route.id} navigation failed status=${res?.status()}`);
  }
  await page.waitForSelector(route.ready, { timeout: 60_000 });
  await settleAnimations(page);
  const axe = await runAxe(page);
  reports.push({
    route: route.id,
    motion,
    viewport: vp.id,
    path: route.path,
    ...axe,
  });
}

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const sha = process.argv[3];
  if (!base || !sha) {
    die('usage: node pr828-attendee-detail-a11y.mjs <baseUrl> <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR828'),
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
        for (const route of GUEST_ROUTES) {
          const context = await browser.newContext(
            motion === 'reduce' ? { reducedMotion: 'reduce' } : {},
          );
          const page = await context.newPage();
          await axeRoute(page, base, route, motion, vp, reports);
          await context.close();
        }
      }
    }

    const authed = await (async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const ok = await loginForWallet(page, base);
      if (!ok) {
        await context.close();
        return null;
      }
      return { context, page };
    })();

    if (authed) {
      const { context, page } = authed;
      const authRoutes = [
        {
          id: 'wallet-authed',
          path: '/wallet',
          ready: '[data-testid="wallet-ready"], [data-testid="wallet-empty"]',
        },
      ];
      for (const motion of ['default', 'reduce']) {
        for (const vp of VIEWPORTS) {
          await page.emulateMedia({
            reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference',
          });
          for (const route of authRoutes) {
            await axeRoute(page, base, route, motion, vp, reports);
          }
        }
      }
      await page.goto(`${base}/wallet`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="wallet-ready"]', {
        timeout: 60_000,
      });
      const hasGrid = await page
        .getByTestId('wallet-ticket-grid')
        .waitFor({ state: 'visible', timeout: 60_000 })
        .then(() => true)
        .catch(() => false);
      const ticket = page.locator('a[data-testid^="wallet-ticket-"]').first();
      if (hasGrid && (await ticket.count()) > 0) {
        await ticket.click();
        await page.waitForSelector('[data-testid="owner-ticket-ready"]', {
          timeout: 60_000,
        });
        const ticketRoute = {
          id: 'ticket-ready',
          path: page.url().replace(base, ''),
          ready: '[data-testid="owner-ticket-ready"]',
        };
        for (const motion of ['default', 'reduce']) {
          for (const vp of VIEWPORTS) {
            await page.emulateMedia({
              reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference',
            });
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await settleAnimations(page);
            const axe = await runAxe(page);
            reports.push({
              route: ticketRoute.id,
              motion,
              viewport: vp.id,
              path: ticketRoute.path,
              ...axe,
            });
          }
        }
      }
      await context.close();
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
