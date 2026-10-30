import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import {
  bffGet,
  bffMutate,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';

test('[PORT-01] wizard creates a tenant-scoped event and survives reload', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-01');
  const name = String(f.data?.eventName ?? `E2E ${m.runId}`);
  const slug = String(f.data?.eventSlug ?? `e2e-${m.runId}`);
  await login(page, m, 'PORT-01', 'owner');
  await page.goto(portalUrl(m, `/t/${f.tenantId}/events/new`));
  await page.getByLabel('Tên sự kiện').fill(name);
  await page.getByLabel('Đường dẫn (slug)').fill(slug);
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole('button', { name: 'Tạo sự kiện' }).click();
  await expect(page).toHaveURL(new RegExp(`/t/${f.tenantId}/e/[0-9a-f-]+`));
  const createdId = new URL(page.url()).pathname.split('/')[4];
  const result = await bffGet(
    page,
    m,
    `/api/bff/tenants/${f.tenantId}/events/${createdId}`,
  );
  expect(result.status).toBe(200);
  expect(JSON.stringify(result.json)).toContain(slug);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/t/${f.tenantId}/e/${createdId}`));
});

test('[PORT-07] gate create, duplicate and HTTP validation', async ({
  page,
  browser,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-07');
  const gateName = String(f.data?.gateName ?? `Cổng ${m.runId}`);
  const maxName = 'G'.repeat(80);
  const webOrigin = new URL(m.origins.web).origin;

  await login(page, m, 'PORT-07', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/gate')));
  const section = page.getByRole('region', { name: 'Cổng vào' });
  await expect(
    section.getByText('Chưa có cổng.', { exact: false }),
  ).toBeVisible();
  await expect(
    section.getByText('nhân viên mở phiên quét', { exact: false }),
  ).toBeVisible();
  await expect(
    page.locator(`a[href^="${webOrigin}/gate"]`),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /quét|scan|confirm|undo/i }),
  ).toHaveCount(0);
  await expect(
    section.getByRole('button', { name: /xóa|delete|đổi tên|rename/i }),
  ).toHaveCount(0);

  const emptyList = await bffGet(page, m, eventBff(f, '/gates'));
  expect(emptyList.status).toBe(200);
  expect((emptyList.json as { gates: unknown[] }).gates).toHaveLength(0);

  await section.getByRole('button', { name: 'Thêm cổng' }).click();
  const dialog = page.getByRole('dialog', { name: 'Thêm cổng' });
  await dialog.getByRole('textbox').fill(gateName);
  await dialog.getByRole('spinbutton').fill('0');
  await dialog.getByRole('button', { name: 'Thêm cổng' }).click();
  await expect(section.getByRole('cell', { name: gateName })).toBeVisible();
  await expect(section.getByRole('cell', { name: '0', exact: true })).toBeVisible();

  const first = await bffGet(page, m, eventBff(f, '/gates'));
  expect(first.status).toBe(200);
  expect(JSON.stringify(first.json)).toContain(gateName);

  const boundary = await bffMutate(page, eventBff(f, '/gates'), {
    name: maxName,
    sortOrder: 9999,
  });
  expect(boundary.status).toBeGreaterThanOrEqual(200);
  expect(boundary.status).toBeLessThan(300);
  expect((boundary.json as { name?: string; sortOrder?: number }).name).toBe(
    maxName,
  );
  expect(
    (boundary.json as { sortOrder?: number }).sortOrder,
  ).toBe(9999);

  await section.getByRole('button', { name: 'Thêm cổng' }).click();
  await dialog.getByRole('textbox').fill(gateName);
  await dialog.getByRole('button', { name: 'Thêm cổng' }).click();
  await expect(
    dialog.getByText('Đã có cổng trùng tên', { exact: false }),
  ).toBeVisible();

  const dupHttp = await bffMutate(page, eventBff(f, '/gates'), {
    name: gateName,
  });
  expect(dupHttp.status).toBe(409);
  expect((dupHttp.json as { code?: string }).code).toBe('GATE_NAME_CONFLICT');

  const after = await bffGet(page, m, eventBff(f, '/gates'));
  expect(after.status).toBe(200);
  expect(
    (after.json as { gates: Array<{ name: string }> }).gates.filter(
      (g) => g.name === gateName,
    ),
  ).toHaveLength(1);

  const invalid = await bffMutate(page, eventBff(f, '/gates'), { name: '' });
  expect(invalid.status).toBe(422);
  expect((invalid.json as { code?: string }).code).toBe('NAME_INVALID');

  const tooLong = await bffMutate(page, eventBff(f, '/gates'), {
    name: `${maxName}x`,
  });
  expect(tooLong.status).toBe(422);
  expect((tooLong.json as { code?: string }).code).toBe('NAME_INVALID');

  const badSort = await bffMutate(page, eventBff(f, '/gates'), {
    name: `Sort ${m.runId}`,
    sortOrder: 1.5,
  });
  expect(badSort.status).toBe(422);
  expect((badSort.json as { code?: string }).code).toBe('SORT_INVALID');

  const scannerContext = await browser.newContext();
  const scannerPage = await scannerContext.newPage();
  try {
    await login(scannerPage, m, 'PORT-07', 'scanner');
    const scannerList = await bffGet(scannerPage, m, eventBff(f, '/gates'));
    expect(scannerList.status).toBe(200);
    const scannerDeny = await bffMutate(
      scannerPage,
      eventBff(f, '/gates'),
      { name: `Scanner ${m.runId}` },
    );
    expect(scannerDeny.status).toBe(403);
  } finally {
    await scannerContext.close();
  }

  const readerContext = await browser.newContext();
  const readerPage = await readerContext.newPage();
  try {
    await login(readerPage, m, 'PORT-07', 'cs');
    await readerPage.goto(portalUrl(m, eventPath(f, '/gate')));
    const readerSection = readerPage.getByRole('region', { name: 'Cổng vào' });
    await expect(readerSection).toBeVisible();
    await expect(
      readerSection.getByRole('button', { name: 'Thêm cổng' }),
    ).toHaveCount(0);
    await expect(
      readerSection.getByRole('cell', { name: gateName }),
    ).toBeVisible();
    await expect(
      readerSection.getByRole('cell', { name: maxName }),
    ).toBeVisible();

    const readerList = await bffGet(readerPage, m, eventBff(f, '/gates'));
    expect(readerList.status).toBe(200);
    expect(JSON.stringify(readerList.json)).toContain(gateName);
    const readerDeny = await bffMutate(
      readerPage,
      eventBff(f, '/gates'),
      { name: `Reader ${m.runId}` },
    );
    expect(readerDeny.status).toBe(403);
  } finally {
    await readerContext.close();
  }
});

test('[PORT-08] event report shows seeded KPI, asOf and work links', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-08');
  const expected = f.data?.report as
    | {
        pendingApprovalCount: number;
        checkInSuccessCount: number;
        emailNeedsCsCount: number;
        quotaCapacityState?: string;
        quotaRemaining?: number | null;
        quota?: { capacity: number | null; allocated: number };
      }
    | undefined;
  if (!expected) throw new Error('BLOCKED: PORT-08 report fixture missing');
  await login(page, m, 'PORT-08', 'owner');
  const api = await bffGet(page, m, eventBff(f, '/report'));
  expect(api.status).toBe(200);
  const report = api.json as Record<string, unknown>;
  expect(report.pendingApprovalCount).toBe(expected.pendingApprovalCount);
  expect(report.checkInSuccessCount).toBe(expected.checkInSuccessCount);
  expect(report.emailNeedsCsCount).toBe(expected.emailNeedsCsCount);
  if (expected.quotaCapacityState != null) {
    expect(report.quotaCapacityState).toBe(expected.quotaCapacityState);
  }
  if (expected.quotaRemaining !== undefined) {
    expect(report.quotaRemaining).toBe(expected.quotaRemaining);
  }
  if (expected.quota) {
    expect(report.quota).toEqual(expected.quota);
  }
  expect(Date.parse(String(report.asOf))).not.toBeNaN();
  await page.goto(portalUrl(m, eventPath(f, '/gate')));
  await expect(page.getByTestId('event-report-as-of')).toBeVisible();
  await expect(
    page
      .getByText(String(expected.checkInSuccessCount), { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(String(expected.pendingApprovalCount), { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Resend email', exact: true }),
  ).toHaveCount(0);
  if (expected.pendingApprovalCount > 0) {
    await expect(
      page.getByTestId('event-report-cta-pending-approval').locator('xpath=..'),
    ).toHaveAttribute('href', `${eventPath(f, '/guests')}#pending`);
  }
  if (expected.emailNeedsCsCount > 0) {
    await expect(
      page.getByTestId('event-report-cta-email-cs').locator('xpath=..'),
    ).toHaveAttribute('href', `${eventPath(f, '/support')}#cs`);
  }
  const refreshed = page.waitForResponse(
    (r) =>
      r.url().includes('/report') &&
      r.request().method() === 'GET' &&
      r.status() === 200,
  );
  await page
    .getByRole('button', { name: /Làm mới|Refresh/i })
    .first()
    .click();
  await refreshed;
});

