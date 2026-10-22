import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium, type Browser } from 'playwright';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function findCachedHeadlessShell(): string | null {
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

async function launchBrowser(): Promise<Browser> {
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

test('globals wires legacy CSS into @layer legacy before utilities', () => {
  const globals = readFileSync(join(WEB_ROOT, 'app/globals.css'), 'utf8');
  assert.match(globals, /@layer theme, base, legacy, components, utilities;/);
  assert.match(globals, /@import '\.\/live-pulse-legacy\.css' layer\(legacy\);/);
  assert.match(globals, /@import '\.\/attendee-uplift\.css' layer\(legacy\);/);
  const marketingLegacy = readFileSync(
    join(WEB_ROOT, 'app/marketing-uplift-legacy.css'),
    'utf8',
  );
  assert.match(
    marketingLegacy,
    /@import '\.\/marketing-uplift\.css' layer\(legacy\);/,
  );
});

test('production marketing interest Button keeps utility disabled opacity over legacy', async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const addr = reservation.address();
  assert.ok(addr && typeof addr !== 'string');
  const port = addr.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
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
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
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
      const button = el as HTMLButtonElement;
      button.toggleAttribute('disabled', true);
      await new Promise<void>((resolve) => {
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
  } finally {
    await browser.close();
    child.kill('SIGTERM');
    await setTimeout(500);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
});
