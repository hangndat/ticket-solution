import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import type { Page } from 'playwright/test';
import { caseData, walletTicketIds, webUrl } from './helpers';
import { claimLink, waitForMail } from './mailpit';

type Branch = 'auto' | 'manual';

async function portalLogin(
  page: Page,
  origin: string,
  username: string,
  password: string,
  returnPath: string,
) {
  await page.goto(
    new URL(
      `/api/auth/login?return=${encodeURIComponent(returnPath)}`,
      origin,
    ).toString(),
  );
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await expect(page).toHaveURL(
    new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );
}

async function selectAntOption(
  page: Page,
  control: import('playwright/test').Locator,
  label: string,
) {
  await control.click();
  const option = page
    .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
    .filter({ hasText: label });
  await expect(option).toHaveText(label);
  await option.click();
}

async function fillClaim(
  page: Page,
  answers: Record<string, string | boolean>,
) {
  for (const [id, value] of Object.entries(answers)) {
    const field = page.locator(`[name=${JSON.stringify(id)}]`);
    if (typeof value === 'boolean') {
      if (value) await field.check();
      else await field.uncheck();
    } else if (await field.evaluate((el) => el.tagName === 'SELECT')) {
      await field.selectOption(value);
    } else {
      await field.fill(value);
    }
  }
  await page.locator('#claim-terms-consent').check();
}

