#!/usr/bin/env node
/**
 * VD10 portal design-system evidence (theme + forms).
 *   pnpm --filter @ticket/portal build && pnpm --filter @ticket/portal start
 *   node apps/portal/tests/evidence-vd10/capture-screenshots.mjs
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
const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';

const TENANTS = {
  items: [
    {
      tenantId: TENANT,
      slug: 'evidence',
      name: 'Evidence Org',
      status: 'ACTIVE',
      role: 'Owner',
      tenantPermissions: ['event.list', 'tenant.settings'],
    },
  ],
};

const EVENTS = {
  staffEligible: true,
  items: [
    {
      tenantId: TENANT,
      eventId: EVENT,
      name: 'Evidence Event',
      permissions: [
        'event.read',
        'config.read',
        'config.write',
        'config.publish',
        'gate.confirm',
      ],
    },
  ],
};

const EVENT_DETAIL = {
  eventId: EVENT,
  tenantId: TENANT,
  slug: 'evidence-event',
  name: 'Evidence Event',
  status: 'DRAFT',
  visibility: 'PUBLIC',
};

const CONFIG_VERSIONS = { items: [] };

const BRANDING = {
  displayName: 'Evidence Org',
  primaryColor: '#E11D48',
  secondaryColor: null,
  version: 1,
};

async function waitForServer(url, attempts = 90) {
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

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = maybeSpawnServer();
  await waitForServer(`${PORTAL}/auth`);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.WEB_UAT_EXECUTABLE || undefined,
  });
  const context = await browser.newContext({ colorScheme: 'light' });

  await context.route('**/api/bff/me/tenants', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TENANTS),
    }),
  );
  await context.route('**/api/bff/me/events', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EVENTS),
    }),
  );
  await context.route(`**/api/bff/tenants/${TENANT}/events/${EVENT}**`, (route) => {
    const url = route.request().url();
    if (url.includes('config-versions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CONFIG_VERSIONS),
      });
    }
    if (route.request().method() === 'GET' && url.endsWith(EVENT)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EVENT_DETAIL),
      });
    }
    return route.continue();
  });
  await context.route(`**/api/bff/tenants/${TENANT}/branding`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(BRANDING),
    }),
  );
  await context.route('**/api/bff/platform/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        operator: true,
        assurance: 'mfa',
        permittedCommands: ['platform.tenants.list'],
      }),
    }),
  );
  await context.route('**/api/bff/platform/tenants**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0 }),
    }),
  );

  for (const vp of [
    { tag: 'auth-1440', width: 1440, height: 900 },
    { tag: 'auth-390', width: 390, height: 844 },
  ]) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${PORTAL}/auth`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.portal-brand-mark', { timeout: 20_000 });
    await shot(page, vp.tag);
    await page.close();
  }

  const shellRoutes = [
    {
      path: `/t/${TENANT}/e/${EVENT}`,
      tag: 'event-readiness',
    },
    {
      path: `/t/${TENANT}/e/${EVENT}/config`,
      tag: 'event-config',
    },
    {
      path: `/t/${TENANT}/settings`,
      tag: 'settings',
    },
    {
      path: `/platform`,
      tag: 'platform',
    },
    {
      path: `/onboarding/${TENANT}`,
      tag: 'onboarding',
    },
  ];

  for (const width of [1440, 390]) {
    for (const route of shellRoutes) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
      await page.goto(`${PORTAL}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await shot(page, `${route.tag}-${width}`);
      await page.close();
    }
  }

  const shellPage = await context.newPage();
  await shellPage.setViewportSize({ width: 1440, height: 900 });
  await shellPage.goto(`${PORTAL}/account/security`, { waitUntil: 'domcontentloaded' });
  await shellPage.waitForSelector('[data-testid="portal-brand"]', { timeout: 30_000 });
  await shellPage.waitForTimeout(500);
  await shot(shellPage, 'shell-1440');
  await shellPage.close();

  await browser.close();
  if (server) server.kill('SIGTERM');

  writeFileSync(
    join(OUT, 'checks.txt'),
    `pnpm --filter @ticket/portal test\npnpm --filter @ticket/portal build\nnode apps/portal/tests/evidence-vd10/capture-screenshots.mjs\n`,
  );
  writeFileSync(
    join(OUT, 'README.md'),
    `# VD10 portal theme + forms evidence

Captured against \`${PORTAL}\` with mocked BFF.

Screenshots: auth, shell, event readiness dashboard, event config, org settings, platform @ 1440 and 390.
`,
  );
  console.log(`evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
