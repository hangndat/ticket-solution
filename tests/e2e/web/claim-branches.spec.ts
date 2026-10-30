import { test, expect, loadManifest, accountFor } from '../harness/fixtures';
import {
  dispatchWeb13Invitation,
  fillClaim,
  openClaimAsRecipient,
  attachClaimPublicSchemaDiagnostics,
  flushClaimPublicSchemaDiagnostics,
  type ClaimPublicSchemaDiag,
  portalLogin,
} from './claim-flow';
import {
  countTicketsForOwner,
  expireDispatchedInvitations,
} from './invitation-db';
import { walletTicketIds } from './helpers';
import { randomUUID } from 'node:crypto';

test('[WEB-13] wrong verified email cannot claim AUTO invitation', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const manifest = loadManifest();
  const portalContext = await browser.newContext();
  const wrongContext = await browser.newContext();
  try {
    const portal = await portalContext.newPage();
    const wrong = await wrongContext.newPage();
    const { f, claimUrl, answers } = await dispatchWeb13Invitation(
      portal,
      manifest,
      'auto',
      'wrongEmail',
    );
    const wrongActor = accountFor(manifest, 'WEB-13', 'otherAttendee');
    await openClaimAsRecipient(wrong, manifest, claimUrl, wrongActor);
    await fillClaim(wrong, answers);
    const before = await walletTicketIds(wrong, manifest, f.tenantId);
    const claimResponsePromise = wrong.waitForResponse(
      (response) =>
        response.url().endsWith('/api/bff/claim') &&
        response.request().method() === 'POST',
    );
    await wrong.getByRole('button', { name: 'Nhận vé mời' }).click();
    const claimResponse = await claimResponsePromise;
    expect(claimResponse.status()).toBe(403);
    expect(((await claimResponse.json()) as { code?: string }).code).toBe(
      'INVITATION_EMAIL_MISMATCH',
    );
    expect(await walletTicketIds(wrong, manifest, f.tenantId)).toEqual(before);
  } finally {
    await Promise.allSettled([portalContext.close(), wrongContext.close()]);
  }
});

test('[WEB-13] unverified identity cannot claim invitation', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const manifest = loadManifest();
  const portalContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const portal = await portalContext.newPage();
    const guest = await guestContext.newPage();
    const { f, claimUrl, answers } = await dispatchWeb13Invitation(
      portal,
      manifest,
      'auto',
      'unverified',
    );
    const unverified = accountFor(manifest, 'WEB-13', 'unverified');
    await openClaimAsRecipient(guest, manifest, claimUrl, unverified);
    await fillClaim(guest, answers);
    const before = await walletTicketIds(guest, manifest, f.tenantId);
    const claimResponsePromise = guest.waitForResponse(
      (response) =>
        response.url().endsWith('/api/bff/claim') &&
        response.request().method() === 'POST',
    );
    await guest.getByRole('button', { name: 'Nhận vé mời' }).click();
    const claimResponse = await claimResponsePromise;
    expect(claimResponse.status()).toBe(403);
    expect(((await claimResponse.json()) as { code?: string }).code).toBe(
      'EMAIL_NOT_VERIFIED',
    );
    expect(await walletTicketIds(guest, manifest, f.tenantId)).toEqual(before);
  } finally {
    await Promise.allSettled([portalContext.close(), guestContext.close()]);
  }
});

