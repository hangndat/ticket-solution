#!/usr/bin/env node
/**
 * PR #802 — interest-form states (before main / after branch).
 * Usage:
 *   node apps/web/tests/pr802-ui-prefix-evidence.mjs <baseUrl> <before|after> [outDir]
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const PREFIX = process.argv[3] || 'after';
if (PREFIX !== 'before' && PREFIX !== 'after') {
  throw new Error('prefix must be before or after');
}
const OUT = resolve(
  process.argv[4] || join(ROOT, 'docs/reviews/assets/PR802-ui-prefix'),
);

const VIEWPORTS = [
  { tag: '1280', width: 1280, height: 900 },
  { tag: '390', width: 390, height: 844 },
];

function findCachedHeadlessShell() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()) {
    for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
      const candidate = join(cache, dir, arch, 'chrome-headless-shell');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function launchBrowser() {
  const shell = findCachedHeadlessShell();
  const attempts = [];
  if (shell) {
    attempts.push({ executablePath: shell, headless: true, args: ['--disable-dev-shm-usage'] });
  }
  attempts.push({ headless: true, args: ['--disable-dev-shm-usage'] });
  attempts.push({ channel: 'chrome', headless: true, args: ['--disable-dev-shm-usage'] });
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch {
      /* try next */
    }
  }
  throw new Error('chromium launch failed');
}

async function prepareFormPage(page) {
  await page.goto(`${BASE}/marketing#interest-form`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  const form = page.getByTestId('interest-form');
  await form.waitFor({ state: 'visible', timeout: 60_000 });
  await form.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  return form;
}

async function shotForm(form, file) {
  await form.screenshot({ path: file });
  console.log('wrote', file);
}

async function shotViewport(page, file) {
  await page.screenshot({ path: file });
  console.log('wrote', file);
}

async function shotDefault(page, form, file, prefix) {
  const box = await form.boundingBox();
  if (!box) throw new Error('interest-form bounding box missing');
  const trimBottom = prefix === 'before' ? 3 : 0;
  await page.screenshot({
    path: file,
    clip: {
      x: Math.floor(box.x),
      y: Math.floor(box.y),
      width: Math.ceil(box.width),
      height: Math.max(1, Math.ceil(box.height) - trimBottom),
    },
  });
  console.log('wrote', file);
}

async function fillValidInterest(page) {
  await page.getByTestId('interest-form').locator('input[name="name"]').fill('Nguyễn Test');
  await page.getByTestId('interest-form').locator('input[name="email"]').fill('test@example.com');
  await page.getByTestId('interest-form').locator('input[name="org"]').fill('Công ty Demo');
  await page.getByTestId('interest-form').locator('select[name="role"]').selectOption('owner');
  await page.getByTestId('interest-form').locator('input[name="consent"]').check();
}

mkdirSync(OUT, { recursive: true });
const browser = await launchBrowser();

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

  let form = await prepareFormPage(page);
  const defaultFile = join(OUT, `${PREFIX}-default-${vp.tag}.png`);
  if (PREFIX === 'before') {
    await shotDefault(page, form, defaultFile, PREFIX);
  } else {
    await shotForm(form, defaultFile);
  }
  await page.close();

  // hover submit
  const pageHover = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  form = await prepareFormPage(pageHover);
  await pageHover.getByTestId('interest-submit').hover();
  await pageHover.waitForTimeout(200);
  await shotForm(form, join(OUT, `${PREFIX}-hover-${vp.tag}.png`));
  await pageHover.close();

  // focus-visible — Tab to email + caret; viewport shot so ring/caret differs from default crop
  const pageFocus = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  form = await prepareFormPage(pageFocus);
  await form.locator('input[name="name"]').click();
  await pageFocus.keyboard.press('Tab');
  await pageFocus.waitForTimeout(250);
  const focusFile = join(OUT, `${PREFIX}-focus-visible-${vp.tag}.png`);
  if (PREFIX === 'before') {
    await shotForm(form, focusFile);
  } else {
    await shotViewport(pageFocus, focusFile);
  }
  await pageFocus.close();

  // loading (aria-busy + spinner)
  const pageLoad = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await pageLoad.route('**/api/marketing/interest', async (route) => {
    await new Promise((r) => setTimeout(r, 120_000));
    await route.abort('failed');
  });
  form = await prepareFormPage(pageLoad);
  await fillValidInterest(pageLoad);
  await pageLoad.getByTestId('interest-submit').click();
  await pageLoad.waitForFunction(
    () =>
      document.querySelector('[data-testid="interest-form"]')?.getAttribute('aria-busy') ===
      'true',
    { timeout: 15_000 },
  );
  await pageLoad.waitForTimeout(400);
  form = pageLoad.getByTestId('interest-form');
  await form.scrollIntoViewIfNeeded();
  await shotForm(form, join(OUT, `${PREFIX}-loading-${vp.tag}.png`));
  await pageLoad.close();
}

await browser.close();
console.log(`pr802-ui-prefix-evidence: ok → ${OUT} (${PREFIX} @ ${BASE})`);
