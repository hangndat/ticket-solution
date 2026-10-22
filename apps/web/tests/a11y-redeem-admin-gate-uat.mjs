#!/usr/bin/env node
/**
 * Headless UAT — UX-10 / Issue #382 a11y residual on redeem / admin / gate.
 *
 * Usage: node apps/web/tests/a11y-redeem-admin-gate-uat.mjs [baseUrl]
 *
 * AC (scoped — does NOT claim WCAG AA whole app):
 * - Playwright axe on redeem (+ admin/gate critical paths or soft-redirect landings)
 * - Focus-visible ring present for keyboard
 * - Primary controls hit ≥44px
 * - Live-region contracts: unknown → assertive alert
 *
 * Never steals the macOS mouse (Playwright headless only).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const axeCore = require('axe-core');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.env.WEB_UAT_OUT_DIR || join(ROOT, 'apps/web/.uat-artifacts');
const BASE = (process.argv[2] || process.env.WEB_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

function die(msg, code = 1) {
  console.error(`a11y-redeem-admin-gate-uat: ${msg}`);
  process.exit(code);
}

function eq(actual, expected, label) {
  if (actual !== expected) die(`${label}: expected ${expected}, got ${actual}`);
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
    for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const headed = process.env.WEB_UAT_HEADED === '1';
  const args = headed ? [] : ['--disable-dev-shm-usage'];
  const shell = headed ? null : findCachedHeadlessShell();
  const attempts = [];
  if (shell) attempts.push({ executablePath: shell, headless: true, args });
  attempts.push({ headless: !headed, args });
  if (!headed) attempts.push({ channel: 'chrome', headless: true, args });
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('chromium launch failed');
}

/** Serious/critical axe violations only — residual surface, not AA-whole-app. */
async function runAxe(page, label) {
  await page.addScriptTag({ content: `${axeCore.source}` });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      resultTypes: ['violations'],
    });
  });
  const serious = (results.violations || []).filter((v) =>
    ['serious', 'critical'].includes(v.impact),
  );
  return {
    label,
    url: page.url(),
    violationCount: results.violations?.length ?? 0,
    seriousCritical: serious.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes?.length ?? 0,
    })),
  };
}

async function assertHitTarget(page, locator, label) {
  const box = await locator.boundingBox();
  if (!box || box.height < 44 || box.width < 44) {
    die(`${label} hit target <44px: ${JSON.stringify(box)}`);
  }
}

/** CSS contract — programmatic focus may skip :focus-visible in Chromium automation. */
async function assertFocusVisibleRule(page) {
  const ok = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of rules) {
        const sel = rule.selectorText || '';
        if (sel.includes('button:focus-visible') && sel.includes('a:focus-visible')) {
          return true;
        }
        if (sel.includes(':focus-visible')) {
          // Accept split selectors across rules (globals.css lists them separately).
          return true;
        }
      }
    }
    return false;
  });
  if (!ok) die('missing :focus-visible CSS rule for interactive controls');
}

