import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import {
  bffGet,
  bffMutate,
  bffUploadCsv,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from './helpers';
import {
  readCodeStatuses,
  readImportBusinessSnapshot,
  businessRowsUnchanged,
  snapshotEqual,
} from './import-db';
import type { CaseFixture, E2EManifest } from '../harness/contract';
import type { Page } from 'playwright/test';

async function relogin(
  page: Page,
  m: E2EManifest,
  caseId: string,
  actor: 'owner' | 'otherAttendee',
) {
  await page.context().clearCookies();
  await login(page, m, caseId, actor);
  await page.waitForFunction(() => document.cookie.includes('portal_csrf='));
}

async function selectImportCatalog(
  page: Page,
  sourceLabel: string,
  typeLabel: string,
) {
  const filters = page.getByTestId('import-catalog-filters');
  await filters.getByLabel('Lọc theo source').click();
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
    .filter({ hasText: sourceLabel })
    .click();
  await filters.getByLabel('Lọc theo ticket type').click();
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
    .filter({ hasText: typeLabel })
    .click();
}

async function waitForImportSurface(
  page: Page,
  m: E2EManifest,
  f: CaseFixture,
) {
  await page.goto(portalUrl(m, eventPath(f, '/guests#import')));
  await page.getByTestId('import-catalog-filters').waitFor({
    state: 'visible',
    timeout: 45_000,
  });
  await page.waitForFunction(() => document.cookie.includes('portal_csrf='));
}

async function createCodesImportJob(
  page: Page,
  m: E2EManifest,
  f: CaseFixture,
  csvBody: string,
  idempotencyKey = randomUUID(),
) {
  if (!f.sourceId || !f.ticketTypeId) {
    throw new Error('BLOCKED: import catalog ids missing');
  }
  const upload = await bffUploadCsv(
    page,
    m,
    `${eventBff(f, '/imports')}/upload`,
    csvBody,
  );
  expect(upload.status).toBeLessThan(300);
  const fileId = (upload.json as { fileId: string }).fileId;
  const fileHash = (upload.json as { fileHash: string }).fileHash;
  const created = await bffMutate(
    page,
    portalUrl(m, eventBff(f, '/imports')),
    {
      kind: 'CODES',
      sourceId: f.sourceId,
      ticketTypeId: f.ticketTypeId,
      fileId,
      columnMapping: { code: 'code' },
      idempotencyKey,
    },
    'POST',
    idempotencyKey,
  );
  expect(created.status).toBeLessThan(300);
  const importId = (created.json as { importId: string }).importId;
  return { importId, fileHash, fileId, created };
}

async function previewImportJob(
  page: Page,
  m: E2EManifest,
  f: CaseFixture,
  importId: string,
  fileHash?: string,
) {
  return bffMutate(
    page,
    portalUrl(m, `${eventBff(f, '/imports')}/${encodeURIComponent(importId)}/preview`),
    fileHash ? { fileHash, columnMapping: { code: 'code' } } : {},
    'POST',
  );
}

async function commitImportJob(
  page: Page,
  m: E2EManifest,
  f: CaseFixture,
  importId: string,
  body: {
    previewRevision: number;
    mappingRevision: number;
    fileHash: string;
  },
  idempotencyKey: string,
) {
  return bffMutate(
    page,
    portalUrl(m, `${eventBff(f, '/imports')}/${encodeURIComponent(importId)}/commit`),
    { ...body, idempotencyKey },
    'POST',
    idempotencyKey,
  );
}

test('[PORT-05] CSV upload, preview and commit flow uses isolated event', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-05');
  const sourceLabel = f.data?.sourceLabel;
  const typeLabel = f.data?.ticketTypeLabel;
  const expectedCode = readFileSync(f.csvPath!, 'utf8')
    .trim()
    .split('\n')
    .slice(1)[0];
  if (
    !f.csvPath ||
    typeof sourceLabel !== 'string' ||
    typeof typeLabel !== 'string' ||
    !expectedCode
  ) {
    throw new Error('BLOCKED: PORT-05 CSV and catalog labels missing');
  }
  await login(page, m, 'PORT-05', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/guests#import')));
  await page.getByText('Vận hành', { exact: true }).click();
  await selectImportCatalog(page, sourceLabel, typeLabel);
  await expect(page.getByRole('textbox').first()).toHaveValue('code');
  await page.locator('input[type=file]').setInputFiles(f.csvPath);
  await expect(page.getByText(/Ghép cột/i)).toBeVisible();
  const create = page.waitForResponse(
    (r) =>
      r.url().includes(`${eventBff(f, '/imports')}`) &&
      r.request().method() === 'POST' &&
      !r.url().includes('/upload'),
  );
  await page.getByRole('button', { name: 'Upload + tạo job' }).click();
  const createResponse = await create;
  expect(createResponse.status()).toBeLessThan(300);
  const createBody = (await createResponse.json()) as {
    importId: string;
  };
  await expect(page.getByTestId('import-job-result')).toBeVisible();
  await expect(page.getByTestId('import-job-result')).toContainText(
    createBody.importId.slice(0, 8),
  );
  const preview = page.waitForResponse(
    (r) => r.url().includes('/preview') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Xem trước' }).click();
  const previewResponse = await preview;
  expect(previewResponse.status()).toBe(201);
  const previewBody = (await previewResponse.json()) as {
    validRowCount: number;
    errorRowCount: number;
    sampleRows?: Array<{ code?: string }>;
  };
  expect(previewBody.validRowCount).toBe(1);
  expect(previewBody.errorRowCount).toBe(0);
  await expect(page.getByTestId('import-job-result')).toContainText('1 hợp lệ');
  await expect(page.getByTestId('import-job-result')).toContainText('0 lỗi');
  const commit = page.waitForResponse(
    (r) => r.url().includes('/commit') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ghi nhận import' }).click();
  const commitResponse = await commit;
  expect(commitResponse.status()).toBeLessThan(300);
  const commitBody = (await commitResponse.json()) as {
    committedRowCount: number;
    skippedRowCount: number;
  };
  expect(commitBody.committedRowCount).toBe(1);
  expect(commitBody.skippedRowCount).toBe(0);
  await expect(page.getByTestId('import-job-result')).toContainText(
    'Đã ghi nhận: 1 dòng',
  );
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(
    page.locator('tr.ant-table-row').filter({ hasText: 'COMPLETED' }).first(),
  ).toBeVisible();
  const jobs = await bffGet(page, m, eventBff(f, '/imports?limit=20'));
  expect(jobs.status).toBe(200);
  const items = (jobs.json as { items: Array<{ importId: string; status: string }> })
    .items;
  const row = items.find((item) => item.importId === createBody.importId);
  expect(row?.status).toBe('COMPLETED');
  const codes = await readCodeStatuses(f);
  const imported = codes.find((c) => c.status === 'AVAILABLE');
  expect(imported).toBeTruthy();
});

test('[PORT-05] preview reports duplicate rows and error report is reachable', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-05');
  const dupPath = f.data?.duplicateCsvPath;
  if (typeof dupPath !== 'string') {
    throw new Error('BLOCKED: PORT-05 duplicate CSV fixture missing');
  }
  await login(page, m, 'PORT-05', 'owner');
  await waitForImportSurface(page, m, f);
  const dupCsv = readFileSync(dupPath, 'utf8');
  const { importId: dupJobId } = await createCodesImportJob(page, m, f, dupCsv);
  const dupPreview = await previewImportJob(page, m, f, dupJobId);
  expect(dupPreview.status).toBe(201);
  const dupBody = dupPreview.json as {
    validRowCount: number;
    errorRowCount: number;
    sampleErrors?: Array<{ code: string }>;
  };
  expect(dupBody.validRowCount).toBe(1);
  expect(dupBody.errorRowCount).toBe(1);
  expect(
    dupBody.sampleErrors?.some((row) => row.code === 'DUPLICATE_IN_FILE'),
  ).toBe(true);
  const errorsPath = portalUrl(
    m,
    `${eventBff(f, '/imports')}/${encodeURIComponent(dupJobId)}/errors`,
  );
  const errorsRes = await page.request.get(errorsPath, {
    failOnStatusCode: false,
  });
  expect(errorsRes.status()).toBe(200);
  const errorCsv = await errorsRes.text();
  expect(errorCsv).toContain('DUPLICATE_IN_FILE');
  await page.goto(portalUrl(m, eventPath(f, '/guests#import')));
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page
    .locator('tr.ant-table-row')
    .filter({ hasText: 'PREVIEW_READY' })
    .first()
    .getByRole('button', { name: 'Tiếp tục job' })
    .click();
  await page.getByRole('button', { name: 'Xem trước' }).click();
  await expect(page.getByTestId('import-job-result')).toContainText('1 lỗi', {
    timeout: 15_000,
  });
  await expect(
    page.locator('section[aria-label="Lỗi mẫu theo dòng"]'),
  ).toContainText('DUPLICATE_IN_FILE');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải lỗi' }).click();
  const file = await download;
  const uiCsv = readFileSync(await file.path(), 'utf8');
  expect(uiCsv).toContain('DUPLICATE_IN_FILE');
});

test('[PORT-05] malformed nonblank row preview rejects without PG mutation', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-05');
  const invalidPath = f.data?.invalidMixCsvPath;
  if (typeof invalidPath !== 'string') {
    throw new Error('BLOCKED: PORT-05 invalid row CSV fixture missing');
  }
  await login(page, m, 'PORT-05', 'owner');
  await waitForImportSurface(page, m, f);
  const before = await readImportBusinessSnapshot(f);
  const csv = readFileSync(invalidPath, 'utf8');
  const { importId } = await createCodesImportJob(page, m, f, csv);
  const preview = await previewImportJob(page, m, f, importId);
  expect(preview.status).toBe(201);
  const previewBody = preview.json as {
    validRowCount: number;
    errorRowCount: number;
    sampleErrors?: Array<{ code: string }>;
  };
  expect(previewBody.validRowCount).toBe(1);
  expect(previewBody.errorRowCount).toBe(1);
  expect(previewBody.sampleErrors?.some((row) => row.code === 'EMPTY')).toBe(
    true,
  );
  const afterPreview = await readImportBusinessSnapshot(f);
  expect(businessRowsUnchanged(before, afterPreview)).toBe(true);
  const reject = await previewImportJob(page, m, f, importId);
  expect(reject.status).toBe(201);
  const afterReplay = await readImportBusinessSnapshot(f);
  expect(businessRowsUnchanged(before, afterReplay)).toBe(true);
});

test('[PORT-05] commit skips existing codes and idempotent replay does not double-import', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-05');
  const csvPath = f.data?.existingCodesCsvPath;
  const consumedId = (f.data?.codeIds as { consumed?: string } | undefined)
    ?.consumed;
  if (typeof csvPath !== 'string' || typeof consumedId !== 'string') {
    throw new Error('BLOCKED: PORT-05 existing-code CSV fixture missing');
  }
  await login(page, m, 'PORT-05', 'owner');
  await waitForImportSurface(page, m, f);
  const before = await readImportBusinessSnapshot(f);
  const codesBefore = await readCodeStatuses(f);
  expect(codesBefore.find((c) => c.id === consumedId)?.status).toBe(
    'CONSUMED',
  );
  const csv = readFileSync(csvPath, 'utf8');
  const { importId } = await createCodesImportJob(page, m, f, csv);
  const preview = await previewImportJob(page, m, f, importId);
  expect(preview.status).toBe(201);
  const previewBody = preview.json as {
    previewRevision: number;
    mappingRevision: number;
    fileHash: string;
    validRowCount: number;
  };
  expect(previewBody.validRowCount).toBe(3);
  const commitKey = randomUUID();
  const commit = await commitImportJob(
    page,
    m,
    f,
    importId,
    {
      previewRevision: previewBody.previewRevision,
      mappingRevision: previewBody.mappingRevision,
      fileHash: previewBody.fileHash,
    },
    commitKey,
  );
  expect(commit.status).toBeLessThan(300);
  const commitBody = commit.json as {
    committedRowCount: number;
    skippedRowCount: number;
    replayed: boolean;
  };
  expect(commitBody.replayed).toBe(false);
  expect(commitBody.committedRowCount).toBe(1);
  expect(commitBody.skippedRowCount).toBe(2);
  const codesAfter = await readCodeStatuses(f);
  expect(codesAfter.find((c) => c.id === consumedId)?.status).toBe('CONSUMED');
  expect(codesAfter.filter((c) => c.status === 'AVAILABLE').length).toBe(
    codesBefore.filter((c) => c.status === 'AVAILABLE').length + 1,
  );
  const replay = await commitImportJob(
    page,
    m,
    f,
    importId,
    {
      previewRevision: previewBody.previewRevision,
      mappingRevision: previewBody.mappingRevision,
      fileHash: previewBody.fileHash,
    },
    commitKey,
  );
  expect(replay.status).toBeLessThan(300);
  const replayBody = replay.json as {
    replayed: boolean;
    committedRowCount: number;
  };
  expect(replayBody.replayed).toBe(true);
  expect(replayBody.committedRowCount).toBe(commitBody.committedRowCount);
  const after = await readImportBusinessSnapshot(f);
  expect(after.commit_ops).toBe(before.commit_ops + 1);
  expect(after.codes).toBe(before.codes + 1);
});

