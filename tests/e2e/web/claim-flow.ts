import type { Page } from 'playwright/test';
import { expect } from 'playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { E2EManifest } from '../harness/contract';
import { accountFor, fixtureFor } from '../harness/fixtures';
import { caseData } from './helpers';
import { claimLink, waitForMail } from './mailpit';

export type Web13Branch = 'auto' | 'manual';

export type Web13AutoSlot =
  | 'primary'
  | 'wrongEmail'
  | 'unverified'
  | 'secondClaim'
  | 'expired';

export type Web13ManualSlot = 'primary' | 'managerReject';

type AutoSlotMeta = {
  eventId: string;
  eventName: string;
  csvPath: string;
};

type ManualSlotMeta = AutoSlotMeta & {
  sourceLabel: string;
  ticketTypeLabel: string;
};

export async function portalLogin(
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

export async function selectAntOption(
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

export async function fillClaim(
  page: Page,
  answers: Record<string, string | boolean>,
) {
  await expect(page.locator('#claim-terms-consent')).toBeVisible({
    timeout: 60_000,
  });
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

export type ClaimPublicSchemaDiag = {
  url: string;
  status: number;
  tenantId?: string;
  eventId?: string;
  termsVersion?: string;
  error?: string;
};

/** Captures public published-schema BFF responses (no secrets) for WEB-13 diagnostics. */
export function attachClaimPublicSchemaDiagnostics(
  page: Page,
  sink: ClaimPublicSchemaDiag[],
) {
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/bff/public/tenants/') || !url.includes('/events/')) {
      return;
    }
    const entry: ClaimPublicSchemaDiag = { url, status: response.status() };
    try {
      const body = (await response.json()) as {
        tenantId?: string;
        eventId?: string;
        terms?: { version?: string };
      };
      entry.tenantId = body.tenantId;
      entry.eventId = body.eventId;
      entry.termsVersion = body.terms?.version;
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
    }
    sink.push(entry);
  });
}

export function claimUrlPublicParams(claimUrl: string) {
  const hash = new URL(claimUrl).hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  return {
    tenantId: params.get('tenantId') ?? '',
    eventId: params.get('eventId') ?? '',
    tenantSlug: params.get('tenantSlug') ?? '',
    eventSlug: params.get('eventSlug') ?? '',
    hasToken: Boolean(params.get('token')?.trim()),
  };
}

