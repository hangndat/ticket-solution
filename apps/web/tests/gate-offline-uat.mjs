/**
 * Headless UAT — Gate offline/degraded banner + fail-closed (D11 #232 / AC-G4).
 * Usage: node apps/web/tests/gate-offline-uat.mjs [baseUrl]
 *
 * Uses Playwright offline mode — never steals the macOS mouse.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.env.WEB_UAT_OUT_DIR || join(ROOT, 'apps/web/.uat-artifacts');
// Prefer localhost in Next 16 dev — 127.0.0.1 can block /_next client hydration.
const BASE = (process.argv[2] || process.env.WEB_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

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

async function launch() {
  const headed = process.env.WEB_UAT_HEADED === '1';
  const args = headed ? [] : ['--disable-dev-shm-usage'];
  const shell = headed ? null : findCachedHeadlessShell();
  const attempts = [];
  if (shell) attempts.push({ executablePath: shell, headless: true, args });
  attempts.push({ headless: !headed, args });
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('could not launch Chromium');
}

function die(msg) {
  console.error(`gate-offline-uat: ${msg}`);
  process.exit(1);
}

const browser = await launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const res = await page.goto(`${BASE}/gate`, { waitUntil: 'networkidle' });
  if (!res || res.status() >= 500) {
    die(`GET /gate failed: ${res?.status()}`);
  }
  // O02 (#371): anonymous soft-redirect → /auth; offline shell needs staff session.
  if (page.url().includes('/auth')) {
    mkdirSync(OUT, { recursive: true });
    const shot = join(OUT, 'd11-gate-soft-redirect-auth.png');
    await page.screenshot({ path: shot, fullPage: true });
    console.log(
      'gate-offline-uat: O02 soft-redirect anonymous /gate → /auth (skip offline shell — needs staff session)',
    );
    console.log(`gate-offline-uat: screenshot ${shot}`);
    process.exit(0);
  }

  await page.getByTestId('gate-offline-shell').waitFor({ state: 'visible', timeout: 15_000 });

  // Online baseline: no offline banner; context shows Trực tuyến when form is present
  const bannerOnline = page.getByTestId('gate-offline-banner');
  if (await bannerOnline.count()) {
    die('expected no offline banner while online');
  }

  mkdirSync(OUT, { recursive: true });
  const onlineShot = join(OUT, 'd11-gate-online.png');
  await page.screenshot({ path: onlineShot, fullPage: true });

  await context.setOffline(true);
  const banner = page.getByTestId('gate-offline-banner');
  await banner.waitFor({ state: 'visible', timeout: 5_000 });
  const link = await banner.getAttribute('data-link');
  if (link !== 'offline') die(`expected data-link=offline, got ${link}`);
  const text = await banner.innerText();
  if (!/Cổng web offline/i.test(text) || !/Không xếp hàng trên web/i.test(text)) {
    die(`banner missing PD offline copy: ${text.slice(0, 200)}`);
  }
  if (/CHECKIN_OFFLINE|ADR-18|#105/.test(text)) {
    die(`banner still has technical jargon: ${text.slice(0, 200)}`);
  }

  const confirmBtn = page.getByTestId('gate-confirm-submit');
  if (await confirmBtn.count()) {
    const disabled = await confirmBtn.isDisabled();
    if (!disabled) die('confirm submit should be disabled while offline');
  }

  const sessionBtn = page.getByTestId('gate-session-submit');
  if (await sessionBtn.count()) {
    const disabled = await sessionBtn.isDisabled();
    if (!disabled) die('session submit should be disabled while offline');
  }

  // No fake iOS queue UI on web
  const bodyText = await page.locator('body').innerText();
  if (/Đã xếp hàng — chờ đồng bộ|CHECKIN_OFFLINE queue/i.test(bodyText)) {
    die('web Gate must not fake iOS offline queue UI');
  }

  const shot = join(OUT, `d11-gate-offline-${Date.now()}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  const curated = join(OUT, 'd11-gate-offline.png');
  await page.screenshot({ path: curated, fullPage: true });

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        gateStatus: res.status(),
        offlineBanner: true,
        link,
        plainViCopy: true,
        noFakeQueue: true,
        screenshots: { online: onlineShot, offline: curated, stamped: shot },
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
