import {
  test,
  expect,
  loadManifest,
  accountFor,
} from '../harness/fixtures';
import { walletTicketIds } from './helpers';
import {
  assertInvitationQuotaDelta,
  readInvitationEventSnapshot,
} from './invitation-db';
import {
  dispatchWeb13Invitation,
  fillClaim,
  openClaimAsRecipient,
  portalLogin,
} from './claim-flow';

for (const branch of ['auto', 'manual'] as const) {
  test(`[WEB-13] Portal GUESTS → InvitationReady → ${branch.toUpperCase()} claim`, async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const manifest = loadManifest();
    const portalContext = await browser.newContext();
    const attendeeContext = await browser.newContext();
    try {
      const portal = await portalContext.newPage();
      const attendee = await attendeeContext.newPage();
      const { f, eventId, answers, recipient, claimUrl } =
        await dispatchWeb13Invitation(portal, manifest, branch);
      await openClaimAsRecipient(attendee, manifest, claimUrl, recipient);
      await expect(
        attendee.getByRole('button', { name: 'Nhận vé mời' }),
      ).toBeEnabled();
      await fillClaim(attendee, answers);
      const before = await walletTicketIds(attendee, manifest, f.tenantId);
      const quotaBeforeClaim = await readInvitationEventSnapshot(f, eventId);
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
        await attendee.goto(
          new URL('/wallet', manifest.origins.web).toString(),
        );
        await attendee.getByTestId(`wallet-ticket-${result.ticketId}`).click();
        await expect(
          attendee.getByTestId('owner-ticket-qr-figure'),
        ).toBeVisible();
        const afterAuto = await readInvitationEventSnapshot(f, eventId);
        assertInvitationQuotaDelta(
          quotaBeforeClaim,
          afterAuto,
          1,
          'AUTO claim',
        );
      } else {
        await expect(attendee.getByTestId('guest-claim-result')).toContainText(
          'Chưa phải vé',
        );
        expect(result.requestId).toBeTruthy();
        expect(await walletTicketIds(attendee, manifest, f.tenantId)).toEqual(
          before,
        );
        const pendingState = await readInvitationEventSnapshot(f, eventId);
        assertInvitationQuotaDelta(
          quotaBeforeClaim,
          pendingState,
          0,
          'MANUAL claim pending',
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
          const approvedState = await readInvitationEventSnapshot(f, eventId);
          assertInvitationQuotaDelta(
            pendingState,
            approvedState,
            1,
            'MANUAL manager approve',
          );
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
