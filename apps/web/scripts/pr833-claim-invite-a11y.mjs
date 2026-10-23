#!/usr/bin/env node
/** PR #833 — axe on /claim and /invite @390/@1280 (default + reduced motion). */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axeCore from 'axe-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ROUTES = ['/claim', '/invite'];
const VIEWPORTS = [
  { id: '390', width: 390, height: 844 },
  { id: '1280', width: 1280, height: 900 },
];

function die(msg, code = 1) {
  console.error(`pr833-claim-invite-a11y: ${msg}`);
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

async function settleAnimations(page) {
  await page.evaluate(async () => {
    const anims = document.getAnimations();
    if (anims.length) {
      await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    }
  });
  await page.waitForTimeout(1000);
}

async function runAxe(page) {
  await page.addScriptTag({ content: `${axeCore.source}` });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    return { seriousCount: serious.length, serious };
  });
}

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const sha = process.argv[3];
  if (!base || !sha) die('usage: node pr833-claim-invite-a11y.mjs <baseUrl> <sha>');
  const outDir = resolve(join(ROOT, 'docs/reviews/assets/PR833'), `a11y-${sha.slice(0, 12)}`);
  mkdirSync(outDir, { recursive: true });
  const shell = findCachedHeadlessShell();
  if (!shell) die('Playwright headless shell not found');
  const browser = await chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const summary = [];
  try {
    for (const route of ROUTES) {
      for (const reduced of [false, true]) {
        const context = await browser.newContext(
          reduced ? { reducedMotion: 'reduce' } : {},
        );
        const page = await context.newPage();
        await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await page.waitForSelector('#main', { timeout: 60_000 });
        await settleAnimations(page);
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await settleAnimations(page);
          const axe = await runAxe(page);
          summary.push({
            route,
            viewport: vp.id,
            reducedMotion: reduced,
            seriousCount: axe.seriousCount,
          });
          if (axe.seriousCount > 0) {
            writeFileSync(
              join(outDir, `axe-${route.slice(1)}-${vp.id}-${reduced ? 'reduce' : 'motion'}.json`),
              JSON.stringify(axe.serious, null, 2),
            );
          }
        }
        await context.close();
      }
    }
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    const maxSerious = Math.max(...summary.map((s) => s.seriousCount));
    if (maxSerious > 0) die(`axe serious/critical violations: ${maxSerious}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => die(e?.message ?? String(e)));
