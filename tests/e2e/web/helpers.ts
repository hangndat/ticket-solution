import type { Page, Response } from 'playwright/test';
import { expect } from '../harness/fixtures';
import type {
  CaseFixture,
  E2EManifest,
  TestAccount,
} from '../harness/contract';

export function webUrl(manifest: E2EManifest, path: string): string {
  return new URL(path, manifest.origins.web).toString();
}

export function eventPath(f: CaseFixture): string {
  return `/t/${encodeURIComponent(f.tenantSlug)}/events/${encodeURIComponent(f.eventSlug)}`;
}

export async function login(
  page: Page,
  manifest: E2EManifest,
  account: TestAccount,
  returnPath = '/wallet',
  onAuthorize?: () => Promise<void>,
) {
  let callbackError: string | null = null;
  const onResponse = (response: Response) => {
    if (new URL(response.url()).pathname !== '/api/auth/callback') return;
    const location = response.headers().location;
    if (location) {
      callbackError = new URL(location, manifest.origins.web).searchParams.get(
        'error',
      );
    }
  };
  page.on('response', onResponse);
  try {
    await page.goto(
      webUrl(
        manifest,
        `/api/auth/login?return=${encodeURIComponent(returnPath)}`,
      ),
    );
    await expect(page).toHaveURL(
      new RegExp(`^${escapeRegExp(manifest.origins.auth)}`),
    );
    await onAuthorize?.();
    await page.locator('#username').fill(account.username);
    await page.locator('#password').fill(account.password);
    await page.locator('#kc-login').click();
    await page.waitForURL(
      (url) =>
        url.origin === manifest.origins.web &&
        !url.pathname.startsWith('/api/auth/'),
    );
    const me = await page.request.get(webUrl(manifest, '/api/bff/me'));
    const location = new URL(page.url());
    if (me.status() !== 200) {
      const cookieNames = (
        await page.context().cookies(manifest.origins.web)
      ).map((cookie) => cookie.name);
      const failureBody: unknown = await me.json().catch(() => null);
      const failureCode =
        failureBody && typeof failureBody === 'object' && 'code' in failureBody
          ? String(failureBody.code)
          : 'none';
      expect(
        me.status(),
        `BFF identity after callback; page=${location.pathname}; notice=${location.searchParams.get('notice') || 'none'}; callbackError=${callbackError || 'none'}; accessCookie=${cookieNames.includes('oidc_access_token')}; refreshCookie=${cookieNames.includes('oidc_refresh_token')}; bffCode=${failureCode}`,
      ).toBe(200);
    }
    const body = (await me.json()) as Record<string, unknown>;
    if (account.userId) expect(JSON.stringify(body)).toContain(account.userId);
    return body;
  } finally {
    page.off('response', onResponse);
  }
}

export async function walletTicketIds(
  page: Page,
  manifest: E2EManifest,
  tenantId: string,
): Promise<string[]> {
  const response = await page.request.get(
    webUrl(
      manifest,
      `/api/bff/tickets?tenantId=${encodeURIComponent(tenantId)}`,
    ),
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    tickets?: Array<{ ticketId: string }>;
  };
  expect(Array.isArray(body.tickets)).toBe(true);
  return body.tickets!.map((ticket) => ticket.ticketId);
}

export function caseData<T>(fixture: CaseFixture, key: string): T {
  const value = fixture.data?.[key];
  if (value === undefined || value === null)
    throw new Error(`BLOCKED: thiếu cases.data.${key}`);
  return value as T;
}

/** Form fields are defined by the published server schema. Fixture values use field IDs, not labels. */
export async function fillPublishedForm(
  page: Page,
  answers: Record<string, string | boolean> = {},
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
  await page.locator('#terms-accepted').check();
}

export async function openCodeConfirmation(
  page: Page,
  manifest: E2EManifest,
  code: string,
) {
  await page.goto(webUrl(manifest, '/redeem'));
  await page.getByTestId('redeem-global-code').fill(code);
  await page.getByTestId('redeem-global-resolve').click();
  await expect(page.getByTestId('redeem-global-context')).toBeVisible();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