test('[PORT-05] row limit preview is rejected without extra business mutation', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-05');
  const limitPath = f.data?.rowLimitCsvPath;
  if (typeof limitPath !== 'string') {
    throw new Error('BLOCKED: PORT-05 row-limit CSV fixture missing');
  }
  await login(page, m, 'PORT-05', 'owner');
  await waitForImportSurface(page, m, f);
  const before = await readImportBusinessSnapshot(f);
  const beforeList = await bffGet(page, m, eventBff(f, '/imports?limit=50'));
  expect(beforeList.status).toBe(200);
  const beforeCount = (beforeList.json as { items: unknown[] }).items.length;
  const csv = readFileSync(limitPath, 'utf8');
  const { importId, fileHash } = await createCodesImportJob(page, m, f, csv);
  const afterCreate = await readImportBusinessSnapshot(f);
  expect(afterCreate.import_jobs).toBe(before.import_jobs + 1);
  expect(businessRowsUnchanged(before, afterCreate)).toBe(true);
  const preview = await previewImportJob(page, m, f, importId, fileHash);
  expect(preview.status).toBe(422);
  expect((preview.json as { code: string }).code).toBe('IMPORT_ROW_LIMIT');
  const afterPreview = await readImportBusinessSnapshot(f);
  expect(businessRowsUnchanged(afterCreate, afterPreview)).toBe(true);
  const after = await bffGet(page, m, eventBff(f, '/imports?limit=50'));
  expect(after.status).toBe(200);
  expect((after.json as { items: unknown[] }).items.length).toBe(
    beforeCount + 1,
  );
});

