import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import {
  caseData,
  eventPath,
  fillPublishedForm,
  login,
  openCodeConfirmation,
  walletTicketIds,
  webUrl,
} from './helpers';
import { ticketLink, waitForMail } from './mailpit';

async function redeemCode(
  page: import('playwright/test').Page,
  manifest: import('../harness/contract').E2EManifest,
  caseId: string,
) {
  const f = fixtureFor(manifest, caseId);
  if (!f.code) throw new Error(`BLOCKED: ${caseId} cần code riêng`);
  await login(page, manifest, accountFor(manifest, caseId, 'attendee'));
  await openCodeConfirmation(page, manifest, f.code);
  await fillPublishedForm(
    page,
    f.data?.answers as Record<string, string | boolean> | undefined,
  );
  await page
    .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
    .click();
  return f;
}

test('[WEB-02] verified attendee redeems auto code and reloads QR', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = await redeemCode(page, manifest, 'WEB-02');
  await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
  const card = page.getByTestId('redeem-ticket-card');
  await expect(card).toBeVisible();
  const ticketId = (await card.locator('dd').first().textContent())?.trim();
  expect(ticketId).toMatch(/^[0-9a-f-]{36}$/i);
  const ids = await walletTicketIds(page, manifest, f.tenantId);
  expect(ids.filter((id) => id === ticketId)).toHaveLength(1);
  await page.goto(webUrl(manifest, '/wallet'));
  await expect(page.getByTestId(`wallet-ticket-${ticketId}`)).toBeVisible();
  await page.getByTestId(`wallet-ticket-${ticketId}`).click();
  await expect(page.getByTestId('owner-ticket-qr-figure')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('owner-ticket-qr-figure')).toBeVisible();
});

test('[WEB-03] event link and global entry resolve code to the same published event', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-03');
  if (!f.code) throw new Error('BLOCKED: WEB-03 cần code');
  await page.goto(webUrl(manifest, eventPath(f)));
  const eventTitle = (await page.locator('#event-title').textContent())?.trim();
  expect(eventTitle).toBeTruthy();
  await page
    .getByTestId('event-sidebox')
    .getByRole('link', { name: 'Đổi mã lấy vé' })
    .click();
  await expect(page).toHaveURL(/\/redeem\?tenantSlug=/);
  await expect(page.getByTestId('redeem-auth-gate')).toBeVisible();
  await page
    .getByTestId('redeem-auth-gate')
    .getByRole('link', { name: 'Tiếp tục đăng nhập' })
    .click();
  const actor = accountFor(manifest, 'WEB-03', 'attendee');
  await page.locator('#username').fill(actor.username);
  await page.locator('#password').fill(actor.password);
  await page.locator('#kc-login').click();
  await expect(page).toHaveURL(/\/redeem\?tenantSlug=/);
  await expect(page.locator('#redeem-code-confirm')).toBeVisible();
  await expect(page.locator('input[name="tenantSlug"]')).toHaveValue(
    f.tenantSlug,
  );
  await expect(page.locator('input[name="eventSlug"]')).toHaveValue(
    f.eventSlug,
  );
  await page.goto(webUrl(manifest, '/redeem'));
  await page.getByTestId('redeem-global-code').fill(f.code);
  await page.getByTestId('redeem-global-resolve').click();
  await expect(page.getByTestId('redeem-global-context')).toBeVisible();
  await expect(
    page.getByTestId('redeem-global-context').getByText(eventTitle!, {
      exact: true,
    }),
  ).toBeVisible();
});

test('[WEB-04] invalid code does not issue ticket or reveal owner data', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-04');
  await login(page, manifest, accountFor(manifest, 'WEB-04', 'attendee'));
  const before = await walletTicketIds(page, manifest, f.tenantId);
  await page.goto(webUrl(manifest, '/redeem'));
  await page
    .getByTestId('redeem-global-code')
    .fill(caseData<string>(f, 'invalidCode'));
  await page.getByTestId('redeem-global-resolve').click();
  await expect(page.getByTestId('redeem-ux-invalid')).toBeVisible();
  await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
  expect(await walletTicketIds(page, manifest, f.tenantId)).toEqual(before);
  await expect(page.getByTestId('redeem-ux-invalid')).not.toContainText('@');
});

test('[WEB-05] published form and terms block incomplete submission', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-05');
  if (!f.code) throw new Error('BLOCKED: WEB-05 cần code');
  await login(page, manifest, accountFor(manifest, 'WEB-05', 'attendee'));
  await openCodeConfirmation(page, manifest, f.code);
  let posted = false;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/bff/redeem')
    )
      posted = true;
  });
  await page
    .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
    .click();
  await expect(page.locator('#terms-accepted')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(posted).toBe(false);
  await fillPublishedForm(
    page,
    f.data?.answers as Record<string, string | boolean> | undefined,
  );
  await expect(page.locator('#terms-accepted')).toBeChecked();
});

test('[WEB-06] manual source stays pending without a QR before approval', async ({
  page,
}) => {
  const manifest = loadManifest();
  await redeemCode(page, manifest, 'WEB-06');
  await expect(page.getByTestId('redeem-ux-pending')).toBeVisible();
  await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
});

test('[WEB-07] double submit issues one ticket for a fresh code', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-07');
  if (!f.code) throw new Error('BLOCKED: WEB-07 cần code');
  await login(page, manifest, accountFor(manifest, 'WEB-07', 'attendee'));
  const before = await walletTicketIds(page, manifest, f.tenantId);
  await openCodeConfirmation(page, manifest, f.code);
  await fillPublishedForm(
    page,
    f.data?.answers as Record<string, string | boolean> | undefined,
  );
  const button = page.getByRole('button', {
    name: 'Đổi mã lấy vé',
    exact: true,
  });
  await button.dblclick();
  await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
  const after = await walletTicketIds(page, manifest, f.tenantId);
  expect(after.filter((id) => !before.includes(id))).toHaveLength(1);
});

test('[WEB-08] real worker delivers issued ticket email to run Mailpit', async ({
  page,
  browser,
}) => {
  test.setTimeout(75_000);
  const manifest = loadManifest();
  const f = await redeemCode(page, manifest, 'WEB-08');
  await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
  const actor = accountFor(manifest, 'WEB-08', 'attendee');
  const mail = await waitForMail(
    page,
    manifest,
    actor.username,
    caseData<string>(f, 'eventName'),
  );
  const url = ticketLink(mail, manifest.origins.web);
  const ticketId = url.match(/\/tickets\/([0-9a-f-]{36})/i)?.[1];
  expect(ticketId).toBeTruthy();
  expect(mail.Text ?? '').toContain(ticketId!);
  expect(mail.HTML ?? '').toContain('cid:ticket-qr');
  const guest = await browser.newContext();
  try {
    const guestPage = await guest.newPage();
    await guestPage.goto(url);
    await expect(
      guestPage.getByTestId('owner-ticket-need-login'),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
  await page.goto(url);
  await expect(page.getByTestId('owner-ticket-qr-figure')).toBeVisible();
});
