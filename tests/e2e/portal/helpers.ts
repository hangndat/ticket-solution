import { createHmac } from 'node:crypto';
import type { Page } from 'playwright/test';
import type { E2EManifest, ActorName, CaseFixture } from '../harness/contract';
import { accountFor } from '../harness/fixtures';

export function portalUrl(manifest: E2EManifest, path: string): string {
  if (new URL(manifest.origins.portal).protocol !== 'https:') {
    throw new Error(
      'BLOCKED: Portal browser test requires isolated HTTPS origin',
    );
  }
  return new URL(path, manifest.origins.portal).toString();
}

export function eventPath(f: CaseFixture, leaf = ''): string {
  return `/t/${encodeURIComponent(f.tenantId)}/e/${encodeURIComponent(f.eventId)}${leaf}`;
}

export function eventBff(f: CaseFixture, leaf = ''): string {
  return `/api/bff/tenants/${encodeURIComponent(f.tenantId)}/events/${encodeURIComponent(f.eventId)}${leaf}`;
}

function totp(secret: string, epochMs: number): string {
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

/** Real Keycloak authorization-code browser login; never installs auth cookies/tokens. */
export async function login(
  page: Page,
  manifest: E2EManifest,
  caseId: string,
  actor: ActorName,
  surface: 'portal' | 'platform' = 'portal',
): Promise<void> {
  const account = accountFor(manifest, caseId, actor);
  const start =
    surface === 'platform'
      ? '/api/auth/platform/login'
      : '/api/auth/login?return=/';
  await page.goto(portalUrl(manifest, start), {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('#kc-login').click();
  if (surface === 'platform') {
    if (!account.totpSecret)
      throw new Error('BLOCKED: Operator TOTP fixture is missing');
    const otp = page.locator('#otp');
    await otp.waitFor({ state: 'visible', timeout: 20_000 });
    await otp.fill(totp(account.totpSecret, Date.now()));
    await page.locator('#kc-login').click();
  }
  const host = new URL(manifest.origins.portal).host;
  await page.waitForURL(
    (url) => url.host === host && !url.pathname.startsWith('/api/auth/'),
    { timeout: 45_000 },
  );
  if (new URL(page.url()).searchParams.has('error')) {
    throw new Error(
      `OIDC callback failed: ${new URL(page.url()).searchParams.get('error')}`,
    );
  }
}

export async function bffGet(page: Page, manifest: E2EManifest, path: string) {
  const response = await page.request.get(portalUrl(manifest, path), {
    failOnStatusCode: false,
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    /* non-JSON failure remains observable by status */
  }
  return { status: response.status(), json, headers: response.headers() };
}

/** Multipart CSV upload through Portal BFF (CSRF + staff cookie). */
export async function bffUploadCsv(
  page: Page,
  manifest: E2EManifest,
  bffPath: string,
  csvBody: string,
  filename = 'import.csv',
  kind: 'CODES' | 'GUESTS' = 'CODES',
) {
  const url = portalUrl(manifest, bffPath);
  return page.evaluate(
    async ({ url, csvBody, filename, kind }) => {
      const csrf =
        document.cookie.match(/(?:^|;\s*)portal_csrf=([^;]+)/)?.[1] ?? '';
      const form = new FormData();
      form.set('kind', kind);
      form.set(
        'file',
        new Blob([csvBody], { type: 'text/csv' }),
        filename,
      );
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-portal-csrf': decodeURIComponent(csrf) },
        body: form,
      });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        /* preserve status */
      }
      return { status: response.status, json };
    },
    { url, csvBody, filename, kind },
  );
}

/** Browser-origin mutation carries the CSRF cookie that the real UI uses. */
export async function bffMutate(
  page: Page,
  path: string,
  body: unknown,
  method = 'POST',
  idempotencyKey?: string,
) {
  return page.evaluate(
    async ({ path, body, method, idempotencyKey }) => {
      const csrf =
        document.cookie.match(/(?:^|;\s*)portal_csrf=([^;]+)/)?.[1] ?? '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-portal-csrf': decodeURIComponent(csrf),
      };
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const response = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers,
        body: JSON.stringify(body),
      });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        /* preserve status */
      }
      return {
        status: response.status,
        json,
        headers: Object.fromEntries(response.headers),
      };
    },
    { path, body, method, idempotencyKey },
  );
}