test('[WEB-13] second claim with a new idempotency key is rejected after AUTO success', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const manifest = loadManifest();
  const portalContext = await browser.newContext();
  const attendeeContext = await browser.newContext();
  try {
    const portal = await portalContext.newPage();
    const attendee = await attendeeContext.newPage();
    const { f, answers, recipient, claimUrl, eventId } =
      await dispatchWeb13Invitation(
      portal,
      manifest,
      'auto',
      'secondClaim',
    );
    const schemaDiag: ClaimPublicSchemaDiag[] = [];
    attachClaimPublicSchemaDiagnostics(attendee, schemaDiag);
    try {
      await openClaimAsRecipient(attendee, manifest, claimUrl, recipient);
    } catch (err) {
      await flushClaimPublicSchemaDiagnostics(
        'secondClaim-openClaimAsRecipient',
        { tenantId: f.tenantId, eventId },
        schemaDiag,
        attendee,
        claimUrl,
      );
      throw err;
    }
    await flushClaimPublicSchemaDiagnostics(
      'secondClaim-after-open',
      { tenantId: f.tenantId, eventId },
      schemaDiag,
      attendee,
      claimUrl,
    );
    await fillClaim(attendee, answers);
    const first = attendee.waitForResponse(
      (response) =>
        response.url().endsWith('/api/bff/claim') &&
        response.request().method() === 'POST',
    );
    await attendee.getByRole('button', { name: 'Nhận vé mời' }).click();
    const firstResponse = await first;
    expect([200, 201, 202]).toContain(firstResponse.status());
    const ownerId = recipient.userId!;
    expect(await countTicketsForOwner(f, ownerId, eventId)).toBe(1);
    const firstPayload = firstResponse.request().postDataJSON() as Record<
      string,
      unknown
    >;
    const secondResponse = await attendee.request.post(
      new URL('/api/bff/claim', manifest.origins.web).toString(),
      {
        data: { ...firstPayload, idempotencyKey: randomUUID() },
        headers: { Origin: manifest.origins.web },
        failOnStatusCode: false,
      },
    );
    expect(secondResponse.status()).toBe(410);
    expect(((await secondResponse.json()) as { code?: string }).code).toMatch(
      /INVITATION_TOKEN_INVALID|IDEMPOTENCY/,
    );
    expect(await countTicketsForOwner(f, ownerId, eventId)).toBe(1);
  } finally {
    await Promise.allSettled([
      portalContext.close(),
      attendeeContext.close(),
    ]);
  }
});

test('[WEB-13] MANUAL manager reject leaves attendee without ticket', async ({
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
      await dispatchWeb13Invitation(
        portal,
        manifest,
        'manual',
        'primary',
        'managerReject',
      );
    await openClaimAsRecipient(attendee, manifest, claimUrl, recipient);
    await fillClaim(attendee, answers);
    const before = await walletTicketIds(attendee, manifest, f.tenantId);
    const claimResponsePromise = attendee.waitForResponse(
      (response) =>
        response.url().endsWith('/api/bff/claim') &&
        response.request().method() === 'POST',
    );
    await attendee.getByRole('button', { name: 'Nhận vé mời' }).click();
    const claimResponse = await claimResponsePromise;
    expect([200, 201, 202]).toContain(claimResponse.status());
    const result = (await claimResponse.json()) as { requestId?: string };
    expect(result.requestId).toBeTruthy();
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
      await row.getByRole('button', { name: 'Từ chối' }).click();
      const dialog = managerPage.getByRole('dialog');
      await dialog.locator('textarea').fill('E2E reject WEB-13');
      const denied = managerPage.waitForResponse(
        (response) =>
          response.url().includes(`/redemptions/${result.requestId}/deny`) &&
          response.request().method() === 'POST',
      );
      await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click();
      expect([200, 201]).toContain((await denied).status());
      await attendee
        .getByRole('button', { name: 'Kiểm tra trạng thái' })
        .click();
      await expect(attendee.getByTestId('guest-claim-result')).not.toContainText(
        'thành công',
      );
      expect(await walletTicketIds(attendee, manifest, f.tenantId)).toEqual(before);
    } finally {
      await managerContext.close();
    }
  } finally {
    await Promise.allSettled([
      portalContext.close(),
      attendeeContext.close(),
    ]);
  }
});

test('[WEB-13] expired invitation token is rejected at claim', async ({
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
      await dispatchWeb13Invitation(portal, manifest, 'auto', 'expired');
    const expired = await expireDispatchedInvitations(f, eventId);
    expect(expired).toBeGreaterThan(0);
    await openClaimAsRecipient(attendee, manifest, claimUrl, recipient);
    await fillClaim(attendee, answers);
    const before = await walletTicketIds(attendee, manifest, f.tenantId);
    const claimResponsePromise = attendee.waitForResponse(
      (response) =>
        response.url().endsWith('/api/bff/claim') &&
        response.request().method() === 'POST',
    );
    await attendee.getByRole('button', { name: 'Nhận vé mời' }).click();
    const claimResponse = await claimResponsePromise;
    expect(claimResponse.status()).toBe(410);
    expect(((await claimResponse.json()) as { code?: string }).code).toBe(
      'INVITATION_EXPIRED',
    );
    expect(await walletTicketIds(attendee, manifest, f.tenantId)).toEqual(before);
  } finally {
    await Promise.allSettled([
      portalContext.close(),
      attendeeContext.close(),
    ]);
  }
});
