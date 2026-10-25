#!/usr/bin/env node
/**
 * VD09 portal brand evidence — local only (Playwright + production server).
 *   pnpm --filter @ticket/portal start   # separate terminal, or let script spawn
 *   node apps/portal/tests/evidence-vd09-brand/capture-screenshots.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = HERE;
const PORTAL = (process.env.PORTAL_EVIDENCE_BASE || 'http://127.0.0.1:3013').replace(
  /\/$/,
  '',
);
const ROOT = resolve(HERE, '../../..');

const TENANTS = {
  items: [
    {
      tenantId: 't-evidence',
      slug: 'evidence',
      name: 'Evidence Org',
      status: 'ACTIVE',
      role: 'Owner',
      tenantPermissions: ['event.list'],
    },
  ],
};

const EVENTS = {
  staffEligible: true,
  items: [
    {
      tenantId: 't-evidence',
      eventId: 'e-evidence',
      name: 'Evidence Event',
      permissions: ['event.read', 'gate.confirm'],
    },
  ],
};

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`portal not reachable at ${url}`);
}

function maybeSpawnServer() {
  if (process.env.PORTAL_EVIDENCE_NO_SPAWN === '1') return null;
  const child = spawn('pnpm', ['--filter', '@ticket/portal', 'start'], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env },
  });
  return child;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = maybeSpawnServer();
  await waitForServer(`${PORTAL}/auth`);

  const { chromium } = await import('playwright');
  const executablePath = process.env.WEB_UAT_EXECUTABLE || undefined;
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ colorScheme: 'light' });

  const authViewports = [
    { name: 'auth-1440', width: 1440, height: 900 },
    { name: 'auth-390', width: 390, height: 844 },
  ];

  for (const vp of authViewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${PORTAL}/auth`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.portal-brand-mark', { timeout: 15_000 });
    await page.screenshot({ path: join(OUT, `${vp.name}.png`), fullPage: true });
    await page.close();
  }

  await context.route('**/api/bff/me/tenants', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TENANTS) }),
  );
  await context.route('**/api/bff/me/events', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EVENTS) }),
  );
  await context.route('**/api/bff/platform/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );

  const shellPage = await context.newPage();

  const shellViewports = [
    { name: 'shell-1440', width: 1440, height: 900 },
    { name: 'shell-390', width: 390, height: 844 },
  ];

  for (const vp of shellViewports) {
    await shellPage.setViewportSize({ width: vp.width, height: vp.height });
    await shellPage.goto(`${PORTAL}/account/security`, { waitUntil: 'domcontentloaded' });
    await shellPage.waitForSelector('[data-testid="portal-brand"]', {
      state: 'visible',
      timeout: 30_000,
    });
    await shellPage.waitForTimeout(500);
    await shellPage.screenshot({ path: join(OUT, `${vp.name}.png`), fullPage: true });
  }

  const favRes = await fetch(`${PORTAL}/favicon.ico`);
  const favBuf = Buffer.from(await favRes.arrayBuffer());
  writeFileSync(join(OUT, 'favicon.ico'), favBuf);

  await shellPage.close();
  await browser.close();
  if (server) server.kill('SIGTERM');

  writeFileSync(
    join(OUT, 'README.md'),
    `# VD09 portal brand evidence

Captured against \`${PORTAL}\` with mocked BFF for authenticated shell.

- auth-1440.png / auth-390.png — \`/auth\` login card with V mark
- shell-1440.png / shell-390.png — home shell header via route mocks
- favicon.ico — copied from live \`/favicon.ico\`
`,
  );
  console.log(`evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
