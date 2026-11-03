import { createHash, randomBytes } from 'node:crypto';
import { test, expect, loadManifest, fixtureFor, accountFor } from './fixtures';
import { login, totp } from '../portal/helpers';

test('[SEC-02] OAuth cookies stay on their HTTPS host and missing Origin fails closed', async ({
  context,
}) => {
  const manifest = loadManifest();
  const login = await context.request.get(
    `${manifest.origins.web}/api/auth/login?return=/`,
    { maxRedirects: 0 },
  );
  expect([302, 307]).toContain(login.status());
  const cookies = await context.cookies(manifest.origins.web);
  const oauthCookies = cookies.filter((cookie) =>
    /oidc|oauth|pkce|nonce|state/.test(cookie.name),
  );
  expect(oauthCookies.length).toBeGreaterThan(0);
  for (const cookie of oauthCookies) {
    expect(cookie.domain).toBe(new URL(manifest.origins.web).hostname);
    expect(cookie.secure).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
  }
  const portalCookies = await context.cookies(manifest.origins.portal);
  expect(
    portalCookies.filter((cookie) =>
      oauthCookies.some((other) => other.name === cookie.name),
    ),
  ).toHaveLength(0);
  const fixture = fixtureFor(manifest, 'SEC-02');
  const missingOrigin = await context.request.post(
    `${manifest.origins.portal}/api/bff/tenants/${fixture.tenantId}/events/${fixture.eventId}/ticket-types`,
    { data: { label: 'Invalid synthetic request' } },
  );
  expect([401, 403]).toContain(missingOrigin.status());
});

test('[SEC-02] MFA Operator platform and staff audiences remain separate', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const m = loadManifest();
  const account = accountFor(m, 'SEC-02', 'operator');
  const callback = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/auth/platform/callback',
  );
  await login(page, m, 'SEC-02', 'operator', 'platform');
  const callbackHeaders = await (await callback).headersArray();
  const platformCookies = callbackHeaders
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value)
    .filter((value) =>
      /^platform_oidc_(access|refresh|id_token)=/i.test(value),
    );
  expect(platformCookies.length).toBeGreaterThanOrEqual(2);
  for (const cookie of platformCookies) {
    expect(/;\s*domain=/i.test(cookie)).toBe(false);
    expect(/;\s*secure(?:;|$)/i.test(cookie)).toBe(true);
    expect(/;\s*httponly(?:;|$)/i.test(cookie)).toBe(true);
    expect(/;\s*samesite=lax(?:;|$)/i.test(cookie)).toBe(true);
  }
  const positive = await page.request.get(
    `${m.origins.portal}/api/bff/platform/me`,
  );
  expect(positive.status()).toBe(200);
  expect((await positive.json()).operator).toBe(true);
  const cookies = await page.context().cookies(m.origins.portal);
  const platformToken = cookies.find(
    (cookie) => cookie.name === 'platform_oidc_access',
  )?.value;
  expect(Boolean(platformToken)).toBe(true);

  const realm = m.runtime?.realm;
  const secret = m.runtime?.staffMfaClientSecret;
  if (
    typeof realm !== 'string' ||
    typeof secret !== 'string' ||
    !account.totpSecret ||
    !platformToken
  ) {
    throw new Error('BLOCKED: SEC-02 MFA fixture incomplete');
  }
  const issuer = `${m.origins.auth}/realms/${realm}/protocol/openid-connect`;
  const redirect = `${m.origins.portal}/`;
  const authorization = new URL(`${issuer}/auth`);
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  for (const [key, value] of Object.entries({
    client_id: 'e2e-staff-mfa',
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid',
    acr_values: '2',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })) {
    authorization.searchParams.set(key, value);
  }
  const staffContext = await browser.newContext();
  try {
    const staffPage = await staffContext.newPage();
    await staffPage.goto(authorization.toString());
    await staffPage.locator('#username').fill(account.username);
    await staffPage.locator('#password').fill(account.password);
    await staffPage.locator('#kc-login').click();
    await staffPage
      .locator('#otp')
      .waitFor({ state: 'visible', timeout: 20_000 });
    // Keycloak rejects reusing the same TOTP in two separate logins.
    await new Promise((resolve) => setTimeout(resolve, 30_500 - (Date.now() % 30_000)));
    await staffPage.locator('#otp').fill(totp(account.totpSecret, Date.now()));
    await staffPage.locator('#kc-login').click();
    await staffPage.waitForURL(
      (url) =>
        url.origin === new URL(redirect).origin && url.searchParams.has('code'),
    );
    const code = new URL(staffPage.url()).searchParams.get('code');
    if (!code) throw new Error('BLOCKED: MFA authorization code missing');
    const exchange = await staffContext.request.post(`${issuer}/token`, {
      form: {
        grant_type: 'authorization_code',
        client_id: 'e2e-staff-mfa',
        client_secret: secret,
        redirect_uri: redirect,
        code,
        code_verifier: verifier,
      },
    });
    expect(exchange.status()).toBe(200);
    const staffToken = (await exchange.json()).access_token as string;
    const claims = (token: string) =>
      JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
    const staff = claims(staffToken);
    const platform = claims(decodeURIComponent(platformToken));
    const audience = (aud: string | string[]) =>
      Array.isArray(aud) ? aud : [aud];
    expect(staff.sub === platform.sub).toBe(true);
    expect(String(staff.acr)).toBe('2');
    expect(String(platform.acr)).toBe('2');
    expect(audience(staff.aud).includes('ticket-api')).toBe(true);
    expect(audience(staff.aud).includes('ticket-platform-api')).toBe(false);
    expect(audience(platform.aud).includes('ticket-platform-api')).toBe(true);
    const endpoint = `${m.origins.api}/v1/platform/me`;
    const platformResponse = await staffContext.request.get(endpoint, {
      headers: { authorization: `Bearer ${decodeURIComponent(platformToken)}` },
    });
    expect(platformResponse.status()).toBe(200);
    const denied = await staffContext.request.get(endpoint, {
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect([401, 403]).toContain(denied.status());
  } finally {
    await staffContext.close();
  }
});

test('[SEC-05] CSP and nosniff on web and portal home responses', async ({
  context,
}) => {
  const manifest = loadManifest();
  for (const [label, origin] of [
    ['web', manifest.origins.web],
    ['portal', manifest.origins.portal],
  ] as const) {
    const response = await context.request.get(`${origin}/`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(label.length).toBeGreaterThan(0);
  }
});
