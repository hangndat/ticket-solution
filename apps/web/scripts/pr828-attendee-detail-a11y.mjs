#!/usr/bin/env node
/**
 * PR #828 axe-core on event detail @390/@1280 (motion + reduced-motion).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axeCore from 'axe-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const EVENT_PATH = '/t/mfest-demo/events/mfest';

function die(msg, code = 1) {
  console.error(`pr828-attendee-detail-a11y: ${msg}`);
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

async function runAxe(page) {
  await page.addScriptTag({ content: `${axeCore.source}` });
  return page.evaluate(async () => {
    // @ts-expect-error axe injected
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    return {
      violationCount: results.violations.length,
      seriousCritical: serious.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
      })),
    };
  });
}

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const sha = process.argv[3];
  if (!base || !sha) {
    die('usage: node pr828-attendee-detail-a11y.mjs <baseUrl> <sha>');
  }
  const outDir = resolve(
    join(ROOT, 'docs/reviews/assets/PR828'),
    `a11y-${sha.slice(0, 12)}`,
  );
  mkdirSync(outDir, { recursive: true });

  const shell = findCachedHeadlessShell();
  if (!shell) die('Playwright headless shell not found');
  const browser = await chromium.launch({
    executablePath: shell,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const reports = [];

  try {
    for (const motion of ['default', 'reduce']) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext(
          motion === 'reduce' ? { reducedMotion: 'reduce' } : {},
        );
        const page = await context.newPage();
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const res = await page.goto(`${base}${EVENT_PATH}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120_000,
        });
        if (!res?.ok()) die(`event detail navigation failed status=${res?.status()}`);
        await page.waitForSelector('[data-testid="event-published"]', {
          timeout: 60_000,
        });
        await settleAnimations(page);
        const axe = await runAxe(page);
        reports.push({ motion, viewport: vp.id, ...axe });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const seriousTotal = reports.reduce(
    (n, r) => n + r.seriousCritical.length,
    0,
  );
  writeFileSync(
    join(outDir, 'axe-summary.json'),
    JSON.stringify({ sha, path: EVENT_PATH, reports, seriousTotal }, null, 2),
  );
  if (seriousTotal > 0) {
    die(`axe serious/critical = ${seriousTotal}`);
  }
  console.log(`axe ok serious/critical=0 → ${outDir}/axe-summary.json`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