test('[PORT-05] foreign tenant and event cannot read owner import jobs or files', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-05');
  const foreignTenantId = f.data?.foreignTenantId;
  const foreignEventId = f.data?.foreignEventId;
  const otherEventId = f.data?.otherEventId;
  if (
    typeof foreignTenantId !== 'string' ||
    typeof foreignEventId !== 'string' ||
    typeof otherEventId !== 'string' ||
    !f.csvPath
  ) {
    throw new Error('BLOCKED: PORT-05 foreign scope fixture missing');
  }
  await login(page, m, 'PORT-05', 'owner');
  await waitForImportSurface(page, m, f);
  const before = await readImportBusinessSnapshot(f);
  const csv = readFileSync(f.csvPath, 'utf8');
  const { importId, fileId } = await createCodesImportJob(page, m, f, csv);
  const preview = await previewImportJob(page, m, f, importId);
  expect(preview.status).toBe(201);
  const beforeDeny = await readImportBusinessSnapshot(f);
  await relogin(page, m, 'PORT-05', 'otherAttendee');
  const wrongEvent = await bffGet(
    page,
    m,
    `/api/bff/tenants/${encodeURIComponent(f.tenantId)}/events/${encodeURIComponent(otherEventId)}/imports/${encodeURIComponent(importId)}`,
  );
  expect(wrongEvent.status).toBeGreaterThanOrEqual(400);
  const wrongTenant = await bffGet(
    page,
    m,
    `/api/bff/tenants/${encodeURIComponent(foreignTenantId)}/events/${encodeURIComponent(foreignEventId)}/imports/${encodeURIComponent(importId)}`,
  );
  expect(wrongTenant.status).toBeGreaterThanOrEqual(400);
  const ownerEventDenied = await bffGet(
    page,
    m,
    `/api/bff/tenants/${encodeURIComponent(f.tenantId)}/events/${encodeURIComponent(f.eventId)}/imports/${encodeURIComponent(importId)}`,
  );
  expect(ownerEventDenied.status).toBeGreaterThanOrEqual(400);
  const rogueKey = randomUUID();
  const foreignCreate = await bffMutate(
    page,
    portalUrl(
      m,
      `/api/bff/tenants/${encodeURIComponent(foreignTenantId)}/events/${encodeURIComponent(foreignEventId)}/imports`,
    ),
    {
      kind: 'CODES',
      sourceId: f.data.foreignSourceId,
      ticketTypeId: f.data.foreignTicketTypeId,
      fileId,
      columnMapping: { code: 'code' },
      idempotencyKey: rogueKey,
    },
    'POST',
    rogueKey,
  );
  expect(foreignCreate.status).toBeGreaterThanOrEqual(400);
  const errorsDenied = await bffGet(
    page,
    m,
    `/api/bff/tenants/${encodeURIComponent(f.tenantId)}/events/${encodeURIComponent(f.eventId)}/imports/${encodeURIComponent(importId)}/errors`,
  );
  expect(errorsDenied.status).toBeGreaterThanOrEqual(400);
  const after = await readImportBusinessSnapshot(f);
  expect(businessRowsUnchanged(beforeDeny, after)).toBe(true);
});

