import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import { bffGet, eventBff, eventPath, login, portalUrl } from './helpers';

test('[PORT-05] CSV upload, preview and commit flow uses isolated event', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'PORT-05');
  const sourceLabel = f.data?.sourceLabel;
  const typeLabel = f.data?.ticketTypeLabel;
  if (
    !f.csvPath ||
    typeof sourceLabel !== 'string' ||
    typeof typeLabel !== 'string'
  ) {
    throw new Error('BLOCKED: PORT-05 CSV and catalog labels missing');
  }
  await login(page, m, 'PORT-05', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/guests#import')));
  await page.getByText('Vận hành', { exact: true }).click();
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
  await page.locator('input[type=file]').setInputFiles(f.csvPath);
  const create = page.waitForResponse(
    (r) =>
      r.url().includes(`${eventBff(f, '/imports')}`) &&
      r.request().method() === 'POST' &&
      !r.url().includes('/upload'),
  );
  await page.getByRole('button', { name: 'Upload + tạo job' }).click();
  expect((await create).status()).toBeLessThan(300);
  await expect(page.getByTestId('import-job-result')).toBeVisible();
  const preview = page.waitForResponse(
    (r) => r.url().includes('/preview') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Xem trước' }).click();
  expect((await preview).status()).toBe(201);
  await expect(page.getByTestId('import-job-result')).toBeVisible();
  const commit = page.waitForResponse(
    (r) => r.url().includes('/commit') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ghi nhận import' }).click();
  expect((await commit).status()).toBeLessThan(300);
  await expect(page.getByTestId('import-job-result')).toBeVisible();
  const jobs = await bffGet(page, m, eventBff(f, '/imports?limit=20'));
  expect(jobs.status).toBe(200);
  expect((jobs.json as { items: unknown[] }).items.length).toBeGreaterThan(0);
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
