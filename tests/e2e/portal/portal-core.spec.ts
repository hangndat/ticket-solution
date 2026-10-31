import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import {
  bffGet,
  bffMutate,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';

function reportUpstreamPath(f: ReturnType<typeof fixtureFor>): string {
  return `/v1/tenants/${f.tenantId}/events/${f.eventId}/report`;
}

function faultControlPathFor(m: ReturnType<typeof loadManifest>): string {
  const control = m.runtime?.faultControlPath;
  if (typeof control !== 'string')
    throw new Error('BLOCKED: run fault control missing');
  return control;
}

function setReportFault(
  control: string,
  ownerRunId: string,
  path: string,
  mode: 'unavailable' | 'error500' | null,
) {
  let current: { ownerRunId: string; routes: Record<string, string> };
  try {
    current = JSON.parse(readFileSync(control, 'utf8'));
  } catch {
    current = { ownerRunId, routes: {} };
  }
  current.ownerRunId = ownerRunId;
  current.routes = current.routes ?? {};
  if (mode) current.routes[path] = mode;
  else delete current.routes[path];
  writeFileSync(control, JSON.stringify(current), { mode: 0o600 });
}

test('[PORT-01] wizard creates a tenant-scoped event and survives reload', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-01');
  const name = String(f.data?.eventName ?? `E2E ${m.runId}`);
  const slug = String(f.data?.eventSlug ?? `e2e-${m.runId}`);
  const typeLabel = `Loại vé ${m.runId.slice(0, 8)}`;
  const sourceName = `Nguồn ${m.runId.slice(0, 8)}`;
  const brandName = `Brand ${m.runId.slice(0, 8)}`;
  const termsText = `Điều khoản E2E ${m.runId}`;

  await login(page, m, 'PORT-01', 'owner');
  await page.goto(portalUrl(m, `/t/${f.tenantId}/events/new`));
  await page.getByLabel('Tên sự kiện').fill(name);
  await page.getByLabel('Đường dẫn (slug)').fill(slug);
  await page.getByLabel('Hiển thị').click();
  await page.locator('.ant-select-dropdown:visible').getByTitle('PUBLIC').click();
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await page.getByRole('button', { name: 'Tiếp' }).click();
  await expect(page.getByText(name)).toBeVisible();
  const createBtn = page.getByRole('button', { name: 'Tạo sự kiện' });
  await createBtn.click();
  await expect(page).toHaveURL(new RegExp(`/t/${f.tenantId}/e/[0-9a-f-]+`));
  const createdId = new URL(page.url()).pathname.split('/')[4];

  const eventBase = `/t/${f.tenantId}/e/${createdId}`;
  const eventBffPath = (leaf: string) =>
    `/api/bff/tenants/${f.tenantId}/events/${createdId}${leaf}`;

  const detail = await bffGet(page, m, eventBffPath(''));
  expect(detail.status).toBe(200);
  expect(JSON.stringify(detail.json)).toContain(slug);

  await page.goto(portalUrl(m, `${eventBase}/types`));
  await page
    .getByTestId('pro-page-header')
    .getByRole('button', { name: 'Tạo loại vé' })
    .click();
  const typeDialog = page.getByRole('dialog', { name: 'Tạo loại vé' });
  await typeDialog.getByLabel('Nhãn').fill(typeLabel);
  await typeDialog.getByRole('button', { name: 'Đồng ý' }).click();
  await expect(page.getByRole('cell', { name: typeLabel })).toBeVisible();

  await page.goto(portalUrl(m, `${eventBase}/sources`));
  await page
    .getByTestId('pro-page-header')
    .getByRole('button', { name: 'Tạo nguồn' })
    .click();
  const sourceDialog = page.getByRole('dialog', { name: 'Tạo nguồn mã' });
  await sourceDialog.getByLabel('Tên').fill(sourceName);
  await sourceDialog.getByLabel('Chế độ duyệt').click();
  await page.locator('.ant-select-dropdown:visible').getByTitle('AUTO').click();
  await sourceDialog.getByLabel('Loại vé').click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await sourceDialog.getByRole('button', { name: 'Đồng ý' }).click();
  await expect(page.getByRole('cell', { name: sourceName })).toBeVisible();

  const quotaBeforeConfig = await bffGet(page, m, eventBffPath('/quota'));
  expect(quotaBeforeConfig.status).toBe(422);
  expect((quotaBeforeConfig.json as { code?: string }).code).toBe(
    'QUOTA_REQUIRED',
  );

  await page.goto(portalUrl(m, `${eventBase}/quota`));
  await expect(
    page.getByRole('navigation', { name: /Loại vé, nguồn phát và hạn mức/i }),
  ).toBeVisible();
  await expect(page.locator('.ant-alert-error, .ant-alert-warning').first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(portalUrl(m, `${eventBase}/config`));
  await page.getByLabel('Tên tổ chức (brand)').fill(brandName);
  await page.getByLabel('Màu chính').fill('#9b3a18');
  await page.getByLabel('Điều khoản (plain text)').fill(termsText);
  await page.getByRole('button', { name: 'Lưu draft' }).click();
  await expect(
    page.getByText('Đã lưu bản nháp cấu hình (chưa publish).'),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Xuất bản tip' }).click();
  const publishModal = page.getByRole('dialog', { name: 'Xuất bản cấu hình?' });
  await publishModal.getByRole('button', { name: 'Xuất bản' }).click();
  await expect(page.getByText('Đã publish cấu hình.')).toBeVisible({
    timeout: 30_000,
  });

  const versions = await bffGet(page, m, eventBffPath('/config-versions'));
  expect(versions.status).toBe(200);
  const published = (
    versions.json as { items: Array<{ published: boolean; version: number }> }
  ).items.some((row) => row.published);
  expect(published).toBe(true);
  const publishedVersion = (
    versions.json as { items: Array<{ published: boolean; version: number }> }
  ).items.find((row) => row.published)?.version;
  expect(publishedVersion).toEqual(expect.any(Number));

  const publishedDetail = await bffGet(page, m, eventBffPath(''));
  expect(publishedDetail.status).toBe(200);
  const eventBody =
    (publishedDetail.json as { event?: { contentStatus?: string } }).event ??
    publishedDetail.json;
  expect((eventBody as { contentStatus?: string }).contentStatus).toBe(
    'PUBLISHED',
  );

  const publicApiUrl = new URL(
    `/v1/public/tenants/${f.tenantSlug}/events/${slug}`,
    m.origins.api,
  ).toString();
  const publicApi = await page.request.get(publicApiUrl);
  expect(publicApi.status()).toBe(404);

  await page.goto(
    new URL(`/t/${f.tenantSlug}/events/${slug}`, m.origins.web).toString(),
  );
  await expect(page.getByTestId('event-published')).toHaveCount(0);

  await page.goto(portalUrl(m, eventBase));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${eventBase.replace(/\//g, '\\/')}$`));
  await expect(page.getByTestId('pro-page-header').getByText(name)).toBeVisible();

  await page.goto(portalUrl(m, `${eventBase}/types`));
  await page.reload();
  await expect(page.getByRole('cell', { name: typeLabel })).toBeVisible();

  await page.goto(portalUrl(m, `/t/${f.tenantId}/events`));
  await expect(page.locator(`a[href*="${createdId}"]`)).toHaveCount(1);
  await expect(page.getByRole('link', { name })).toBeVisible();

  const tenantEvents = await bffGet(
    page,
    m,
    `/api/bff/tenants/${f.tenantId}/events?limit=50`,
  );
  expect(tenantEvents.status).toBe(200);
  const items = (tenantEvents.json as { items: Array<{ eventId: string }> })
    .items;
  expect(items.filter((item) => item.eventId === createdId)).toHaveLength(1);
  expect(items).toHaveLength(1);
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

  const minSort = await bffMutate(page, eventBff(f, '/gates'), {
    name: `Min ${m.runId}`,
    sortOrder: 0,
  });
  expect(minSort.status).toBeGreaterThanOrEqual(200);
  expect(minSort.status).toBeLessThan(300);
  expect((minSort.json as { sortOrder?: number }).sortOrder).toBe(0);

  for (const outOfRange of [-1, 10000] as const) {
    const rejected = await bffMutate(page, eventBff(f, '/gates'), {
      name: `Range ${outOfRange} ${m.runId}`,
      sortOrder: outOfRange,
    });
    expect(rejected.status).toBe(422);
    expect((rejected.json as { code?: string }).code).toBe('SCOPE_REQUIRED');
    expect(String((rejected.json as { message?: string }).message)).toMatch(
      /between 0 and 9999/,
    );
  }

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
  // O12 confirm APPLIED/undo/reject lives in Gate/mobile scan flows (DB-15), not Portal.
  await expect(
    page.getByRole('button', { name: /quét|scan|confirm|undo|reject admission/i }),
  ).toHaveCount(0);
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
  if (expected.pendingApprovalCount === 0) {
    await expect(page.getByTestId('event-report-cta-pending-approval')).toHaveCount(
      0,
    );
  }
  if (expected.emailNeedsCsCount === 0) {
    await expect(page.getByTestId('event-report-cta-email-cs')).toHaveCount(0);
  }
  if (
    expected.quotaCapacityState === 'FINITE' &&
    expected.quotaRemaining != null
  ) {
    await expect(
      page.getByText(String(expected.quotaRemaining), { exact: true }).first(),
    ).toBeVisible();
  }
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

test('[PORT-08] upstream report fault does not render fake zero KPIs', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-08');
  const control = faultControlPathFor(m);
  const upstream = reportUpstreamPath(f);
  await login(page, m, 'PORT-08', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/gate')));
  await expect(page.getByTestId('event-report-as-of')).toBeVisible();
  try {
    setReportFault(control, m.runId, upstream, 'error500');
    await page.reload();
    await expect(
      page.getByText(
        /Báo cáo chưa biết|Report outcome unknown/i,
      ),
    ).toBeVisible();
    await expect(page.locator('.portal-gate-report-compact')).toHaveCount(0);
    await expect(page.getByTestId('event-report-cta-pending-approval')).toHaveCount(
      0,
    );
    await expect(page.getByTestId('event-report-cta-email-cs')).toHaveCount(0);
    setReportFault(control, m.runId, upstream, null);
    await page.reload();
    await expect(page.getByTestId('event-report-as-of')).toBeVisible();
    const expected = f.data?.report as { pendingApprovalCount: number } | undefined;
    if (!expected) throw new Error('BLOCKED: PORT-08 report fixture missing');
    if (expected.pendingApprovalCount > 0) {
      await expect(
        page.getByTestId('event-report-cta-pending-approval'),
      ).toBeVisible();
    }
  } finally {
    setReportFault(control, m.runId, upstream, null);
  }
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

test('[PORT-13] Portal filter + saved view persist for owner and are not hydrated after switching actor in the same browser profile', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-13');
  if (!f.sourceId) throw new Error('BLOCKED: PORT-13 source fixture missing');
  await login(page, m, 'PORT-13', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  const pending = page.locator('#pending');
  const sourceFilter = pending.getByLabel('Lọc theo source');
  await sourceFilter.waitFor({ state: 'visible' });
  await sourceFilter.click();
  await page.getByRole('option', { name: 'E2E Auto' }).click();
  await pending
    .getByRole('button', { name: 'Áp dụng bộ lọc chờ duyệt' })
    .click();
  await expect(sourceFilter).toContainText('E2E Auto');

  const toolbar = pending.getByRole('button', {
    name: 'Chọn hoặc lưu view danh sách',
  });
  await expect(toolbar).toBeVisible();
  await pending.getByRole('button', { name: 'Lưu view', exact: true }).click();
  const saveDialog = page.getByRole('dialog', { name: 'Lưu view' });
  await saveDialog.getByLabel('Tên').fill('PORT-13 source filter');
  await saveDialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(saveDialog).toHaveCount(0);
  await expect(toolbar).toContainText('PORT-13 source filter');

  // Saved view (filter + name) must survive a reload for the same user+tenant.
  await page.reload();
  await page.locator('#pending').waitFor({ state: 'visible' });
  await page
    .locator('#pending')
    .getByRole('button', { name: 'Chọn hoặc lưu view danh sách' })
    .click();
  await expect(page.getByText('PORT-13 source filter')).toBeVisible();
  await page.keyboard.press('Escape');

  // Switch actor in the SAME browser profile: owner's saved view must not
  // hydrate for a different staff member on the same tenant/event.
  await page.goto(portalUrl(m, '/api/auth/logout'));
  await login(page, m, 'PORT-13', 'manager');
  await page.goto(portalUrl(m, eventPath(f, '/guests#pending')));
  const pendingAsManager = page.locator('#pending');
  await pendingAsManager
    .getByRole('button', { name: 'Chọn hoặc lưu view danh sách' })
    .waitFor({ state: 'visible' });
  await expect(
    pendingAsManager.getByRole('button', { name: 'Quản lý view' }),
  ).toBeDisabled();
  await expect(page.getByText('PORT-13 source filter')).toHaveCount(0);
});
