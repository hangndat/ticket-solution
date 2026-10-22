#!/usr/bin/env node
/**
 * Production guest screenshots for deploy-prod-715c (no auth, no real data writes).
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT =
  process.env.PROD_UPLIFT_OUT_DIR ||
  join(ROOT, 'docs/reviews/assets/prod-uplift-2026-10-22');
mkdirSync(OUT, { recursive: true });

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

async function shot(page, fileName, fullPage = true) {
  const path = join(OUT, fileName);
  await page.screenshot({ path, fullPage });
  console.log('wrote', path);
}

const shell = findCachedHeadlessShell();
const browser = await chromium.launch(
  shell ? { executablePath: shell, headless: true } : { headless: true },
);

const desktop = { width: 1280, height: 900 };
const mobile = { width: 390, height: 844 };

// Marketing VI
for (const [vp, suffix] of [
  [desktop, '1280'],
  [mobile, '390'],
]) {
  const page = await browser.newPage();
  await page.setViewportSize(vp);
  await page.goto('https://vemoki.com/', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page.waitForSelector('[data-testid="product-preview-frame"]', {
    timeout: 60_000,
  }).catch(() => page.waitForLoadState('domcontentloaded'));
  await shot(page, `marketing-vi-${suffix}.png`);
  await page.close();
}

// Marketing EN
for (const [vp, suffix] of [
  [desktop, '1280'],
  [mobile, '390'],
]) {
  const page = await browser.newPage();
  await page.setViewportSize(vp);
  await page.goto('https://vemoki.com/en', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await shot(page, `marketing-en-${suffix}.png`);
  await page.close();
}

// Mobile nav open (VI)
{
  const page = await browser.newPage();
  await page.setViewportSize(mobile);
  await page.goto('https://vemoki.com/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const menuBtn = page.getByRole('button', { name: /menu|mở menu|navigation/i }).first();
  if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(400);
  } else {
    const alt = page.locator('[data-testid="marketing-mobile-menu-button"], button[aria-expanded]').first();
    if (await alt.count()) await alt.click();
  }
  await shot(page, 'marketing-vi-mobile-nav-open-390.png', false);
  await page.close();
}

// App catalog guest
for (const [vp, suffix] of [
  [desktop, '1280'],
  [mobile, '390'],
]) {
  const page = await browser.newPage();
  await page.setViewportSize(vp);
  await page.goto('https://app.vemoki.com/', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page.getByTestId('site-nav').waitFor({ timeout: 60_000 }).catch(() => {});
  await shot(page, `app-catalog-${suffix}.png`);
  await page.close();
}

// Public event detail
for (const [vp, suffix] of [
  [desktop, '1280'],
  [mobile, '390'],
]) {
  const page = await browser.newPage();
  await page.setViewportSize(vp);
  await page.goto('https://app.vemoki.com/t/mfest-demo/events/mfest', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  const sidebox = page.getByTestId('event-sidebox');
  if (await sidebox.count()) await sidebox.waitFor({ timeout: 30_000 });
  await shot(page, `event-detail-mfest-${suffix}.png`);
  await page.close();
}

// Redeem guest gate
for (const [vp, suffix] of [
  [desktop, '1280'],
  [mobile, '390'],
]) {
  const page = await browser.newPage();
  await page.setViewportSize(vp);
  await page.goto('https://app.vemoki.com/redeem', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page
    .locator('[data-testid="redeem-auth-gate"], aside.auth-unconfigured')
    .first()
    .waitFor({ timeout: 30_000 });
  await shot(page, `redeem-guest-gate-${suffix}.png`);
  await page.close();
}

// Privacy (app host)
for (const [vp, suffix] of [
  [desktop, '1280'],
  [mobile, '390'],
]) {
  const page = await browser.newPage();
  await page.setViewportSize(vp);
  await page.goto('https://app.vemoki.com/privacy', {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await shot(page, `privacy-${suffix}.png`);
  await page.close();
}

await browser.close();
console.log(`Done → ${OUT}`);
