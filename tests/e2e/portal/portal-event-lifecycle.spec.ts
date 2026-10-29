import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import {
  bffGet,
  bffMutate,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';

test('[PORT-02] stale config version cannot overwrite a saved draft', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-02');
  const payload = f.data?.configPayload;
  const publicUrl = f.data?.publicUrl;
  const publishedMarker = f.data?.expectedPublishedName;
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof publicUrl !== 'string' ||
    typeof publishedMarker !== 'string'
  ) {
    throw new Error(
      'BLOCKED: PORT-02 valid config payload and public projection fixture missing',
    );
  }
  await login(page, m, 'PORT-02', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/config')));
  const versionsPath = eventBff(f, '/config-versions');
  const before = await bffGet(page, m, versionsPath);
  expect(before.status).toBe(200);
  const rows = (
    before.json as { items: Array<{ version: number; published: boolean }> }
  ).items;
  const latest = rows[0].version;
  const oldPublished = rows.find((row) => row.published)?.version;
  expect(oldPublished).toBeDefined();
  const publicBefore = await page.request.get(publicUrl);
  expect(publicBefore.status()).toBe(200);
  expect(await publicBefore.text()).toContain(publishedMarker);
  const saved = await bffMutate(page, versionsPath, {
    payload,
    schemaVersion: 1,
    expectedVersion: latest,
  });
  expect([200, 201]).toContain(saved.status);
  const newVersion = (saved.json as { version: number }).version;
  expect(newVersion).toBeGreaterThan(latest);
  const conflict = await bffMutate(page, versionsPath, {
    payload,
    schemaVersion: 1,
    expectedVersion: latest,
  });
  expect(conflict.status).toBe(409);
  const publicAfterDraft = await page.request.get(publicUrl);
  expect(await publicAfterDraft.text()).toContain(publishedMarker);
  const preview = await bffGet(
    page,
    m,
    `${versionsPath}/${newVersion}/preview`,
  );
  expect(preview.status).toBe(200);
  const after = await bffGet(page, m, versionsPath);
  expect(
    (after.json as { items: Array<{ version: number }> }).items[0].version,
  ).toBe(newVersion);
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