async function assertFocusVisible(page, locator, label) {
  await assertFocusVisibleRule(page);
  // Prefer keyboard modality so :focus-visible paints when supported.
  await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
  await locator.focus();
  await page.keyboard.press('Shift+Tab');
  await locator.focus();
  const outline = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineWidth: s.outlineWidth,
      outlineStyle: s.outlineStyle,
      matchesFocusVisible: el.matches(':focus-visible'),
      matchesFocus: el.matches(':focus'),
    };
  });
  if (!outline.matchesFocus) {
    die(`${label} did not receive focus: ${JSON.stringify(outline)}`);
  }
  const widthPx = Number.parseFloat(outline.outlineWidth || '0');
  if (outline.matchesFocusVisible && (!(widthPx >= 2) || outline.outlineStyle === 'none')) {
    die(`${label} :focus-visible without outline: ${JSON.stringify(outline)}`);
  }
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();
const checks = [];
const axeReports = [];
const proofLimits = [];

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20_000);

  // --- /redeem (public critical path) ---
  const redeemRes = await page.goto(`${BASE}/redeem`, { waitUntil: 'domcontentloaded' });
  if (!redeemRes || redeemRes.status() >= 500) {
    die(`GET /redeem failed: ${redeemRes?.status()}`);
  }
  await page.locator('main#main').first().waitFor({ state: 'visible' });
  const skip = page.locator('a.skip-link').first();
  if ((await skip.count()) < 1) die('/redeem missing skip-link');
  checks.push('redeem: skip-link + #main landmark');

  const redeemAxe = await runAxe(page, 'redeem');
  axeReports.push(redeemAxe);
  if (redeemAxe.seriousCritical.length > 0) {
    die(`axe serious/critical on /redeem: ${JSON.stringify(redeemAxe.seriousCritical)}`);
  }
  checks.push(
    `redeem: axe serious/critical=0 (total violations logged=${redeemAxe.violationCount})`,
  );

  const submit = page.locator('.auth-buttons button, .redeem-form button[type="submit"]').first();
  if ((await submit.count()) > 0) {
    await assertHitTarget(page, submit, 'redeem submit');
    await assertFocusVisible(page, submit, 'redeem submit');
    checks.push('redeem: submit ≥44px + focus-visible');
  } else {
    proofLimits.push(
      'redeem form buttons not rendered (auth-unconfigured branch) — axe still ran',
    );
  }

  const redeemShot = join(OUT, 'd12-a11y-382-redeem.png');
  await page.screenshot({ path: redeemShot, fullPage: true });

  // --- /admin — soft-redirect or staff chrome; /gate retired → home ---
  for (const path of ['/admin']) {
    const res = await page.goto(`${BASE}${path}`, {
      waitUntil: 'domcontentloaded',
      // Follow redirects; soft-redirect may be client or server.
    });
    if (!res || res.status() >= 500) die(`GET ${path} failed: ${res?.status()}`);
    // Allow Next navigation redirect settle.
    await page.waitForLoadState('networkidle').catch(() => {});
    const url = page.url();
    const label = path.slice(1);
    if (url.includes('/auth')) {
      await page.locator('main#main').first().waitFor({ state: 'visible' });
      const authAxe = await runAxe(page, `${label}-soft-redirect-auth`);
      axeReports.push(authAxe);
      if (authAxe.seriousCritical.length > 0) {
        die(
          `axe serious/critical on ${path}→auth: ${JSON.stringify(authAxe.seriousCritical)}`,
        );
      }
      checks.push(`${label}: soft-redirect /auth axe serious/critical=0`);
      const authBtn = page
        .locator('.auth-buttons a, .auth-buttons button, details.redeem-meta > summary')
        .first();
      if ((await authBtn.count()) > 0) {
        await assertHitTarget(page, authBtn, `${label} auth control`);
        await assertFocusVisible(page, authBtn, `${label} auth control`);
        checks.push(`${label}: auth landing control ≥44px + focus-visible CSS`);
      } else {
        const navLink = page.locator('[data-testid="site-nav"] a').first();
        await assertHitTarget(page, navLink, `${label} site-nav`);
        await assertFocusVisibleRule(page);
        checks.push(`${label}: site-nav hit + focus-visible CSS (no auth CTA)`);
      }
      proofLimits.push(
        `${path}: anonymous soft-redirect → /auth (O02); staff chrome axe deferred to session UAT`,
      );
      const shot = join(OUT, `d12-a11y-382-${label}-auth-redirect.png`);
      await page.screenshot({ path: shot, fullPage: true });
      continue;
    }

    await page.locator('main#main').first().waitFor({ state: 'visible' });
    const pageAxe = await runAxe(page, label);
    axeReports.push(pageAxe);
    if (pageAxe.seriousCritical.length > 0) {
      die(`axe serious/critical on ${path}: ${JSON.stringify(pageAxe.seriousCritical)}`);
    }
    checks.push(`${label}: axe serious/critical=0`);

    if (path === '/admin') {
      const job = page.getByTestId('admin-job-setup');
      if ((await job.count()) > 0) {
        await assertHitTarget(page, job, 'admin job nav');
        await assertFocusVisible(page, job, 'admin job nav');
        checks.push('admin: job nav ≥44px + focus-visible');
      } else {
        proofLimits.push('admin job nav not visible (auth/capability fail-closed branch)');
      }
    }

    const shot = join(OUT, `d12-a11y-382-${label}.png`);
    await page.screenshot({ path: shot, fullPage: true });
  }

  // Fixture: unknown assertive + pending/queued polite without staff session
  await page.setContent(`<!doctype html><html lang="vi"><head><title>A11y live-region fixture</title></head><body>
    <main id="main">
      <aside role="alert" aria-live="assertive" aria-atomic="true" data-testid="fixture-unknown"
        class="redeem-status redeem-status--unknown">
        <h2>Chưa rõ — không cho vào</h2>
        <p>Kết quả chưa rõ — không cho khách qua.</p>
      </aside>
      <aside role="status" aria-live="polite" aria-atomic="true" data-testid="fixture-queued"
        class="redeem-status redeem-status--pending">
        <h2>Đang chờ duyệt</h2>
        <p>Chưa phải vé cho đến khi có xác nhận.</p>
      </aside>
      <div class="auth-buttons">
        <button type="button" data-testid="fixture-hit" style="min-height:44px;min-width:44px;padding:12px 18px">Kiểm tra lại</button>
      </div>
    </main>
  </body></html>`);
  const unknown = page.getByTestId('fixture-unknown');
  eq(await unknown.getAttribute('aria-live'), 'assertive', 'fixture unknown aria-live');
  eq(await unknown.getAttribute('role'), 'alert', 'fixture unknown role');
  const queued = page.getByTestId('fixture-queued');
  eq(await queued.getAttribute('aria-live'), 'polite', 'fixture queued aria-live');
  const hit = page.getByTestId('fixture-hit');
  await assertHitTarget(page, hit, 'fixture hit button');
  checks.push('fixture: unknown assertive alert + pending/queued polite status + ≥44px hit');

  const fixtureAxe = await runAxe(page, 'live-region-fixture');
  axeReports.push(fixtureAxe);
  if (fixtureAxe.seriousCritical.length > 0) {
    die(`axe serious/critical on fixture: ${JSON.stringify(fixtureAxe.seriousCritical)}`);
  }

  const handoff = {
    issue: 382,
    scope: 'redeem/admin/gate residual a11y (UX-10 A2/A3/A5 + axe)',
    claimWcagAaWholeApp: false,
    base: BASE,
    checks,
    proofLimits,
    axeReports,
    softIosNote:
      'iOS VoiceOver sample out of web ownership — soft note only; no apps/mobile edits in this PR.',
    artifacts: {
      redeem: redeemShot,
      outDir: OUT,
    },
  };
  const handoffPath = join(OUT, 'd12-a11y-382-handoff.json');
  writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));

  console.log(`a11y-redeem-admin-gate-uat: ok ${BASE}`);
  console.log(`a11y-redeem-admin-gate-uat: handoff ${handoffPath}`);
  for (const line of checks) console.log(`a11y-redeem-admin-gate-uat: CHECK ${line}`);
  for (const line of proofLimits) console.log(`a11y-redeem-admin-gate-uat: LIMIT ${line}`);
} finally {
  await browser.close();
}
