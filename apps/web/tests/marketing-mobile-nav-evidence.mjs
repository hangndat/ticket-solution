/**
 * PR #779 — mobile nav disclosure evidence @ 390 (VI+EN, menu open/closed).
 * Usage: MARKETING_HOSTS='vemoki.com,www.vemoki.com,127.0.0.1,localhost' \
 *   pnpm exec next start --port 3456 & \
 *   node apps/web/tests/marketing-mobile-nav-evidence.mjs http://127.0.0.1:3456
 */
import { existsSync, readdirSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

function findCachedHeadlessShell() {
  if (process.env.WEB_UAT_EXECUTABLE) return process.env.WEB_UAT_EXECUTABLE;
  const cache = path.join(homedir(), 'Library/Caches/ms-playwright');
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
      const candidate = path.join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  const opts = shell
    ? {
        executablePath: shell,
        headless: true,
        args: ['--disable-dev-shm-usage'],
      }
    : { headless: true, args: ['--disable-dev-shm-usage'] };
  return chromium.launch(opts);
}

const base =
  process.argv[2]?.replace(/\/$/, '') ?? 'http://127.0.0.1:3456';
const outDir = path.resolve(
  process.cwd(),
  'docs/reviews/assets/PR779-marketing-uplift/after-local',
);

const shots = [
  {
    name: 'vi-mobile-390-nav-closed',
    path: '/marketing',
    locale: 'vi',
    openMenu: false,
  },
  {
    name: 'vi-mobile-390-nav-open',
    path: '/marketing',
    locale: 'vi',
    openMenu: true,
  },
  {
    name: 'en-mobile-390-nav-closed',
    path: '/marketing/en',
    locale: 'en',
    openMenu: false,
  },
  {
    name: 'en-mobile-390-nav-open',
    path: '/marketing/en',
    locale: 'en',
    openMenu: true,
  },
];

await mkdir(outDir, { recursive: true });

const browser = await launchBrowser();
for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await page.setExtraHTTPHeaders({
    'x-forwarded-host': 'vemoki.com',
  });
  await page.goto(`${base}${shot.path}`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page.waitForSelector('[data-testid="mkt-nav-menu-toggle"]', {
    timeout: 60_000,
  });
  if (shot.openMenu) {
    await page.getByTestId('mkt-nav-menu-toggle').click();
    await page.waitForSelector('[data-testid="mkt-nav-mobile-menu"]', {
      state: 'visible',
      timeout: 10_000,
    });
  }
  const file = path.join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote', file);
  await page.close();
}
await browser.close();
