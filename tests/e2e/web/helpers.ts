import { createHmac } from 'node:crypto';
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

export function realmTokenUrl(manifest: E2EManifest): string {
  return new URL(
    `/realms/e2e-${manifest.runId}/protocol/openid-connect/token`,
    manifest.origins.auth,
  ).toString();
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split('.')[1];
  if (!segment) throw new Error('BLOCKED: malformed JWT in test');
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/** Only used for synthetic test fixtures provisioned by the local harness. */
function totpCode(secret: string, epochMs = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('BLOCKED: invalid TOTP fixture secret');
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(epochMs / 30_000)));
  const digest = createHmac('sha1', Buffer.from(bytes))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, '0');
}

/**
 * Mint a REAL Keycloak token for a different client/audience than the Web
 * BFF expects (e.g. the platform client), to assert the BFF rejects a
 * correctly-signed-but-wrong-audience token rather than trusting cookie shape.
 */
export async function mintCrossClientAccessToken(
  manifest: E2EManifest,
  account: TestAccount,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username: account.username,
    password: account.password,
    scope: 'openid profile email',
  });
  if (account.totpSecret) body.set('totp', totpCode(account.totpSecret));
  const response = await fetch(realmTokenUrl(manifest), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (response.status !== 200) {
    throw new Error(
      `BLOCKED: cross-client password grant failed (${response.status})`,
    );
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token)
    throw new Error('BLOCKED: no access_token in grant');
  return payload.access_token;
}

/**
 * Mint a REAL Keycloak token from the harness's secondary, fully independent
 * Keycloak realm (own signing keypair) — a genuinely different `iss` than
 * the primary run realm — to assert the BFF rejects a correctly-signed,
 * correct-audience token issued by a different realm.
 */
export async function mintSecondaryIssuerAccessToken(
  issuer: string,
  clientId: string,
  clientSecret: string,
  account: TestAccount,
): Promise<string> {
  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: account.username,
      password: account.password,
      scope: 'openid profile email',
    }),
  });
  if (response.status !== 200) {
    throw new Error(
      `BLOCKED: secondary issuer password grant failed (${response.status})`,
    );
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token)
    throw new Error('BLOCKED: no access_token in secondary-issuer grant');
  return payload.access_token;
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

/** Functional layout guard — not pixel-perfect scoring (WEB-11). */
export async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

/** Primary CTA must be visible, enabled, and fit the viewport width. */
export async function assertPrimaryButtonOperable(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

/** Form fields are defined by the published server schema. Fixture values use field IDs, not labels. */
export async function fillPublishedForm(
  page: Page,
  answers: Record<string, string | boolean> = {},
  options?: { acceptTerms?: boolean },
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
  if (options?.acceptTerms !== false) {
    await page.locator('#terms-accepted').check();
  }
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

/** Global resolve only — negative branches that fail before confirm. */
export async function resolveGlobalCode(
  page: Page,
  manifest: E2EManifest,
  code: string,
) {
  await page.goto(webUrl(manifest, '/redeem'));
  await page.getByTestId('redeem-global-code').fill(code);
  await page.getByTestId('redeem-global-resolve').click();
}

export async function assertRedeemOutcomePanel(
  page: Page,
  uxKind: string,
  options?: { allowTicketCard?: boolean; timeoutMs?: number },
) {
  const panel = page.getByTestId(`redeem-ux-${uxKind}`);
  await expect(panel).toBeVisible({ timeout: options?.timeoutMs ?? 15_000 });
  await expect(panel).not.toContainText('@');
  if (!options?.allowTicketCard) {
    await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
  }
}

export async function submitGlobalRedeemForm(
  page: Page,
  answers: Record<string, string | boolean> | undefined,
) {
  await fillPublishedForm(page, answers);
  await page
    .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
    .click();
}

/**
 * Direct same-origin POST to /api/bff/redeem — bypasses the UI's
 * idempotency-key-reuse rules so tests can send a fixed key with two
 * different payloads (TD §8.1 hash-conflict case).
 */
export async function postRedeemDirect(
  page: Page,
  manifest: E2EManifest,
  body: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  await page.request.get(webUrl(manifest, '/api/bff/csrf'));
  const cookies = await page.context().cookies(manifest.origins.web);
  const csrfToken = cookies.find((c) => c.name === 'vemoki_csrf')?.value ?? '';
  const response = await page.request.post(
    webUrl(manifest, '/api/bff/redeem'),
    {
      headers: {
        'content-type': 'application/json',
        origin: manifest.origins.web,
        'x-csrf-token': csrfToken,
      },
      data: body,
    },
  );
  const json = await response.json().catch(() => null);
  return { status: response.status(), json };
}

export async function assertRedeemRejectedWithoutTicket(
  page: Page,
  options?: { timeoutMs?: number },
) {
  const panel = page.locator(
    '[data-testid="redeem-ux-denied"], [data-testid="redeem-ux-error"], [data-testid="redeem-ux-unknown"]',
  );
  await expect(panel.first()).toBeVisible({
    timeout: options?.timeoutMs ?? 60_000,
  });
  await expect(panel.first()).not.toContainText('@');
  await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
}

export async function assertWalletUnchanged(
  page: Page,
  manifest: E2EManifest,
  tenantId: string,
  before: string[],
) {
  expect(await walletTicketIds(page, manifest, tenantId)).toEqual(before);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