test('[PORT-10] portfolio only returns assigned report events', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-10');
  const visible = f.data?.visibleEventIds as string[] | undefined;
  const hidden = f.data?.hiddenEventId as string | undefined;
  if (!visible?.length || !hidden)
    throw new Error('BLOCKED: PORT-10 assignment fixture missing');
  await login(page, m, 'PORT-10', 'owner');
  const path = `/api/bff/tenants/${f.tenantId}/reports/portfolio?limit=20`;
  const response = await bffGet(page, m, path);
  expect(response.status).toBe(200);
  const body = response.json as {
    items: Array<{ eventId: string }>;
    asOf?: string;
  };
  expect(body.items.map((item) => item.eventId)).toEqual(
    expect.arrayContaining(visible),
  );
  expect(body.items.map((item) => item.eventId)).not.toContain(hidden);
  await page.goto(portalUrl(m, `/t/${f.tenantId}/analytics`));
  const table = page.getByTestId('portfolio-table');
  await expect(table).toBeVisible();
  for (const eventId of visible) {
    await expect(table.locator(`a[href*="${eventId}"]`)).toBeVisible();
  }
  await expect(table.locator(`a[href*="${hidden}"]`)).toHaveCount(0);
});

test('[PORT-13] Portal locale defaults VI and persists EN through reload', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-13');
  await login(page, m, 'PORT-13', 'owner');
  await page.goto(portalUrl(m, `/t/${f.tenantId}/events`));
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await page.getByTestId('portal-locale-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('portal-locale-en')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
