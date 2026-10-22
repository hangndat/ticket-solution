#!/usr/bin/env node
/**
 * Epic #770 — attendee footer stick + marketing CLS / mobile overflow.
 *
 * Usage:
 *   pnpm --filter @ticket/web start &
 *   node apps/web/tests/fe-layout-regression.mjs [baseUrl]
 *
 * Env: FE_UAT_WEB_URL, WEB_UAT_EXECUTABLE (optional headless shell path)
 * Local stack: WEB_PUBLIC_ORIGIN=http://localhost:3000; demo strip: NEXT_PUBLIC_DEMO_DATA_STRIP=1.
 * Omit localhost from MARKETING_HOSTS so /redeem serves locally (localhost+product path → prod redirect).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT =
  process.env.WEB_UAT_OUT_DIR ||
  join(ROOT, 'docs/reviews/assets/fe-header-mobile-fix-2026-10-22');
const BASE = (
  process.argv[2] ||
  process.env.FE_UAT_WEB_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const FOOTER_GAP_MAX_PX = 2;
const CLS_MAX = 0.08;
const HEADER_ROW_TOP_MAX_PX = 2;
const HEADER_BUTTON_CENTER_MAX_PX = 1;

const ATTENDEE_CASES = [
  { id: 'privacy', path: '/privacy', ready: '[data-testid="site-footer"]' },
  { id: 'redeem', path: '/redeem', ready: '[data-testid="site-footer"]' },
  { id: 'wallet-guest', path: '/wallet', ready: '[data-testid="wallet-need-login"]' },
  {
    id: 'account-guest',
    path: '/account',
    ready: '[data-testid="account-session-signed-out"]',
  },
  { id: 'claim', path: '/claim', ready: '[data-testid="site-footer"]' },
  {
    id: 'not-found',
    path: '/__fe-layout-404-test__',
    ready: '[data-testid="route-not-found"]',
  },
];

const ATTENDEE_WIDTHS = [1280, 390, 360, 320];
const MARKETING_WIDTHS = [1280, 390, 360, 320];

function die(msg, code = 1) {
  console.error(`fe-layout-regression: ${msg}`);
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
  const opts = shell
    ? {
        executablePath: shell,
        headless: true,
        args: ['--disable-dev-shm-usage'],
      }
    : { headless: true, args: ['--disable-dev-shm-usage'] };
  return chromium.launch(opts);
}

async function measureFooterGap(page) {
  return page.evaluate(() => {
    const footer = document.querySelector('[data-testid="site-footer"]');
    if (!footer) return { ok: false, reason: 'no-footer' };
    const rect = footer.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const scrollHeight = document.documentElement.scrollHeight;
    const shortPage = scrollHeight <= viewportH + 2;
    const gapPx = shortPage
      ? Math.round((viewportH - rect.bottom) * 100) / 100
      : null;
    return {
      ok: true,
      shortPage,
      gapPx,
      scrollHeight,
      footerBottom: Math.round(rect.bottom * 100) / 100,
      viewportH,
    };
  });
}

async function measureOverflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    pass: document.documentElement.scrollWidth <= window.innerWidth + 1,
  }));
}

async function measureMarketingLoadCls(page, path) {
  await page.goto(`${BASE}${path}`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page.waitForSelector('[data-testid="marketing-surface"]');
  await page.evaluate(() => document.fonts?.ready);
  return page.evaluate(() =>
    performance
      .getEntriesByType('layout-shift')
      .filter((e) => !e.hadRecentInput)
      .reduce((sum, e) => sum + e.value, 0),
  );
}

async function heroBlockHeight(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.mkt-hero-copy');
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().height);
  });
}

async function measureMarketingHeaderRow(page) {
  return page.evaluate(
    ({ topMax, centerMax }) => {
      const header = document.querySelector('[data-testid="mkt-header"]');
      if (!header) return { ok: false, reason: 'no-header' };

      const isVis = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          el.getClientRects().length > 0
        );
      };

      const rowNodes = [
        header.querySelector('[data-testid="mkt-wordmark"]'),
        ...header.querySelectorAll('[data-testid="mkt-nav"] > *'),
      ].filter(isVis);

      const tops = rowNodes.map((el) =>
        Math.round(el.getBoundingClientRect().top),
      );
      const maxTopDelta =
        tops.length > 1 ? Math.max(...tops) - Math.min(...tops) : 0;

      const toggle = header.querySelector('[data-testid="mkt-nav-menu-toggle"]');
      let labelCenterDelta = null;
      if (isVis(toggle)) {
        const tr = toggle.getBoundingClientRect();
        const label = toggle.querySelector('.mkt-nav-menu-toggle__label');
        const lr = (label ?? toggle).getBoundingClientRect();
        labelCenterDelta =
          Math.round(
            Math.abs(tr.top + tr.height / 2 - (lr.top + lr.height / 2)) * 100,
          ) / 100;
      }

      const pass =
        maxTopDelta <= topMax &&
        (labelCenterDelta === null || labelCenterDelta <= centerMax);

      return {
        ok: true,
        visibleCount: rowNodes.length,
        maxTopDelta,
        labelCenterDelta,
        pass,
      };
    },
    {
      topMax: HEADER_ROW_TOP_MAX_PX,
      centerMax: HEADER_BUTTON_CENTER_MAX_PX,
    },
  );
}

async function measureSiteHeaderRow(page) {
  return page.evaluate(
    ({ topMax, centerMax }) => {
      const nav = document.querySelector('[data-testid="site-nav"]');
      if (!nav) {
        return { ok: true, pass: true, skipped: 'no-site-chrome' };
      }

      const isVis = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          el.getClientRects().length > 0
        );
      };

      const rowNodes = [...nav.children].filter(isVis);

      const tops = rowNodes.map((el) =>
        Math.round(el.getBoundingClientRect().top),
      );
      const maxTopDelta =
        tops.length > 1 ? Math.max(...tops) - Math.min(...tops) : 0;

      const toggle = nav.querySelector('[data-testid="nav-menu-toggle"]');
      let labelCenterDelta = null;
      if (isVis(toggle)) {
        const tr = toggle.getBoundingClientRect();
        const label = toggle.querySelector('.nav-menu-toggle__label');
        const lr = (label ?? toggle).getBoundingClientRect();
        labelCenterDelta =
          Math.round(
            Math.abs(tr.top + tr.height / 2 - (lr.top + lr.height / 2)) * 100,
          ) / 100;
      }

      const pass =
        maxTopDelta <= topMax &&
        (labelCenterDelta === null || labelCenterDelta <= centerMax);

      return {
        ok: true,
        visibleCount: rowNodes.length,
        maxTopDelta,
        labelCenterDelta,
        pass,
      };
    },
    {
      topMax: HEADER_ROW_TOP_MAX_PX,
      centerMax: HEADER_BUTTON_CENTER_MAX_PX,
    },
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const results = {
    capturedAt: new Date().toISOString(),
    base: BASE,
    attendee: [],
    marketing: [],
    ok: true,
  };

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  try {
    for (const width of ATTENDEE_WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      for (const caseDef of ATTENDEE_CASES) {
        const url = `${BASE}${caseDef.path}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForSelector(caseDef.ready, {
          timeout: 60_000,
          state: 'attached',
        });
        await page.evaluate(() => document.fonts?.ready);

        let headerRow = null;
        if (width <= 390) {
          await page
            .waitForSelector('[data-testid="site-wordmark"]', {
              state: 'visible',
              timeout: 60_000,
            })
            .catch(() => undefined);
          await page.evaluate(() => window.scrollTo(0, 0));
          headerRow = await measureSiteHeaderRow(page);
        }

        if (caseDef.ready.includes('site-footer')) {
          await page
            .locator(caseDef.ready)
            .scrollIntoViewIfNeeded({ timeout: 15_000 })
            .catch(() => undefined);
        }

        const footer = await measureFooterGap(page);
        const overflow = await measureOverflow(page);
        const shot = join(OUT, `attendee-${caseDef.id}-${width}.png`);
        await page.screenshot({ path: shot, fullPage: false });

        const footerPass =
          footer.ok &&
          (!footer.shortPage ||
            (footer.gapPx !== null && footer.gapPx <= FOOTER_GAP_MAX_PX));
        const headerPass =
          headerRow ? headerRow.pass !== false : true;
        const pass = footerPass && overflow.pass && headerPass;
        if (!pass) results.ok = false;

        results.attendee.push({
          case: caseDef.id,
          width,
          footer,
          overflow,
          headerRow,
          pass,
          shot,
        });
        console.log(
          pass ? 'PASS' : 'FAIL',
          `attendee ${caseDef.id} @${width}`,
          footer,
          overflow,
          headerRow ?? 'header-skip',
        );
      }
    }

    for (const width of MARKETING_WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      for (const localePath of ['/marketing', '/marketing/en']) {
        const locale = localePath.endsWith('/en') ? 'en' : 'vi';
        await page.goto(`${BASE}${localePath}`, {
          waitUntil: 'networkidle',
          timeout: 120_000,
        });
        await page.waitForSelector('[data-testid="marketing-surface"]', {
          timeout: 60_000,
        });
        await page.evaluate(() => document.fonts?.ready);
        const overflow = await measureOverflow(page);
        let headerRow = null;
        if (width <= 390) {
          await page.evaluate(() => window.scrollTo(0, 0));
          headerRow = await measureMarketingHeaderRow(page);
        }
        const heroH = await heroBlockHeight(page);
        const shot = join(OUT, `marketing-${locale}-${width}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        const headerPass =
          headerRow ? headerRow.pass !== false : true;
        const pass = overflow.pass && headerPass;
        if (!pass) results.ok = false;
        results.marketing.push({
          locale,
          width,
          overflow,
          headerRow,
          heroCopyHeightPx: heroH,
          pass,
          shot,
        });
        console.log(
          pass ? 'PASS' : 'FAIL',
          `marketing ${locale} @${width}`,
          overflow,
          headerRow ?? 'header-skip',
          `heroCopy=${heroH}px`,
        );
      }
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    const viHero = await (async () => {
      await page.goto(`${BASE}/marketing`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="hero-headline"]');
      return heroBlockHeight(page);
    })();
    const enHero = await (async () => {
      await page.goto(`${BASE}/marketing/en`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="hero-headline"]');
      return heroBlockHeight(page);
    })();
    const heroDelta = Math.abs((viHero ?? 0) - (enHero ?? 0));
    const heroStable = heroDelta <= 72;
    if (!heroStable) results.ok = false;
    results.marketingHeroHeights = { vi: viHero, en: enHero, deltaPx: heroDelta, pass: heroStable };

    await page.setViewportSize({ width: 1280, height: 800 });
    const clsVi = await measureMarketingLoadCls(page, '/marketing');
    const clsEn = await measureMarketingLoadCls(page, '/marketing/en');
    const clsPass = clsVi <= CLS_MAX && clsEn <= CLS_MAX;
    if (!clsPass) results.ok = false;
    results.marketingLoadCls = {
      vi: clsVi,
      en: clsEn,
      pass: clsPass,
      max: CLS_MAX,
    };

    const menuWidths = [390, 360, 320];
    for (const width of menuWidths) {
      await page.setViewportSize({ width, height: 844 });
      for (const localePath of ['/marketing', '/marketing/en']) {
        const locale = localePath.endsWith('/en') ? 'en' : 'vi';
        await page.goto(`${BASE}${localePath}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120_000,
        });
        await page.waitForSelector('[data-testid="mkt-nav-menu-toggle"]', {
          state: 'visible',
        });
        await page.click('[data-testid="mkt-nav-menu-toggle"]');
        await page.waitForSelector('[data-testid="mkt-nav-mobile-menu"]', {
          state: 'visible',
        });
        const shot = join(OUT, `marketing-${locale}-${width}-menu-open.png`);
        await page.screenshot({ path: shot, fullPage: false });
        results.marketingMenuShots = results.marketingMenuShots ?? [];
        results.marketingMenuShots.push({ locale, width, shot });
      }

      await page.goto(`${BASE}/wallet`, {
        waitUntil: 'domcontentloaded',
        timeout: 120_000,
      });
      await page.waitForSelector('[data-testid="nav-menu-toggle"]', {
        state: 'visible',
      });
      await page.click('[data-testid="nav-menu-toggle"]');
      await page.waitForSelector('[data-testid="nav-mobile-menu"]', {
        state: 'visible',
      });
      const appShot = join(OUT, `attendee-wallet-guest-${width}-menu-open.png`);
      await page.screenshot({ path: appShot, fullPage: false });
      results.attendeeMenuShots = results.attendeeMenuShots ?? [];
      results.attendeeMenuShots.push({ width, shot: appShot });
    }

    const jsonPath = join(OUT, 'results.json');
    writeFileSync(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
    console.log('wrote', jsonPath);

    if (!results.ok) die('one or more layout checks failed');
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
