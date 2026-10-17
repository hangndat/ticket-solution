/**
 * Headless UAT — Gate offline/degraded banner + fail-closed (#113/#114).
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

  await page.getByTestId('gate-offline-shell').waitFor({ state: 'visible', timeout: 15_000 });

  // Online baseline: no offline banner
  const bannerOnline = page.getByTestId('gate-offline-banner');
  if (await bannerOnline.count()) {
    die('expected no offline banner while online');
  }

  await context.setOffline(true);
  const banner = page.getByTestId('gate-offline-banner');
  await banner.waitFor({ state: 'visible', timeout: 5_000 });
  const link = await banner.getAttribute('data-link');
  if (link !== 'offline') die(`expected data-link=offline, got ${link}`);
  const text = await banner.innerText();
  if (!/CHECKIN_OFFLINE/i.test(text) || !/iOS/i.test(text)) {
    die(`banner missing iOS/CHECKIN_OFFLINE guide: ${text.slice(0, 200)}`);
  }

  const confirmBtn = page.getByTestId('gate-confirm-submit');
  if (await confirmBtn.count()) {
    const disabled = await confirmBtn.isDisabled();
    if (!disabled) die('confirm submit should be disabled while offline');
  }

  mkdirSync(OUT, { recursive: true });
  const shot = join(OUT, `d7-gate-offline-${Date.now()}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  // Also capture via scripts/web-uat path-compatible name
  const curated = join(OUT, 'd7-gate-offline.png');
  await page.screenshot({ path: curated, fullPage: true });

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        gateStatus: res.status(),
        offlineBanner: true,
        link,
        guideMentionsCheckinOffline: true,
        screenshot: shot,
        curated,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
