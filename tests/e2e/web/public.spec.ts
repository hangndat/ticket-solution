import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import { caseData, eventPath, login, webUrl } from './helpers';
import { readWeb09Database } from './web09-db';

test('[WEB-01] only published projection is discoverable', async ({ page }) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-01');
  const draftSlug = caseData<string>(f, 'draftEventSlug');
  const draftId = caseData<string>(f, 'draftEventId');
  const privateSlug = caseData<string>(f, 'privateEventSlug');
  const privateId = caseData<string>(f, 'privateEventId');
  await page.goto(webUrl(manifest, '/'));
  await expect(page.getByTestId(`home-event-${f.eventId}`)).toBeVisible();
  await expect(page.getByTestId(`home-event-${draftId}`)).toHaveCount(0);
  await expect(page.getByTestId(`home-event-${privateId}`)).toHaveCount(0);
  await page.goto(webUrl(manifest, eventPath(f)));
  await expect(page.getByTestId('event-published')).toBeVisible();
  await page.goto(webUrl(manifest, `/t/${f.tenantSlug}/events/${draftSlug}`));
  const draftApi = await page.request.get(
    new URL(
      `/v1/public/tenants/${f.tenantSlug}/events/${draftSlug}`,
      manifest.origins.api,
    ).toString(),
  );
  expect(draftApi.status()).toBe(404);
  await expect(page.getByTestId('event-published')).toHaveCount(0);
  const privateApi = await page.request.get(
    new URL(
      `/v1/public/tenants/${f.tenantSlug}/events/${privateSlug}`,
      manifest.origins.api,
    ).toString(),
  );
  expect(
    privateApi.status(),
    'PRD M03: UNLISTED event remains accessible by direct link',
  ).toBe(200);
  await page.goto(webUrl(manifest, `/t/${f.tenantSlug}/events/${privateSlug}`));
  await expect(page.getByTestId('event-published')).toBeVisible();
});

