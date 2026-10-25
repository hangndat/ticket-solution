#!/usr/bin/env node
/**
 * VD11 portal menu + design-system evidence (prototype vs app).
 *   pnpm --filter @ticket/portal build && pnpm --filter @ticket/portal start
 *   node apps/portal/tests/evidence-vd11/capture-screenshots.mjs
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
const PORTAL_PKG = resolve(HERE, '../../..');
const MONOREPO = resolve(HERE, '../../../..');
const PROTOTYPE_HTML = join(
  MONOREPO,
  'docs/design/vemoki-unified-v1/design-system/product/portal.html',
);
const PROTOTYPE_MOBILE = join(
  MONOREPO,
  'docs/design/vemoki-unified-v1/design-system/product/portal-mobile.html',
);
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
        'guest.list',
        'code.list',
        'quota.read',
        'audit.read',
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
  primaryColor: '#7C4DED',
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
    cwd: MONOREPO,
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

  const viewports = [
    { w: 1440, h: 900, suffix: '1440' },
    { w: 1024, h: 900, suffix: '1024' },
    { w: 390, h: 844, suffix: '390' },
  ];

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto(`${PORTAL}/auth`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.portal-brand-mark', { timeout: 20_000 });
    await shot(page, `actual-auth-${vp.suffix}`);
    await page.close();
  }

  const shellRoutes = [
    { path: `/t/${TENANT}/e/${EVENT}`, tag: 'dashboard-readiness' },
    { path: `/t/${TENANT}/e/${EVENT}/config`, tag: 'event-config' },
    { path: `/t/${TENANT}/e/${EVENT}/types`, tag: 'ticket-types' },
    { path: `/t/${TENANT}/e/${EVENT}/sources`, tag: 'codes-sources' },
    { path: `/t/${TENANT}/e/${EVENT}/quota`, tag: 'quotas' },
    { path: `/t/${TENANT}/e/${EVENT}/gate`, tag: 'ops-gate' },
    { path: `/t/${TENANT}/e/${EVENT}/audit`, tag: 'ops-audit' },
    { path: `/t/${TENANT}/settings`, tag: 'settings' },
    { path: `/platform`, tag: 'platform' },
    { path: `/onboarding/${TENANT}`, tag: 'onboarding' },
    { path: `/account/security`, tag: 'shell-account' },
  ];

  for (const vp of viewports) {
    for (const route of shellRoutes) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${PORTAL}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="portal-brand"], [data-testid="portal-sider"]', {
        timeout: 30_000,
      }).catch(() => {});
      await page.waitForTimeout(1000);
      await shot(page, `actual-${route.tag}-${vp.suffix}`);
      await page.close();
    }
  }

  const menuPage = await context.newPage();
  await menuPage.setViewportSize({ width: 1440, height: 900 });
  await menuPage.goto(`${PORTAL}/t/${TENANT}/e/${EVENT}/gate`, {
    waitUntil: 'domcontentloaded',
  });
  await menuPage.waitForSelector('[data-testid="portal-sider"]', { timeout: 30_000 });
  await menuPage.goto(`${PORTAL}/t/${TENANT}/e/${EVENT}/config`, {
    waitUntil: 'domcontentloaded',
  });
  await menuPage.waitForTimeout(800);
  await shot(menuPage, 'actual-menu-nav-gate-to-config-1440', false);
  await menuPage.close();

  const protoPage = await browser.newPage();
  await protoPage.setViewportSize({ width: 1440, height: 900 });
  await protoPage.goto(`file://${PROTOTYPE_HTML}`, { waitUntil: 'load' });
  await shot(protoPage, 'prototype-portal-1440');
  await protoPage.setViewportSize({ width: 390, height: 844 });
  await protoPage.goto(`file://${PROTOTYPE_MOBILE}`, { waitUntil: 'load' });
  await shot(protoPage, 'prototype-portal-mobile-390');
  await protoPage.close();

  await browser.close();
  if (server) server.kill('SIGTERM');

  writeFileSync(
    join(OUT, 'checks.txt'),
    [
      'pnpm --filter @ticket/portal test',
      'pnpm --filter @ticket/portal build',
      'node apps/portal/tests/evidence-vd11/capture-screenshots.mjs',
    ].join('\n') + '\n',
  );
  writeFileSync(
    join(OUT, 'README.md'),
    `# VD11 portal recovery evidence

Side-by-side naming: \`prototype-*\` (static HTML) vs \`actual-*\` (Next portal @ mocked BFF).

Viewports: 1440, 1024, 390. Token mapping: [TOKEN-MAP.md](./TOKEN-MAP.md).
`,
  );
  console.log(`evidence written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