export async function flushClaimPublicSchemaDiagnostics(
  label: string,
  expected: { tenantId: string; eventId: string },
  captured: ClaimPublicSchemaDiag[],
  page?: Page,
  claimUrl?: string,
) {
  const pageHint = page
    ? await page
        .locator('main')
        .innerText()
        .then((text) => text.slice(0, 500))
        .catch(() => '')
    : '';
  const summary = {
    label,
    expectedTenantId: expected.tenantId,
    expectedEventId: expected.eventId,
    claimUrlParams: claimUrl ? claimUrlPublicParams(claimUrl) : undefined,
    pageTextPreview: pageHint || undefined,
    responses: captured,
  };
  console.log(`[E2E WEB-13 schema diag] ${JSON.stringify(summary)}`);
  const runDir = process.env.E2E_RUN_DIR;
  if (runDir) {
    writeFileSync(
      resolve(runDir, 'web13-public-schema-diag.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
  }
  return summary;
}

export async function dispatchWeb13Invitation(
  portal: Page,
  manifest: E2EManifest,
  branch: Web13Branch,
  autoSlot: Web13AutoSlot = 'primary',
  manualSlot: Web13ManualSlot = 'primary',
): Promise<{
  f: ReturnType<typeof fixtureFor>;
  eventId: string;
  eventName: string;
  answers: Record<string, string | boolean>;
  recipient: ReturnType<typeof accountFor>;
  claimUrl: string;
}> {
  const f = fixtureFor(manifest, 'WEB-13');
  let eventId: string;
  let eventName: string;
  let csvPath: string;
  let sourceLabel: string;
  let typeLabel: string;
  if (branch === 'auto') {
    const slots = caseData<Record<string, AutoSlotMeta>>(f, 'autoSlots');
    const slot = slots[autoSlot] ?? {
      eventId: f.eventId,
      eventName: caseData<string>(f, 'eventName'),
      csvPath: caseData<string>(f, 'autoCsvPath'),
    };
    eventId = slot.eventId;
    eventName = slot.eventName;
    csvPath = slot.csvPath;
    sourceLabel = caseData<string>(f, 'autoSourceLabel');
    typeLabel = caseData<string>(f, 'ticketTypeLabel');
  } else {
    const slots = caseData<Record<string, ManualSlotMeta>>(f, 'manualSlots');
    const slot = slots[manualSlot] ?? {
      eventId: caseData<string>(f, 'manualEventId'),
      eventName: caseData<string>(f, 'manualEventName'),
      csvPath: caseData<string>(f, 'manualCsvPath'),
      sourceLabel: caseData<string>(f, 'manualSourceLabel'),
      ticketTypeLabel: caseData<string>(f, 'manualTicketTypeLabel'),
    };
    eventId = slot.eventId;
    eventName = slot.eventName;
    csvPath = slot.csvPath;
    sourceLabel = slot.sourceLabel;
    typeLabel = slot.ticketTypeLabel;
  }
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
  await portal.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(
    portal.getByRole('button', { name: 'Ghi nhận import' }),
  ).toBeEnabled();
  await portal.getByRole('button', { name: 'Ghi nhận import' }).click();
  await expect(portal.getByTestId('import-job-result')).toBeVisible();
  await portal.getByText('Phát lời mời', { exact: true }).click();
  const listInvitationsButton = portal.getByRole('button', {
    name: 'Liệt kê invitations',
  });
  await expect(listInvitationsButton).toBeVisible();
  const invitationsListUrl = new URL(
    `/api/bff/tenants/${encodeURIComponent(f.tenantId)}/events/${encodeURIComponent(eventId)}/invitations?limit=50`,
    manifest.origins.portal,
  ).toString();
  await expect
    .poll(
      async () => {
        const response = await portal.request.get(invitationsListUrl, {
          failOnStatusCode: false,
        });
        if (response.status() !== 200) return -1;
        const body = (await response.json()) as {
          items: Array<{ state?: string }>;
        };
        if (!Array.isArray(body.items)) return -1;
        return body.items.filter((row) => row.state === 'PENDING').length;
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBe(1);
  await expect(listInvitationsButton).toBeEnabled();
  const listed = portal.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/invitations?'),
    { timeout: 30_000 },
  );
  await listInvitationsButton.click();
  expect((await listed).status()).toBe(200);
  const previewed = portal.waitForResponse(
    (r) =>
      r.url().endsWith('/invitations/dispatch-preview') &&
      r.request().method() === 'POST',
  );
  await portal.getByRole('button', { name: 'Xem trước gửi' }).click();
  expect((await previewed).status()).toBe(201);
  await expect(
    portal.getByRole('button', { name: 'Gửi lời mời' }),
  ).toBeEnabled();
  await portal.getByRole('button', { name: 'Gửi lời mời' }).click();
  await expect(portal.getByTestId('invitation-dispatch-result')).toBeVisible();
  const mail = await waitForMail(
    portal,
    manifest,
    recipient.username,
    eventName,
  );
  const claimUrl = claimLink(mail, manifest.origins.web);
  return { f, eventId, eventName, answers, recipient, claimUrl };
}

export async function openClaimAsRecipient(
  attendee: Page,
  manifest: E2EManifest,
  claimUrl: string,
  recipient: ReturnType<typeof accountFor>,
  options?: { waitForClaimButton?: boolean },
) {
  await attendee.goto(claimUrl);
  await expect(
    attendee.getByRole('heading', { name: 'Nhận lời mời sự kiện' }),
  ).toBeVisible();
  await attendee
    .getByRole('link', { name: 'Đăng nhập bằng email được mời' })
    .click();
  await attendee.locator('#username').fill(recipient.username);
  await attendee.locator('#password').fill(recipient.password);
  await attendee.locator('#kc-login').click();
  await expect(attendee).toHaveURL(
    new RegExp(`^${manifest.origins.web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/claim(?:[?#]|$)`),
  );
  const expected = new URLSearchParams(new URL(claimUrl).hash.slice(1));
  await expect
    .poll(async () =>
      attendee.evaluate(
        ({ token, tenantId, eventId }) => {
          const raw = sessionStorage.getItem('vemoki_guest_claim_intent');
          if (!raw) return false;
          const intent = JSON.parse(raw) as {
            token?: string;
            tenantId?: string;
            eventId?: string;
          };
          return intent.token === token &&
            intent.tenantId === tenantId && intent.eventId === eventId;
        },
        {
          token: expected.get('token'),
          tenantId: expected.get('tenantId'),
          eventId: expected.get('eventId'),
        },
      ),
    )
    .toBe(true);
  if (options?.waitForClaimButton !== false) {
    await expect(attendee.locator('#claim-terms-consent')).toBeVisible({
      timeout: 60_000,
    });
  }
}
