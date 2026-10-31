import type { Page } from 'playwright/test';
import { expect } from 'playwright/test';
import type { CaseFixture, E2EManifest } from '../harness/contract';
import { accountFor } from '../harness/fixtures';
import { portalLogin } from './claim-flow';

export async function loginWeb06Manager(
  page: Page,
  manifest: E2EManifest,
  f: CaseFixture,
) {
  const manager = accountFor(manifest, 'WEB-06', 'manager');
  await portalLogin(
    page,
    manifest.origins.portal,
    manager.username,
    manager.password,
    `/t/${f.tenantId}/e/${f.eventId}/guests`,
  );
}

async function openPendingRow(
  page: Page,
  manifest: E2EManifest,
  f: CaseFixture,
  requestId: string,
) {
  await page.goto(
    new URL(
      `/t/${f.tenantId}/e/${f.eventId}/guests#pending`,
      manifest.origins.portal,
    ).toString(),
  );
  const pending = page.locator('#pending');
  await pending
    .getByPlaceholder('Tìm theo mã UUID của yêu cầu')
    .fill(requestId);
  await pending
    .getByRole('button', { name: 'Áp dụng bộ lọc chờ duyệt' })
    .click();
  const row = pending.getByRole('row', { name: new RegExp(requestId) });
  await expect(row).toBeVisible();
  return row;
}

export async function portalApproveRedemptionRequest(
  page: Page,
  manifest: E2EManifest,
  f: CaseFixture,
  requestId: string,
): Promise<{ ticketId: string }> {
  await loginWeb06Manager(page, manifest, f);
  const row = await openPendingRow(page, manifest, f, requestId);
  const approved = page.waitForResponse(
    (response) =>
      response.url().includes(`/redemptions/${requestId}/approve`) &&
      response.request().method() === 'POST',
  );
  await row.getByRole('button', { name: 'Duyệt' }).click();
  const response = await approved;
  expect([200, 201]).toContain(response.status());
  const body = (await response.json()) as { ticketId?: string };
  expect(body.ticketId).toMatch(/^[0-9a-f-]{36}$/i);
  return { ticketId: body.ticketId! };
}

export async function portalDenyRedemptionRequest(
  page: Page,
  manifest: E2EManifest,
  f: CaseFixture,
  requestId: string,
  reason: string,
) {
  await loginWeb06Manager(page, manifest, f);
  const row = await openPendingRow(page, manifest, f, requestId);
  await row.getByRole('button', { name: 'Từ chối' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(reason);
  const denied = page.waitForResponse(
    (response) =>
      response.url().includes(`/redemptions/${requestId}/deny`) &&
      response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click();
  const response = await denied;
  expect([200, 201]).toContain(response.status());
  expect(await response.json()).toMatchObject({
    decision: 'deny',
    requestId,
    status: 'REJECTED',
    ticketId: null,
  });
}

export async function refreshRedeemOwnerStatus(page: Page) {
  await page
    .getByRole('button', { name: 'Kiểm tra trạng thái yêu cầu' })
    .click();
}
