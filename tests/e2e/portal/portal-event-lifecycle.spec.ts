import { randomUUID } from 'node:crypto';
import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import type { CaseFixture, E2EManifest } from '../harness/contract';
import {
  bffGet,
  bffMutate,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';
import { readTicketConsentSnapshot } from './lifecycle-db';

function requiredString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`BLOCKED: PORT-02 ${label} missing`);
  }
}

function heroTitleFromPublic(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const topName = (json as { name?: string }).name;
  const sections = (json as { sections?: unknown }).sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (
        section &&
        typeof section === 'object' &&
        (section as { kind?: string }).kind === 'hero'
      ) {
        const title = (section as { title?: string }).title;
        if (typeof title === 'string' && title.length > 0) return title;
        const body = (section as { body?: { title?: string } }).body;
        if (typeof body?.title === 'string' && body.title.length > 0) {
          return body.title;
        }
      }
    }
  }
  return typeof topName === 'string' && topName.length > 0 ? topName : undefined;
}

function heroTitleFromConfigPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const sections = (payload as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return undefined;
  for (const section of sections) {
    if (
      section &&
      typeof section === 'object' &&
      (section as { kind?: string }).kind === 'hero'
    ) {
      const body = (section as { body?: { title?: string } }).body;
      if (typeof body?.title === 'string') return body.title;
    }
  }
  return undefined;
}

async function readPublicHero(
  page: import('playwright/test').Page,
  m: E2EManifest,
  f: CaseFixture,
) {
  const apiUrl =
    typeof f.data?.publicApiUrl === 'string'
      ? f.data.publicApiUrl
      : new URL(
          `/v1/public/tenants/${f.tenantSlug}/events/${f.eventSlug}`,
          m.origins.api,
        ).toString();
  const webUrl =
    typeof f.data?.publicUrl === 'string'
      ? f.data.publicUrl
      : new URL(
          `/t/${f.tenantSlug}/events/${f.eventSlug}`,
          m.origins.web,
        ).toString();
  const api = await page.request.get(apiUrl);
  const web = await page.request.get(webUrl);
  return { api, web, apiUrl, webUrl };
}

async function expectPublicHero(
  page: import('playwright/test').Page,
  m: E2EManifest,
  f: CaseFixture,
  expectedTitle: string,
) {
  const { api } = await readPublicHero(page, m, f);
  if (api.status() === 404) {
    throw new Error(
      'BLOCKED: public GET /v1/public/tenants/{tenantSlug}/events/{eventSlug} returns 404 after seeded publish — product projection gap (see PORT-01)',
    );
  }
  expect(api.status()).toBe(200);
  const apiTitle = heroTitleFromPublic(await api.json());
  expect(apiTitle).toBe(expectedTitle);
}

async function eventDetailRevision(
  page: import('playwright/test').Page,
  m: E2EManifest,
  f: CaseFixture,
) {
  const detail = await bffGet(page, m, eventBff(f, ''));
  expect(detail.status).toBe(200);
  const body = detail.json as { revision?: unknown; event?: { revision?: unknown } };
  const raw = body.revision ?? body.event?.revision;
  const revision =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  expect(Number.isInteger(revision)).toBe(true);
  return revision;
}

