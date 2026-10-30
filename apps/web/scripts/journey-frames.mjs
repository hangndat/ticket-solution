#!/usr/bin/env node
/**
 * Cinematic journey design frames (desktop / mobile / short landscape, key scroll
 * positions + reduced-motion full page). Design artefacts only — UAT runs in the
 * Orca browser per .cursor/rules/uat-headless.mdc.
 * Usage: node apps/web/scripts/journey-frames.mjs http://127.0.0.1:3010 [outDir] [path]
 * Fails on page errors, failed requests or console errors.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:3010';
const out = resolve(process.argv[3] ?? 'docs/design/cinematic-journey/frames');
const path = process.argv[4] ?? '/marketing/journey';
const STOPS = [0, 0.24, 0.47, 0.53, 0.58, 0.6, 0.7, 0.8, 0.95];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { name: 'landscape', width: 844, height: 390, isMobile: true, deviceScaleFactor: 2 },
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems = [];
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, deviceScaleFactor: vp.deviceScaleFactor ?? 1 });
  page.on('pageerror', (e) => problems.push(`${vp.name} pageerror ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`${vp.name} console ${m.text()}`));
  page.on('requestfailed', (r) => problems.push(`${vp.name} requestfailed ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${vp.name} ${r.status()} ${r.url()}`));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/${vp.name}-reduced-full.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload({ waitUntil: 'networkidle' });
  const track = await page.evaluate(() => {
    const el = document.querySelector('[data-journey] [data-live]');
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: el.offsetHeight - window.innerHeight };
  });
  for (const stop of STOPS) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(track.top + track.height * stop));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${vp.name}-${String(Math.round(stop * 100)).padStart(3, '0')}.png` });
  }
  await page.close();
}
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`frames → ${out}`);