test('[PORT-11] Portal staff invite emits a real worker email to Mailpit', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-11');
  const email = f.data?.inviteeEmail;
  if (typeof email !== 'string')
    throw new Error('BLOCKED: PORT-11 verified staff invitee email missing');
  await login(page, m, 'PORT-11', 'owner');
  await page.goto(portalUrl(m, `/t/${f.tenantId}/members`));
  await page.getByPlaceholder('email@example.com').fill(email);
  const invite = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/bff/tenants/${f.tenantId}/invites`) &&
      r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Gửi lời mời' }).click();
  expect((await invite).status()).toBeLessThan(300);
  const invites = await bffGet(
    page,
    m,
    `/api/bff/tenants/${f.tenantId}/invites`,
  );
  expect(invites.status).toBe(200);
  expect(JSON.stringify(invites.json)).not.toContain(email);
  const mailpit = new URL('/api/v1/messages', m.origins.mailpit).toString();
  await expect
    .poll(
      async () => {
        const response = await page.request.get(mailpit, {
          failOnStatusCode: false,
        });
        if (response.status() !== 200) return false;
        const body = (await response.json()) as {
          messages?: Array<{ To?: Array<{ Address?: string }> }>;
        };
        return (
          body.messages?.some((message) =>
            message.To?.some(
              (recipient) =>
                recipient.Address?.toLowerCase() === email.toLowerCase(),
            ),
          ) ?? false
        );
      },
      { timeout: 45_000, intervals: [1000, 2000, 3000] },
    )
    .toBe(true);
});