test('[PORT-02] draft preview publish rollback and stale save preserve public and ticket consent', async ({
  page,
  browser,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-02');
  const payload = f.data?.configPayload;
  const publishedMarker = f.data?.expectedPublishedName;
  const updatedMarker = f.data?.updatedPublishedName;
  requiredString(publishedMarker, 'expectedPublishedName');
  requiredString(updatedMarker, 'updatedPublishedName');
  if (!payload || typeof payload !== 'object') {
    throw new Error('BLOCKED: PORT-02 valid config payload missing');
  }
  if (!f.ticketId) {
    throw new Error('BLOCKED: PORT-02 issued ticketId missing');
  }
  const entitlementV1 = f.data?.entitlementV1;
  if (!entitlementV1 || typeof entitlementV1 !== 'object') {
    throw new Error('BLOCKED: PORT-02 entitlement fixture missing');
  }
  const ticketBefore = await readTicketConsentSnapshot(f, f.ticketId);
  expect(ticketBefore.entitlement).toEqual(entitlementV1);

  await login(page, m, 'PORT-02', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/config')));

  const versionsPath = eventBff(f, '/config-versions');
  const before = await bffGet(page, m, versionsPath);
  expect(before.status).toBe(200);
  const rows = (
    before.json as { items: Array<{ version: number; published: boolean }> }
  ).items;
  const latest = rows[0].version;
  const publishedVersion = rows.find((row) => row.published)?.version;
  expect(publishedVersion).toBeDefined();

  await expectPublicHero(page, m, f, publishedMarker);

  let newVersion = 0;
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  try {
    await login(page2, m, 'PORT-02', 'owner');
    await page2.goto(portalUrl(m, eventPath(f, '/config')));
    const tabVersions = await bffGet(page2, m, versionsPath);
    expect(tabVersions.status).toBe(200);

    const saved = await bffMutate(page, versionsPath, {
      payload,
      schemaVersion: 1,
      expectedVersion: latest,
    });
    expect([200, 201]).toContain(saved.status);
    newVersion = (saved.json as { version: number }).version;
    expect(newVersion).toBeGreaterThan(latest);

    await expectPublicHero(page, m, f, publishedMarker);

    const preview = await bffGet(
      page,
      m,
      `${versionsPath}/${newVersion}/preview`,
    );
    expect(preview.status).toBe(200);
    const previewHero = heroTitleFromConfigPayload(
      (preview.json as { payload?: unknown }).payload,
    );
    expect(previewHero).toBe(updatedMarker);
    await expectPublicHero(page, m, f, publishedMarker);

    const conflict = await bffMutate(page, versionsPath, {
      payload,
      schemaVersion: 1,
      expectedVersion: latest,
    });
    expect(conflict.status).toBe(409);

    const tabConflict = await bffMutate(page2, versionsPath, {
      payload,
      schemaVersion: 1,
      expectedVersion: latest,
    });
    expect(tabConflict.status).toBe(409);
  } finally {
    await ctx2.close();
  }

  const revisionBeforePublish = await eventDetailRevision(page, m, f);
  const published = await bffMutate(
    page,
    eventBff(f, '/publish'),
    { expectedVersion: newVersion },
  );
  expect([200, 201]).toContain(published.status);
  const revisionAfterPublish = await eventDetailRevision(page, m, f);
  expect(revisionAfterPublish).toBe(revisionBeforePublish + 1);
  await expectPublicHero(page, m, f, updatedMarker);

  const ticketAfterPublish = await readTicketConsentSnapshot(f, f.ticketId);
  expect(ticketAfterPublish).toEqual(ticketBefore);

  const afterPublishVersions = await bffGet(page, m, versionsPath);
  expect(afterPublishVersions.status).toBe(200);
  const publishedRow = (
    afterPublishVersions.json as {
      items: Array<{ version: number; published: boolean }>;
    }
  ).items.find((row) => row.published);
  expect(publishedRow?.version).toBe(newVersion);

  const rollback = await bffMutate(page, `${eventBff(f, '/config')}/rollback`, {
    targetVersion: publishedVersion as number,
    expectedPublishedVersion: newVersion,
    expectedRevision: revisionAfterPublish,
    idempotencyKey: randomUUID(),
  });
  expect([200, 201]).toContain(rollback.status);
  await expectPublicHero(page, m, f, publishedMarker);

  const ticketAfterRollback = await readTicketConsentSnapshot(f, f.ticketId);
  expect(ticketAfterRollback).toEqual(ticketBefore);

  const staleRollback = await bffMutate(page, `${eventBff(f, '/config')}/rollback`, {
    targetVersion: publishedVersion as number,
    expectedPublishedVersion: newVersion,
    expectedRevision: revisionAfterPublish,
    idempotencyKey: randomUUID(),
  });
  expect(staleRollback.status).toBe(409);
  await expectPublicHero(page, m, f, publishedMarker);

  const after = await bffGet(page, m, versionsPath);
  expect(
    (after.json as { items: Array<{ version: number }> }).items[0].version,
  ).toBeGreaterThan(newVersion);
});

test('[PORT-03] clone copies event setup without inventory or tickets', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-03');
  const cloneName = f.data?.cloneName;
  const cloneSlug = f.data?.cloneSlug;
  if (typeof cloneName !== 'string' || typeof cloneSlug !== 'string')
    throw new Error('BLOCKED: PORT-03 unique clone identity missing');
  await login(page, m, 'PORT-03', 'owner');
  const sourceTickets = await bffGet(page, m, eventBff(f, '/tickets?limit=20'));
  expect(sourceTickets.status).toBe(200);
  expect(
    (sourceTickets.json as { items: unknown[] }).items.length,
  ).toBeGreaterThan(0);
  await page.goto(portalUrl(m, eventPath(f, '/setup')));
  await page.getByLabel('Tên bản sao').fill(cloneName);
  await page.getByLabel('Slug bản sao').fill(cloneSlug);
  const cloned = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/events/${f.eventId}/clone`) &&
      r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Clone sự kiện' }).click();
  const response = await cloned;
  expect([200, 201], `clone HTTP ${response.status()}`).toContain(
    response.status(),
  );
  const clonedBody = (await response.json()) as {
    event?: { eventId?: string; name?: string; slug?: string };
    operationId?: string;
    replayed?: boolean;
  };
  expect(
    clonedBody.event?.eventId,
    `Portal clone confirmation requires event.eventId; response fields=${Object.keys(clonedBody).join(',')}`,
  ).toBeTruthy();
  expect(clonedBody.event?.name).toBe(cloneName);
  expect(clonedBody.event?.slug).toBe(cloneSlug);
  expect(clonedBody.operationId).toBeTruthy();
  expect(clonedBody.replayed).toBe(false);
  await expect(page).toHaveURL(
    (url) =>
      url.pathname.startsWith(`/t/${f.tenantId}/e/`) &&
      url.pathname.split('/')[4] !== f.eventId,
  );
  const cloneId = new URL(page.url()).pathname.split('/')[4];
  expect(cloneId).toBe(clonedBody.event?.eventId);
  const cloneTickets = await bffGet(
    page,
    m,
    `/api/bff/tenants/${f.tenantId}/events/${cloneId}/tickets?limit=20`,
  );
  expect(cloneTickets.status).toBe(200);
  expect((cloneTickets.json as { items: unknown[] }).items).toHaveLength(0);
  const cloneCodes = await bffGet(
    page,
    m,
    `/api/bff/tenants/${f.tenantId}/events/${cloneId}/codes?limit=20`,
  );
  expect(cloneCodes.status).toBe(200);
  expect((cloneCodes.json as { items: unknown[] }).items).toHaveLength(0);
  const cloneQuota = await bffGet(
    page,
    m,
    `/api/bff/tenants/${f.tenantId}/events/${cloneId}/quota`,
  );
  expect(cloneQuota.status).toBe(422);
  expect((cloneQuota.json as { code?: string }).code).toBe('QUOTA_REQUIRED');
});

test('[PORT-04] quota projection reflects allocated inventory without invented capacity', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-04');
  const expectedCapacity = f.data?.capacity;
  if (typeof expectedCapacity !== 'number')
    throw new Error('BLOCKED: PORT-04 finite quota fixture missing');
  await login(page, m, 'PORT-04', 'owner');
  const response = await bffGet(page, m, eventBff(f, '/quota'));
  expect(response.status).toBe(200);
  const quota = response.json as { capacity: number; allocated: number };
  expect(quota.capacity).toBe(expectedCapacity);
  expect(quota.allocated).toBeGreaterThan(0);
  expect(quota.allocated).toBeLessThanOrEqual(quota.capacity);
  const report = await bffGet(page, m, eventBff(f, '/report'));
  expect(report.status).toBe(200);
  const reportBody = report.json as {
    quota: { capacity: number | null; allocated: number };
    quotaCapacityState: string;
    quotaRemaining: number | null;
  };
  expect(reportBody.quota.capacity).toBe(quota.capacity);
  expect(reportBody.quota.allocated).toBe(quota.allocated);
  expect(reportBody.quotaCapacityState).toBe('FINITE');
  expect(reportBody.quotaRemaining).toBe(
    expectedCapacity - quota.allocated,
  );
  await page.goto(portalUrl(m, eventPath(f, '/quota')));
  await expect(
    page.getByText(String(expectedCapacity), { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByTestId('event-report-as-of')).toBeVisible();
});

test('[PORT-04] Portal BFF exposes quota read only — mutation AC needs product surface', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-04');
  if (typeof f.data?.capacity !== 'number')
    throw new Error('BLOCKED: PORT-04 finite quota fixture missing');
  await login(page, m, 'PORT-04', 'owner');
  const before = await bffGet(page, m, eventBff(f, '/quota'));
  expect(before.status).toBe(200);
  const path = eventBff(f, '/quota');
  for (const method of ['POST', 'PATCH', 'PUT'] as const) {
    const attempt = await bffMutate(page, path, { capacity: 1 }, method);
    expect([404, 405]).toContain(attempt.status);
  }
  const after = await bffGet(page, m, path);
  expect(after.status).toBe(200);
  expect(after.json).toEqual(before.json);
});