for (const branch of ['auto', 'manual'] as const) {
  test(`[WEB-13] Portal GUESTS → InvitationReady → ${branch.toUpperCase()} claim`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-13');
    const eventId =
      branch === 'auto' ? f.eventId : caseData<string>(f, 'manualEventId');
    const sourceLabel = caseData<string>(
      f,
      branch === 'auto' ? 'autoSourceLabel' : 'manualSourceLabel',
    );
    const typeLabel = caseData<string>(
      f,
      branch === 'auto' ? 'ticketTypeLabel' : 'manualTicketTypeLabel',
    );
    const csvPath = caseData<string>(
      f,
      branch === 'auto' ? 'autoCsvPath' : 'manualCsvPath',
    );
    const eventName = caseData<string>(
      f,
      branch === 'auto' ? 'eventName' : 'manualEventName',
    );
    const answers = caseData<Record<string, string | boolean>>(
      f,
      branch === 'auto' ? 'autoAnswers' : 'manualAnswers',
    );
    const recipient = accountFor(
      manifest,
      'WEB-13',
      branch === 'auto' ? 'attendee' : 'otherAttendee',
    );
    const owner = accountFor(manifest, 'WEB-13', 'owner');
    const portalContext = await browser.newContext();
    const attendeeContext = await browser.newContext();
    try {
      const portal = await portalContext.newPage();
      const attendee = await attendeeContext.newPage();
      const guestsPath = `/t/${f.tenantId}/e/${eventId}/guests#resumed`;
      await portalLogin(
        portal,
        manifest.origins.portal,
        owner.username,
        owner.password,
        guestsPath,
      );
      await portal.goto(
        new URL(
          `/t/${f.tenantId}/e/${eventId}/guests#import`,
          manifest.origins.portal,
        ).toString(),
      );
      await portal.getByText('Vận hành', { exact: true }).click();
      const filters = portal.getByTestId('import-catalog-filters');
      await selectAntOption(
        portal,
        filters.locator('.ant-select').nth(0),
        sourceLabel,
      );
      await selectAntOption(
        portal,
        filters.locator('.ant-select').nth(1),
        typeLabel,
      );
      const kindControl = portal
        .locator('.ant-form-item')
        .filter({ hasText: 'Loại thao tác' })
        .locator('.ant-select');
      await selectAntOption(portal, kindControl, 'Danh sách khách (email)');
      await portal.locator('input[type="file"]').setInputFiles(csvPath);
      await portal.getByRole('button', { name: 'Upload + tạo job' }).click();
      await expect(
        portal.getByRole('button', { name: 'Xem trước', exact: true }),
      ).toBeEnabled();
      await portal
        .getByRole('button', { name: 'Xem trước', exact: true })
        .click();
      await expect(
        portal.getByRole('button', { name: 'Ghi nhận import' }),
      ).toBeEnabled();
      await portal.getByRole('button', { name: 'Ghi nhận import' }).click();
      await expect(portal.getByTestId('import-job-result')).toBeVisible();
      await portal.getByText('Phát lời mời', { exact: true }).click();
      await expect
        .poll(
          async () => {
            const listed = portal.waitForResponse(
              (response) =>
                response.request().method() === 'GET' &&
                response.url().includes('/invitations?'),
            );
            await portal
              .getByRole('button', { name: 'Liệt kê invitations' })
              .click();
            const response = await listed;
            expect(response.status()).toBe(200);
            const body = (await response.json()) as { items: unknown[] };
            expect(Array.isArray(body.items)).toBe(true);
            expect(body.items).toHaveLength(1);
            return await portal.locator('table tbody tr').count();
          },
          { timeout: 30_000, intervals: [250, 500, 1000] },
        )
        .toBe(1);
      const previewed = portal.waitForResponse(
        (r) =>
          r.url().endsWith('/invitations/dispatch-preview') &&
          r.request().method() === 'POST',
      );
      await portal.getByRole('button', { name: 'Xem trước gửi' }).click();
      expect(
        (await previewed).status(),
        'Nest POST dispatch preview returns HTTP 201',
      ).toBe(201);
      await expect(
        portal.getByRole('button', { name: 'Gửi lời mời' }),
      ).toBeEnabled();
      await portal.getByRole('button', { name: 'Gửi lời mời' }).click();
      await expect(
        portal.getByTestId('invitation-dispatch-result'),
      ).toBeVisible();

      const mail = await waitForMail(
        portal,
        manifest,
        recipient.username,
        eventName,
      );
      const link = claimLink(mail, manifest.origins.web);
      await attendee.goto(link);
      await expect(
        attendee.getByRole('heading', { name: 'Nhận lời mời sự kiện' }),
      ).toBeVisible();
      await attendee
        .getByRole('link', { name: 'Đăng nhập bằng email được mời' })
        .click();
      await attendee.locator('#username').fill(recipient.username);
      await attendee.locator('#password').fill(recipient.password);
      await attendee.locator('#kc-login').click();
      await expect(attendee).toHaveURL(/\/claim/);
      await expect(
        attendee.getByRole('button', { name: 'Nhận vé mời' }),
      ).toBeEnabled();
      await fillClaim(attendee, answers);
      const before = await walletTicketIds(attendee, manifest, f.tenantId);
      expect(before).toHaveLength(0);
      const claimResponsePromise = attendee.waitForResponse(
        (response) =>
          response.url().endsWith('/api/bff/claim') &&
          response.request().method() === 'POST',
      );
      await attendee.getByRole('button', { name: 'Nhận vé mời' }).click();
      const claimResponse = await claimResponsePromise;
      expect([200, 201, 202]).toContain(claimResponse.status());
      const result = (await claimResponse.json()) as {
        ticketId?: string;
        requestId?: string;
        status?: string;
      };

      if (branch === 'auto') {
        await expect(attendee.getByTestId('guest-claim-result')).toContainText(
          'Đổi mã thành công',
        );
        expect(result.ticketId).toBeTruthy();
        const after = await walletTicketIds(attendee, manifest, f.tenantId);
        expect(after.filter((id) => !before.includes(id))).toEqual([
          result.ticketId,
        ]);
        await attendee.goto(webUrl(manifest, '/wallet'));
        await attendee.getByTestId(`wallet-ticket-${result.ticketId}`).click();
        await expect(
          attendee.getByTestId('owner-ticket-qr-figure'),
        ).toBeVisible();
      } else {
        await expect(attendee.getByTestId('guest-claim-result')).toContainText(
          'Chưa phải vé',
        );
        expect(result.requestId).toBeTruthy();
        expect(await walletTicketIds(attendee, manifest, f.tenantId)).toEqual(
          before,
        );
        const manager = accountFor(manifest, 'WEB-13', 'manager');
        const managerContext = await browser.newContext();
        try {
          const managerPage = await managerContext.newPage();
          await portalLogin(
            managerPage,
            manifest.origins.portal,
            manager.username,
            manager.password,
            `/t/${f.tenantId}/e/${eventId}/guests`,
          );
          await managerPage.goto(
            new URL(
              `/t/${f.tenantId}/e/${eventId}/guests#pending`,
              manifest.origins.portal,
            ).toString(),
          );
          const row = managerPage
            .locator('table tbody tr')
            .filter({ hasText: result.requestId });
          await expect(row).toBeVisible();
          const approved = managerPage.waitForResponse(
            (response) =>
              response.url().includes(`/redemptions/${result.requestId}/approve`) &&
              response.request().method() === 'POST',
          );
          await row.getByRole('button', { name: 'Duyệt' }).click();
          expect([200, 201]).toContain((await approved).status());
          await expect(managerPage.getByTestId('pending-notice')).toBeVisible();
          await attendee
            .getByRole('button', { name: 'Kiểm tra trạng thái' })
            .click();
          await expect(
            attendee.getByTestId('guest-claim-result'),
          ).toContainText('thành công');
          const after = await walletTicketIds(attendee, manifest, f.tenantId);
          expect(after.filter((id) => !before.includes(id))).toHaveLength(1);
        } finally {
          await managerContext.close();
        }
      }
    } finally {
      await Promise.allSettled([
        portalContext.close(),
        attendeeContext.close(),
      ]);
    }
  });
}
