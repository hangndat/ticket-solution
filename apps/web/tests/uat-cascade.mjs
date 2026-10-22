#!/usr/bin/env node
/**
 * Opt-in Playwright UAT: marketing interest Button disabled cascade (D-1 runtime).
 * Not run in CI — use `pnpm --filter @ticket/web uat:cascade` after production build.
 *
 *   WEB_UAT_PORT=3196 pnpm --filter @ticket/web uat:cascade
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = 3196;

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

async function main() {
  const buildId = join(WEB_ROOT, '.next', 'BUILD_ID');
  if (!existsSync(buildId)) {
    console.error(
      'uat-cascade: missing production build — run `pnpm --filter @ticket/web build` first',
    );
    process.exit(1);
  }

  const port = Number(process.env.WEB_UAT_PORT ?? DEFAULT_PORT);
  const reservation = createServer();
  reservation.listen(port, '127.0.0.1');
  await once(reservation, 'listening');
  await new Promise((resolve) => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;

  const child = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: WEB_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WEB_PUBLIC_ORIGIN: base,
        API_BASE_URL: 'http://127.0.0.1:1',
      },
    },
  );

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited early: ${output}`);
    }
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await setTimeout(100);
  }
  assert.ok(ready, output);

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${base}/marketing`, { waitUntil: 'domcontentloaded' });
    const submit = page.locator('[data-testid="interest-submit"]');
    await submit.waitFor({ state: 'visible' });

    const cascade = await submit.evaluate(async (el) => {
      const button = el;
      button.toggleAttribute('disabled', true);
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const opacity = getComputedStyle(button).opacity;
      const minHeight = getComputedStyle(button).minHeight;
      const pointerEvents = getComputedStyle(button).pointerEvents;
      return {
        opacity,
        minHeight,
        pointerEvents,
        hasUtilityMinH: button.className.includes('min-h-11'),
      };
    });

    assert.equal(
      cascade.pointerEvents,
      'none',
      'utilities disabled:pointer-events-none must beat legacy',
    );
    assert.ok(cascade.hasUtilityMinH, 'Button must ship primitive min-h-11 utilities');
    assert.ok(parseFloat(cascade.minHeight) >= 44, 'min-height from utilities should be ≥44px');
    assert.ok(
      parseFloat(cascade.opacity) <= 0.51,
      `utilities disabled:opacity-50 must beat legacy (got ${cascade.opacity})`,
    );
    console.log('uat-cascade: PASS', JSON.stringify(cascade));
  } finally {
    await browser.close();
    child.kill('SIGTERM');
    await setTimeout(500);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('uat-cascade: FAIL', err);
  process.exit(1);
});
