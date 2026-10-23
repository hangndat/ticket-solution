#!/usr/bin/env node
/**
 * PR #826 attendee visual evidence (home/catalog, header, sheet) @390/@1280.
 * Usage:
 *   pnpm --filter @ticket/web start --port 3456 &
 *   node apps/web/scripts/pr826-attendee-evidence.mjs http://127.0.0.1:3456 before|after <sha>
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function die(msg, code = 1) {
  console.error(`pr826-attendee-evidence: ${msg}`);
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

async function settleAnimations(page) {
  await page.evaluate(async () => {
    const anims = document.getAnimations();
    if (anims.length) {
      await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    }
  });
  await page.waitForTimeout(1000);
}

async function gotoHome(page, base) {
  const res = await page.goto(`${base}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  if (!res || !res.ok()) die(`navigation failed / status=${res?.status()}`);
  await page.waitForSelector('[data-testid="site-header"]', { timeout: 60_000 });
  await page.evaluate(() => document.fonts?.ready);
  await settleAnimations(page);
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
    die('usage: node pr826-attendee-evidence.mjs <baseUrl> before|after <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR826'),
    `${phase}-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  const md5s = [];

  try {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoHome(page, base);

      md5s.push(await shot(page, join(outDir, `home-header-${vp.id}-${phase}.png`)));

      const catalog = page.getByTestId('home-catalog');
      if ((await catalog.count()) > 0) {
        await catalog.scrollIntoViewIfNeeded();
        await settleAnimations(page);
        md5s.push(await shot(page, join(outDir, `home-catalog-${vp.id}-${phase}.png`)));
      }

      const menuToggle = page.getByTestId('nav-menu-toggle');
      if (vp.width < 768 && (await menuToggle.count()) > 0) {
        await menuToggle.click();
        await page.waitForSelector('[data-testid="nav-mobile-menu"]', {
          state: 'visible',
          timeout: 15_000,
        });
        await settleAnimations(page);
        md5s.push(
          await shot(page, join(outDir, `nav-sheet-open-${vp.id}-${phase}.png`)),
        );
        await page.keyboard.press('Escape');
      }
    }
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
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
