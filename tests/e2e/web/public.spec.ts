import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import { caseData, eventPath, login, webUrl } from './helpers';

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

test('[WEB-09] owner list/detail/QR remain private across attendees', async ({
  browser,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-09');
  if (!f.ticketId)
    throw new Error('BLOCKED: WEB-09 cần ticketId thuộc attendee');
  const contextX = await browser.newContext();
  const contextY = await browser.newContext();
  try {
    const x = await contextX.newPage();
    const y = await contextY.newPage();
    await login(x, manifest, accountFor(manifest, 'WEB-09', 'attendee'));
    await login(y, manifest, accountFor(manifest, 'WEB-09', 'otherAttendee'));
    await x.goto(webUrl(manifest, '/wallet'));
    await expect(x.getByTestId(`wallet-ticket-${f.ticketId}`)).toBeVisible();
    await y.goto(webUrl(manifest, '/wallet'));
    await expect(y.getByTestId(`wallet-ticket-${f.ticketId}`)).toHaveCount(0);
    const detail = `/t/${f.tenantSlug}/tickets/${f.ticketId}?tenantId=${f.tenantId}`;
    await y.goto(webUrl(manifest, detail));
    await expect(y.getByTestId('owner-ticket-ready')).toHaveCount(0);
    await expect(
      y
        .getByTestId('owner-ticket-forbidden')
        .or(y.getByTestId('owner-ticket-missing')),
    ).toBeVisible();
    const response = await y.request.get(
      webUrl(manifest, `/api/bff/tickets/${f.ticketId}?tenantId=${f.tenantId}`),
    );
    expect([403, 404]).toContain(response.status());
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
