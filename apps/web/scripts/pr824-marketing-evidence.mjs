#!/usr/bin/env node
/**
 * PR #824 marketing visual evidence (VI/EN, 390/1280, key states).
 * Usage:
 *   MARKETING_HOSTS='vemoki.com,www.vemoki.com,127.0.0.1,localhost' \
 *   pnpm --filter @ticket/web start --port 3456 &
 *   node apps/web/scripts/pr824-marketing-evidence.mjs http://127.0.0.1:3456 after <sha> [outRoot]
 *
 * Fails on any Playwright/navigation error (lesson #821 F01).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function die(msg, code = 1) {
  console.error(`pr824-marketing-evidence: ${msg}`);
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

const LOCALES = [
  { id: 'vi', path: '/marketing' },
  { id: 'en', path: '/marketing/en' },
];

async function gotoMarketing(page, base, localePath) {
  const res = await page.goto(`${base}${localePath}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (!res || !res.ok()) die(`navigation failed ${localePath} status=${res?.status()}`);
  await page.waitForSelector('[data-testid="marketing-surface"]', { timeout: 60_000 });
  await page.evaluate(() => document.fonts?.ready);
}

async function shot(page, file) {
  await page.screenshot({ path: file, fullPage: false });
  const md5 = createHash('md5').update(readFileSync(file)).digest('hex');
  writeFileSync(`${file}.md5.txt`, `${md5}\n`);
  console.log(`captured ${file} md5=${md5}`);
  return md5;
}

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const phase = process.argv[3];
  const sha = process.argv[4];
  if (!base || !phase || !sha) {
    die('usage: node pr824-marketing-evidence.mjs <baseUrl> before|after <sha> [outRoot]');
  }
  const outDir = resolve(
    process.argv[5] ?? join(ROOT, 'docs/reviews/assets/PR824'),
    `${phase}-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'x-forwarded-host': 'vemoki.com',
    },
  });
  const page = await context.newPage();
  const md5s = [];

  try {
    for (const locale of LOCALES) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoMarketing(page, base, locale.path);

        md5s.push(
          await shot(
            page,
            join(outDir, `hero-${locale.id}-${vp.id}-${phase}.png`),
          ),
        );

        const menuToggle = page.getByTestId('mkt-nav-menu-toggle');
        if (vp.width < 500 && (await menuToggle.count()) > 0) {
          await menuToggle.click();
          await page.waitForSelector('[data-testid="mkt-nav-mobile-menu"]', {
            state: 'visible',
            timeout: 15_000,
          });
          md5s.push(
            await shot(
              page,
              join(outDir, `nav-sheet-open-${locale.id}-${vp.id}-${phase}.png`),
            ),
          );
          await page.keyboard.press('Escape');
        }

        await page.locator('#interest').scrollIntoViewIfNeeded();
        md5s.push(
          await shot(
            page,
            join(outDir, `interest-default-${locale.id}-${vp.id}-${phase}.png`),
          ),
        );

        const submit = page.getByTestId('interest-submit');
        if ((await submit.count()) > 0) {
          await submit.evaluate((el) => {
            el.setAttribute('disabled', '');
            el.setAttribute('aria-disabled', 'true');
          });
          md5s.push(
            await shot(
              page,
              join(outDir, `interest-disabled-${locale.id}-${vp.id}-${phase}.png`),
            ),
          );
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
    console.warn(`warning: ${md5s.length - unique.size} duplicate md5 among captures`);
  }
  console.log(`done ${outDir} (${md5s.length} images)`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