test('[WEB-09] multi-tenant owner wallet and private detail/QR/request/operation', async ({
  browser,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-09');
  if (!f.ticketId)
    throw new Error('BLOCKED: WEB-09 cần ticketId thuộc attendee');
  if (!f.requestId)
    throw new Error('BLOCKED: WEB-09 cần requestId thuộc attendee');
  const otherTenantId = caseData<string>(f, 'otherTenantId');
  const otherTenantSlug = caseData<string>(f, 'otherTenantSlug');
  const otherTickets = caseData<
    Record<'ACTIVE' | 'REVOKED' | 'CANCELLED', string>
  >(f, 'otherTickets');
  const operationKey = caseData<string>(f, 'operationKey');
  const actorX = accountFor(manifest, 'WEB-09', 'attendee');
  const actorY = accountFor(manifest, 'WEB-09', 'otherAttendee');
  if (!actorX.userId || !actorY.userId)
    throw new Error('BLOCKED: WEB-09 cần identity PostgreSQL của X/Y');
  for (const tenantId of [f.tenantId, otherTenantId]) {
    const db = await readWeb09Database(f, tenantId, [
      actorX.userId,
      actorY.userId,
    ]);
    expect(db.memberships).toHaveLength(0);
    const expected =
      tenantId === f.tenantId
        ? { [f.ticketId]: 'ACTIVE' }
        : Object.fromEntries(
            Object.entries(otherTickets).map(([state, id]) => [id, state]),
          );
    expect(
      Object.fromEntries(db.tickets.map((row) => [row.id, row.state])),
    ).toEqual(expected);
    expect(db.tickets.every((row) => row.owner_user_id === actorX.userId)).toBe(
      true,
    );
    expect(
      db.operations.every((row) => row.actor_user_id === actorX.userId),
    ).toBe(true);
    if (tenantId === f.tenantId) {
      expect(db.tickets[0].request_id).toBe(f.requestId);
      expect(db.operations.some((row) => row.client_key === operationKey)).toBe(
        true,
      );
    }
  }
  const contextX = await browser.newContext();
  const contextY = await browser.newContext();
  try {
    const x = await contextX.newPage();
    const y = await contextY.newPage();
    await login(x, manifest, actorX);
    await login(y, manifest, actorY);
    await x.goto(webUrl(manifest, '/wallet'));
    for (const id of [f.ticketId, ...Object.values(otherTickets)])
      await expect(x.getByTestId(`wallet-ticket-${id}`)).toBeVisible();
    await y.goto(webUrl(manifest, '/wallet'));
    for (const [tenantId, tenantSlug, ticketId] of [
      [f.tenantId, f.tenantSlug, f.ticketId],
      [otherTenantId, otherTenantSlug, otherTickets.ACTIVE],
    ]) {
      await expect(y.getByTestId(`wallet-ticket-${ticketId}`)).toHaveCount(0);
      const list = await y.request.get(
        webUrl(manifest, `/api/bff/tickets?tenantId=${tenantId}`),
      );
      expect(list.status()).toBe(200);
      expect((await list.json()).tickets).toEqual([]);
      const detail = `/t/${tenantSlug}/tickets/${ticketId}?tenantId=${tenantId}`;
      await y.goto(webUrl(manifest, detail));
      await expect(y.getByTestId('owner-ticket-qr-figure')).toHaveCount(0);
      await expect(
        y
          .getByTestId('owner-ticket-forbidden-state')
          .or(y.getByTestId('owner-ticket-missing-state')),
      ).toBeVisible();
      const response = await y.request.get(
        webUrl(manifest, `/api/bff/tickets/${ticketId}?tenantId=${tenantId}`),
      );
      expect([403, 404]).toContain(response.status());
    }
    for (const [path, expected] of [
      [`/api/bff/redemptions/${f.requestId}?tenantId=${f.tenantId}`, 200],
      [
        `/api/bff/operations/${operationKey}?tenantId=${f.tenantId}&eventId=${f.eventId}`,
        200,
      ],
    ] as const) {
      expect((await x.request.get(webUrl(manifest, path))).status()).toBe(
        expected,
      );
      expect([403, 404]).toContain(
        (await y.request.get(webUrl(manifest, path))).status(),
      );
    }
    for (const [state, ticketId] of Object.entries(otherTickets)) {
      await x.goto(
        webUrl(
          manifest,
          `/t/${otherTenantSlug}/tickets/${ticketId}?tenantId=${otherTenantId}`,
        ),
      );
      await expect(x.getByTestId('owner-ticket-state')).toHaveText(state);
      await expect(x.getByTestId('owner-ticket-state-tag')).toHaveText(
        state === 'ACTIVE'
          ? 'Sẵn sàng'
          : state === 'REVOKED'
            ? 'Đã thu hồi'
            : 'Đã hủy',
      );
      if (state !== 'ACTIVE')
        await expect(x.getByTestId('owner-ticket-state-notice')).toContainText(
          'Không dùng mã này',
        );
    }
  } finally {
    await contextX.close();
    await contextY.close();
  }
});

test('[WEB-11] 390px event, redemption and ticket CTA stay operable', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-11');
  if (!f.ticketId)
    throw new Error('BLOCKED: WEB-11 cần ticketId thuộc attendee');
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, manifest, accountFor(manifest, 'WEB-11', 'attendee'));
  await page.goto(webUrl(manifest, eventPath(f)));
  await expect(
    page
      .getByTestId('event-sidebox')
      .getByRole('link', { name: 'Đổi mã lấy vé' }),
  ).toBeVisible();
  await page
    .getByTestId('event-sidebox')
    .getByRole('link', { name: 'Đổi mã lấy vé' })
    .click();
  await expect(page.locator('#redeem-code-confirm')).toBeVisible();
  await page.goto(
    webUrl(
      manifest,
      `/t/${f.tenantSlug}/tickets/${f.ticketId}?tenantId=${f.tenantId}`,
    ),
  );
  await expect(page.getByTestId('owner-ticket-qr-figure')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});

test('[WEB-12] marketing VI/EN, demo CTA, and public links', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'WEB-12');
  for (const path of [
    '/',
    '/en',
    '/privacy',
    '/en/privacy',
    '/support',
    '/en/support',
  ]) {
    const response = await page.goto(
      new URL(path, manifest.origins.marketing).toString(),
    );
    expect(response?.status()).toBe(200);
  }
  await page.goto(manifest.origins.marketing);
  const toApp = page.locator(`a[href^="${manifest.origins.web}"]`).first();
  await expect(toApp).toBeVisible();
  await expect(
    page.locator(`a[href="${manifest.origins.web}/?demo=1"]`).first(),
  ).toBeVisible();
  await page.goto(new URL('/en', manifest.origins.marketing).toString());
  await expect(page.getByTestId('marketing-surface')).toHaveAttribute(
    'data-locale',
    'en',
  );
});
