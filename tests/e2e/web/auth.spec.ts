import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import {
  login,
  webUrl,
  fillPublishedForm,
  openCodeConfirmation,
  decodeJwtPayload,
  mintCrossClientAccessToken,
} from './helpers';

type WebRuntime = {
  httpPlatformClientId?: string;
  httpPlatformClientSecret?: string;
};

test('[AUTH-01] attendee OIDC callback and BFF identity', async ({ page }) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-01');
  const actor = accountFor(manifest, 'AUTH-01', 'attendee');
  const authorize = await page.request.get(
    webUrl(manifest, '/api/auth/login?return=%2Fwallet'),
    { maxRedirects: 0 },
  );
  expect([302, 307]).toContain(authorize.status());
  const redirect = new URL(authorize.headers()['location']);
  expect(redirect.origin).toBe(new URL(manifest.origins.auth).origin);
  expect(redirect.searchParams.get('response_type')).toBe('code');
  expect(redirect.searchParams.get('code_challenge_method')).toBe('S256');
  expect(redirect.searchParams.get('state')).toBeTruthy();
  expect(redirect.searchParams.get('nonce')).toBeTruthy();
  await login(page, manifest, actor, '/wallet');
  await expect(page.getByTestId('wallet-ready')).toBeVisible();
  const cookies = await page.context().cookies(manifest.origins.web);
  expect(
    cookies.some(
      (cookie) =>
        cookie.httpOnly && cookie.secure && cookie.name.includes('access'),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).every((key) => !/token/i.test(key)),
    ),
  ).toBe(true);
});

test('[AUTH-01] disallowed return path falls back to the default instead of an open redirect', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-01');
  const actor = accountFor(manifest, 'AUTH-01', 'attendee');
  await login(page, manifest, actor, 'https://evil.example/steal?x=1');
  const landed = new URL(page.url());
  expect(landed.origin).toBe(new URL(manifest.origins.web).origin);
  expect(landed.pathname).toBe('/');
  await expect(page.getByTestId('wallet-ready')).toHaveCount(0);
});

test('[AUTH-01] post-login navigation is terminal and does not bounce back to login', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-01');
  const actor = accountFor(manifest, 'AUTH-01', 'attendee');
  await login(page, manifest, actor, '/wallet');
  await expect(page.getByTestId('wallet-ready')).toBeVisible();
  await page.goto(webUrl(manifest, '/wallet'));
  await expect(page).toHaveURL(
    new RegExp(
      `^${manifest.origins.web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/wallet`,
    ),
  );
  await expect(page.getByTestId('wallet-ready')).toBeVisible();
  expect(
    (await page.request.get(webUrl(manifest, '/api/bff/me'))).status(),
  ).toBe(200);
});

test('[AUTH-01] staff (owner/manager) OIDC login bounces to Portal with its own client/callback and host-only cookies (ADR-20)', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-01');
  const portalOrigin = new URL(manifest.origins.portal).origin;

  for (const role of ['owner', 'manager'] as const) {
    const actor = accountFor(manifest, 'AUTH-01', role);
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const hops: { url: string; location: string | null }[] = [];
      page.on('response', (res) => {
        if (res.request().resourceType() !== 'document') return;
        hops.push({ url: res.url(), location: res.headers().location ?? null });
      });

      await page.goto(webUrl(manifest, '/api/auth/login?return=%2Fwallet'));
      await page.locator('#username').fill(actor.username);
      await page.locator('#password').fill(actor.password);
      await page.locator('#kc-login').click();
      await page.waitForURL(
        (url) =>
          url.origin === portalOrigin && !url.pathname.startsWith('/api/auth/'),
        { timeout: 45_000 },
      );
      expect(new URL(page.url()).origin).toBe(portalOrigin);
      expect(new URL(page.url()).searchParams.has('error')).toBe(false);

      // Web callback decided the staff branch and sent a plain bounce to Portal
      // login — not a page carrying any token/code of its own (ADR-20 §3: no
      // copied BFF session).
      const webCallback = hops.find((h) =>
        h.url.startsWith(webUrl(manifest, '/api/auth/callback')),
      );
      expect(webCallback?.location).toBe(`${portalOrigin}/api/auth/login`);

      // Portal ran its own full Authorization Code + PKCE + nonce leg against
      // its own client, not a reused Web code/session.
      const portalAuthorize = hops.find(
        (h) =>
          h.url.includes('/protocol/openid-connect/auth') &&
          h.url.includes('client_id=ticket-admin-web'),
      );
      expect(portalAuthorize).toBeTruthy();
      const authorizeUrl = new URL(portalAuthorize!.url);
      expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
        `${portalOrigin}/api/auth/callback`,
      );
      expect(authorizeUrl.searchParams.get('response_type')).toBe('code');
      expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe(
        'S256',
      );
      expect(authorizeUrl.searchParams.get('state')).toBeTruthy();
      expect(authorizeUrl.searchParams.get('nonce')).toBeTruthy();

      const subject = await page.request.get(
        new URL('/api/bff/me/subject', manifest.origins.portal).toString(),
      );
      expect(subject.status()).toBe(200);
      const subjectBody = (await subject.json()) as { userId?: string };
      expect(subjectBody.userId).toBeTruthy();

      // Host-only cookies: no `Domain=.vemoki.com`-style attribute on either
      // surface's jar (ADR-20 §3.2).
      const portalCookies = await context.cookies(manifest.origins.portal);
      const webCookies = await context.cookies(manifest.origins.web);
      const portalIdToken = portalCookies.find(
        (cookie) => cookie.name === 'oidc_id_token',
      );
      expect(portalIdToken).toBeTruthy();
      const idPayload = decodeJwtPayload(portalIdToken!.value);
      // The Portal subject is the real Keycloak `sub` from its own token
      // exchange — bind it to the real `oidc_id_token` claim for this run's
      // actor, not to the Web-side Postgres `userId` (a distinct identifier).
      expect(subjectBody.userId).toBe(idPayload.sub);
      expect(idPayload.email).toBe(actor.username);
      expect(
        portalCookies.some(
          (cookie) => cookie.name === 'oidc_access_token' && cookie.httpOnly,
        ),
      ).toBe(true);
      for (const cookie of [...portalCookies, ...webCookies]) {
        expect(cookie.domain.startsWith('.')).toBe(false);
      }
    } finally {
      await context.close();
    }
  }
});

test('[AUTH-02] wrong password and callback without state do not create a session', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-02');
  const actor = accountFor(manifest, 'AUTH-02', 'attendee');
  await page.goto(webUrl(manifest, '/api/auth/login?return=%2Fwallet'));
  await page.locator('#username').fill(actor.username);
  await page.locator('#password').fill(`${actor.password}-wrong`);
  await page.locator('#kc-login').click();
  await expect(page).toHaveURL(
    new RegExp(
      `^${manifest.origins.auth.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    ),
  );
  const me = await page.request.get(webUrl(manifest, '/api/bff/me'));
  expect(me.status()).toBe(401);
  const callback = await page.request.get(
    webUrl(manifest, '/api/auth/callback?code=invalid'),
    { maxRedirects: 0 },
  );
  expect([400, 401, 302, 307]).toContain(callback.status());
  expect(
    (await page.request.get(webUrl(manifest, '/api/bff/me'))).status(),
  ).toBe(401);
});

test('[AUTH-02] mismatched callback state is rejected locally and never reaches the IdP token exchange', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-02');
  const start = await page.request.get(
    webUrl(manifest, '/api/auth/login?return=%2Fwallet'),
    { maxRedirects: 0 },
  );
  expect([302, 307]).toContain(start.status());
  const callback = await page.request.get(
    webUrl(manifest, '/api/auth/callback?code=irrelevant&state=tampered-state'),
    { maxRedirects: 0 },
  );
  expect([302, 307]).toContain(callback.status());
  const location = new URL(
    callback.headers()['location'],
    manifest.origins.web,
  );
  expect(location.pathname).toBe('/auth');
  expect(location.searchParams.get('error')).toBe('invalid_state');
  expect(
    (await page.request.get(webUrl(manifest, '/api/bff/me'))).status(),
  ).toBe(401);
  const cookies = await page.context().cookies(manifest.origins.web);
  expect(cookies.some((cookie) => cookie.name === 'oidc_access_token')).toBe(
    false,
  );
});

test('[AUTH-02] IdP-rejected authorization code is a distinct upstream error, not the local state/validation error', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-02');
  const start = await page.request.get(
    webUrl(manifest, '/api/auth/login?return=%2Fwallet'),
    { maxRedirects: 0 },
  );
  expect([302, 307]).toContain(start.status());
  const redirect = new URL(start.headers()['location']);
  const state = redirect.searchParams.get('state');
  expect(state).toBeTruthy();
  const callback = await page.request.get(
    webUrl(
      manifest,
      `/api/auth/callback?code=not-a-real-authorization-code&state=${encodeURIComponent(state!)}`,
    ),
    { maxRedirects: 0 },
  );
  expect([302, 307]).toContain(callback.status());
  const location = new URL(
    callback.headers()['location'],
    manifest.origins.web,
  );
  expect(location.pathname).toBe('/auth');
  // Keycloak rejects an unknown/garbage authorization_code as invalid_grant —
  // an IdP-reported (upstream) rejection, distinct from the local
  // invalid_state validation failure above.
  expect(location.searchParams.get('error')).not.toBe('invalid_state');
  expect(location.searchParams.get('error')).toBeTruthy();
  expect(
    (await page.request.get(webUrl(manifest, '/api/bff/me'))).status(),
  ).toBe(401);
});

test('[AUTH-02] a correctly-signed token for the wrong audience does not grant a valid BFF session', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-02');
  const runtime = manifest.runtime as WebRuntime | undefined;
  const clientId = runtime?.httpPlatformClientId;
  const clientSecret = runtime?.httpPlatformClientSecret;
  if (!clientId || !clientSecret) {
    throw new Error(
      'BLOCKED: AUTH-02 wrong-audience cần runtime.httpPlatformClientId/Secret từ harness',
    );
  }
  const operator = manifest.accounts.operator;
  const wrongAudienceToken = await mintCrossClientAccessToken(
    manifest,
    operator,
    clientId,
    clientSecret,
  );
  const payload = decodeJwtPayload(wrongAudienceToken);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  expect(audiences).not.toContain('ticket-api');
  const sub = String(payload.sub ?? '');
  expect(sub).toBeTruthy();

  await page.goto(webUrl(manifest, '/'));
  await page.context().addCookies([
    {
      name: 'oidc_access_token',
      value: wrongAudienceToken,
      url: manifest.origins.web,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'web_oidc_sub',
      value: sub,
      url: manifest.origins.web,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const me = await page.request.get(webUrl(manifest, '/api/bff/me'));
  expect(me.status()).toBe(401);
  const body = JSON.stringify(await me.json().catch(() => ({})));
  expect(body).not.toContain(operator.userId ?? '\u0000no-user-id');
  const cookiesAfter = await page.context().cookies(manifest.origins.web);
  expect(
    cookiesAfter.some((cookie) => cookie.name === 'oidc_access_token'),
  ).toBe(false);
});

test('[AUTH-02] an expired access token with no refresh token fails closed instead of granting a session', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const base = loadManifest();
  if (!base.origins.shortWeb)
    throw new Error('BLOCKED: AUTH-02 short-lived isolated Web missing');
  const manifest = {
    ...base,
    origins: { ...base.origins, web: base.origins.shortWeb },
  };
  fixtureFor(manifest, 'AUTH-02');
  await login(page, manifest, accountFor(manifest, 'AUTH-02', 'attendee'));
  const stale = (await page.context().cookies(manifest.origins.web)).find(
    (cookie) => cookie.name === 'oidc_access_token',
  );
  expect(stale).toBeTruthy();
  const payload = decodeJwtPayload(stale!.value);
  const exp = Number(payload.exp);
  expect(Number.isFinite(exp)).toBe(true);
  // Drop the refresh cookie so expiry cannot be silently recovered; the BFF
  // must reject the stale token rather than treat it as still valid.
  await page.context().clearCookies({
    name: 'oidc_refresh_token',
    domain: new URL(manifest.origins.web).hostname,
  });
  const delayMs = Math.max(0, exp * 1000 - Date.now() + 1200);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  expect(Date.now()).toBeGreaterThan(exp * 1000);
  const me = await page.request.get(webUrl(manifest, '/api/bff/me'));
  expect(me.status()).toBe(401);
  const cookiesAfter = await page.context().cookies(manifest.origins.web);
  expect(
    cookiesAfter.some((cookie) => cookie.name === 'oidc_access_token'),
  ).toBe(false);
});

test('[AUTH-03] guest is gated and unverified identity cannot issue a ticket', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'AUTH-03');
  await page.goto(webUrl(manifest, '/redeem'));
  await expect(page.getByTestId('redeem-auth-gate')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Đăng nhập để đổi mã' }),
  ).toBeVisible();
  await expect(page.getByTestId('redeem-global-code')).toHaveCount(0);
  await login(
    page,
    manifest,
    accountFor(manifest, 'AUTH-03', 'unverified'),
    '/redeem',
  );
  await page.getByTestId('redeem-global-code').fill(fixture.code ?? 'INVALID');
  await page.getByTestId('redeem-global-resolve').click();
  await expect(page.getByTestId('redeem-global-context')).toBeVisible();
  await fillPublishedForm(
    page,
    fixture.data?.answers as Record<string, string | boolean>,
  );
  await page
    .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
    .click();
  await expect(page.getByTestId('redeem-ux-auth')).toContainText(
    'xác minh email',
  );
});

test('[AUTH-04] web logout clears web session and protected wallet', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-04');
  await login(page, manifest, accountFor(manifest, 'AUTH-04', 'attendee'));
  await page.goto(webUrl(manifest, '/api/auth/logout'));
  await page.goto(webUrl(manifest, '/wallet'));
  await expect(page.getByTestId('wallet-need-login')).toBeVisible();
  expect(
    (await page.request.get(webUrl(manifest, '/api/bff/me'))).status(),
  ).toBe(401);
});

test('[AUTH-05] expired access token refreshes inside BFF', async ({
  page,
}) => {
  test.setTimeout(70_000);
  const base = loadManifest();
  if (!base.origins.shortWeb)
    throw new Error('BLOCKED: AUTH-05 short-lived isolated Web missing');
  const manifest = {
    ...base,
    origins: { ...base.origins, web: base.origins.shortWeb },
  };
  fixtureFor(manifest, 'AUTH-05');
  await login(page, manifest, accountFor(manifest, 'AUTH-05', 'attendee'));
  const first = (await page.context().cookies(manifest.origins.web)).find(
    (cookie) => cookie.name === 'oidc_access_token',
  );
  expect(first).toBeTruthy();
  await expect
    .poll(
      async () => {
        const pair = await Promise.all([
          page.request.get(webUrl(manifest, '/api/bff/me')),
          page.request.get(webUrl(manifest, '/api/bff/me')),
        ]);
        if (pair.some((response) => response.status() !== 200)) return false;
        const now = (await page.context().cookies(manifest.origins.web)).find(
          (cookie) => cookie.name === 'oidc_access_token',
        );
        return Boolean(now && now.value !== first!.value);
      },
      { timeout: 45_000, intervals: [1000] },
    )
    .toBe(true);
});

test('[AUTH-05] revoked Keycloak refresh fails closed and actors stay isolated', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const base = loadManifest();
  if (!base.origins.shortWeb)
    throw new Error('BLOCKED: AUTH-05 short-lived isolated Web missing');
  const manifest = {
    ...base,
    origins: { ...base.origins, web: base.origins.shortWeb },
  };
  const fixture = fixtureFor(manifest, 'AUTH-05');
  const first = accountFor(manifest, 'AUTH-05', 'attendee');
  const second = accountFor(manifest, 'AUTH-05', 'otherAttendee');
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    await Promise.all([
      login(firstPage, manifest, first),
      login(secondPage, manifest, second),
    ]);
    const origin = manifest.origins.web;
    const access = (await secondContext.cookies(origin)).find(
      (cookie) => cookie.name === 'oidc_access_token',
    );
    const refresh = (await secondContext.cookies(origin)).find(
      (cookie) => cookie.name === 'oidc_refresh_token',
    );
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    const accessPayload = JSON.parse(
      Buffer.from(access!.value.split('.')[1], 'base64url').toString('utf8'),
    ) as { exp: number };
    const tokenUrl = new URL(
      `/realms/e2e-${manifest.runId}/protocol/openid-connect/revoke`,
      manifest.origins.auth,
    );
    const revoke = await secondPage.request.post(tokenUrl.toString(), {
      form: {
        token: refresh!.value,
        token_type_hint: 'refresh_token',
        client_id: 'ticket-web-short',
        client_secret: String(fixture.data?.shortWebClientSecret ?? ''),
      },
    });
    expect(revoke.status()).toBe(200);
    const delayMs = Math.max(0, accessPayload.exp * 1000 - Date.now() + 1200);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    expect(Date.now()).toBeGreaterThan(accessPayload.exp * 1000);
    const apiDuringClockSkew = await secondPage.request.get(
      new URL(
        `/v1/me/tickets?tenantId=${fixture.tenantId}`,
        manifest.origins.api,
      ).toString(),
      { headers: { authorization: `Bearer ${access!.value}` } },
    );
    // API JWT verification deliberately permits five minutes of clock skew.
    // BFF cookie renewal is a separate path; it must reject the revoked refresh.
    expect(apiDuringClockSkew.status()).toBe(200);
    // Each browser context owns its own host-only cookie jar. A fresh request
    // after expiry must never borrow the other actor's in-flight refresh.
    const [firstRefresh, secondRefresh] = await Promise.all([
      firstPage.request.get(
        webUrl(manifest, '/api/auth/refresh?next=%2Fwallet'),
        { maxRedirects: 0 },
      ),
      secondPage.request.get(
        webUrl(manifest, '/api/auth/refresh?next=%2Fwallet'),
        { maxRedirects: 0 },
      ),
    ]);
    expect([302, 307]).toContain(firstRefresh.status());
    expect([302, 307]).toContain(secondRefresh.status());
    expect(new URL(firstRefresh.headers().location, origin).pathname).toBe(
      '/wallet',
    );
    expect(new URL(secondRefresh.headers().location, origin).pathname).toBe(
      '/auth',
    );
    const [firstMe, secondMe] = await Promise.all([
      firstPage.request.get(webUrl(manifest, '/api/bff/me')),
      secondPage.request.get(webUrl(manifest, '/api/bff/me')),
    ]);
    expect(firstMe.status()).toBe(200);
    const firstBody = JSON.stringify(await firstMe.json());
    expect(firstBody).toContain(first.userId);
    expect(firstBody).not.toContain(second.userId);
    expect(secondMe.status()).toBe(401);
    const secondCookies = await secondContext.cookies(origin);
    expect(
      secondCookies.some((cookie) =>
        ['oidc_access_token', 'oidc_refresh_token', 'web_oidc_sub'].includes(
          cookie.name,
        ),
      ),
    ).toBe(false);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});

test('[AUTH-06] attendee session grants no staff Portal identity', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-06');
  await login(page, manifest, accountFor(manifest, 'AUTH-06', 'attendee'));
  const webMe = await page.request.get(webUrl(manifest, '/api/bff/me'));
  expect(webMe.status()).toBe(200);
  const portalSubject = await page.request.get(
    new URL('/api/bff/me/subject', manifest.origins.portal).toString(),
  );
  expect(portalSubject.status()).toBe(401);
});

test('[AUTH-06] redeem UI does not claim success after session capability is cleared', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'AUTH-06');
  const code = fixture.secondCode;
  if (!code) throw new Error('BLOCKED: AUTH-06 secondCode');
  const answers = fixture.data?.answers as
    Record<string, string | boolean> | undefined;
  await login(page, manifest, accountFor(manifest, 'AUTH-06', 'attendee'));
  await openCodeConfirmation(page, manifest, code);
  await fillPublishedForm(page, answers);
  await page.context().clearCookies();
  await page
    .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
    .click();
  await expect(page.getByTestId('redeem-ux-success')).toHaveCount(0);
  await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
  await expect(page.getByTestId('redeem-ux-auth')).toBeVisible({
    timeout: 15_000,
  });
});

test('[AUTH-06] wallet does not show ticket grid after session capability is cleared', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-06');
  await login(page, manifest, accountFor(manifest, 'AUTH-06', 'attendee'));
  await page.goto(webUrl(manifest, '/wallet'));
  await expect(page.getByTestId('wallet-ready')).toBeVisible();
  await expect(page.getByTestId('wallet-ticket-grid')).toBeVisible();
  await page.context().clearCookies();
  await page.goto(webUrl(manifest, '/wallet'));
  await expect(page.getByTestId('wallet-need-login')).toBeVisible();
  await expect(page.getByTestId('wallet-ready')).toHaveCount(0);
  await expect(page.getByTestId('wallet-ticket-grid')).toHaveCount(0);
  expect(
    (await page.request.get(webUrl(manifest, '/api/bff/me'))).status(),
  ).toBe(401);
});

test('[AUTH-07] another attendee cannot see prior actor ticket after login switch', async ({
  browser,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'AUTH-07');
  if (!f.ticketId) throw new Error('BLOCKED: AUTH-07 ticketId của attendee');
  const context = await browser.newContext();
  const page = await context.newPage();
  const cookieOrder: string[] = [];
  const pendingNames = [
    'oidc_oauth_state',
    'oidc_pkce_verifier',
    'web_oidc_nonce',
    'vemoki_post_login_path',
  ];
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (url.origin !== new URL(manifest.origins.web).origin) return;
    if (
      !url.pathname.startsWith('/api/auth/') &&
      !url.pathname.startsWith('/api/bff/')
    )
      return;
    const setCookie = res.headers()['set-cookie'] ?? '';
    const touched = pendingNames.filter((name) =>
      setCookie.includes(`${name}=`),
    );
    cookieOrder.push(
      `${url.pathname}:${res.status()}:${touched.join(',') || 'none'}`,
    );
    if (cookieOrder.length > 40) cookieOrder.shift();
  });
  try {
    await login(page, manifest, accountFor(manifest, 'AUTH-07', 'attendee'));
    const detail = webUrl(
      manifest,
      `/t/${f.tenantSlug}/tickets/${f.ticketId}?tenantId=${f.tenantId}`,
    );
    await page.goto(detail);
    await expect(page.getByTestId('owner-ticket-ready')).toBeVisible();
    const response = await page.request.get(
      webUrl(manifest, `/api/bff/tickets/${f.ticketId}?tenantId=${f.tenantId}`),
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toMatch(/no-store/i);
    // Hold a real refresh response until logout has cleared the callback-owned
    // subject anchor. Its late Set-Cookie must not resurrect the old actor.
    let releaseRefresh!: () => void;
    let refreshReady!: () => void;
    const refreshReleased = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const refreshFetched = new Promise<void>((resolve) => {
      refreshReady = resolve;
    });
    let refreshSetAccess = false;
    await context.route('**/api/auth/refresh?*', async (route) => {
      const upstream = await route.fetch({ maxRedirects: 0 });
      refreshSetAccess = (upstream.headers()['set-cookie'] ?? '').includes(
        'oidc_access_token=',
      );
      refreshReady();
      await refreshReleased;
      await route.fulfill({ response: upstream });
    });
    const staleRefresh = page.evaluate(async () => {
      await fetch('/api/auth/refresh?next=%2Fwallet', { redirect: 'manual' });
    });
    await refreshFetched;
    expect(refreshSetAccess).toBe(true);
    const logoutPage = await context.newPage();
    try {
      await logoutPage.goto(webUrl(manifest, '/api/auth/logout'));
    } finally {
      releaseRefresh();
    }
    await staleRefresh;
    await context.unroute('**/api/auth/refresh?*');
    const lateCookies = await context.cookies(manifest.origins.web);
    expect(
      lateCookies.some((cookie) => cookie.name === 'oidc_access_token'),
    ).toBe(true);
    expect(lateCookies.some((cookie) => cookie.name === 'web_oidc_sub')).toBe(
      false,
    );
    expect(
      (await page.request.get(webUrl(manifest, '/api/bff/me'))).status(),
    ).toBe(401);
    const afterLogout = await context.cookies(manifest.origins.web);
    expect(
      afterLogout.some((cookie) => pendingNames.includes(cookie.name)),
    ).toBe(false);
    const other = accountFor(manifest, 'AUTH-07', 'otherAttendee');
    try {
      await login(page, manifest, other, '/wallet', async () => {
        const names = new Set(
          (await context.cookies(manifest.origins.web)).map(
            (cookie) => cookie.name,
          ),
        );
        for (const name of pendingNames) {
          expect(
            names.has(name),
            `pending ${name}; cookie order=${cookieOrder.join(' > ')}`,
          ).toBe(true);
        }
      });
    } catch (error) {
      // Only route/status/cookie names: no tokens, authorization code or state values.
      throw new Error(
        `AUTH-07 login switch; cookie order=${cookieOrder.join(' > ')}`,
        { cause: error },
      );
    }
    const guestBffPendingDelete = cookieOrder.some(
      (entry) =>
        entry.startsWith('/api/bff/') &&
        pendingNames.some((name) => entry.includes(name)),
    );
    expect(
      guestBffPendingDelete,
      `cookie order=${cookieOrder.join(' > ')}`,
    ).toBe(false);
    await page.goto(detail);
    await expect(page.getByTestId('owner-ticket-ready')).toHaveCount(0);
    await expect(
      page
        .getByTestId('owner-ticket-forbidden')
        .or(page.getByTestId('owner-ticket-missing')),
    ).toBeVisible();
    const forbidden = await page.request.get(
      webUrl(manifest, `/api/bff/tickets/${f.ticketId}?tenantId=${f.tenantId}`),
    );
    expect([403, 404]).toContain(forbidden.status());
    expect(forbidden.headers()['cache-control']).toMatch(/no-store/i);
  } finally {
    await context.close();
  }
});

test('[AUTH-08] account deletion needs consent and acknowledges one request', async ({
  page,
}) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-08');
  await login(
    page,
    manifest,
    accountFor(manifest, 'AUTH-08', 'attendee'),
    '/account',
  );
  await page.goto(webUrl(manifest, '/account'));
  await page.locator('summary').filter({ hasText: 'Xóa tài khoản' }).click();
  await expect(page.getByTestId('account-load-empty')).toBeVisible();
  const submit = page.getByRole('button', {
    name: 'Gửi yêu cầu xóa tài khoản',
  });
  await expect(submit).toBeDisabled();
  const posts: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/bff/me/account-deletion-requests')
    )
      posts.push(request.url());
  });
  expect(posts).toHaveLength(0);
  await page
    .getByLabel('Tôi đã đọc và muốn gửi yêu cầu xóa tài khoản.')
    .check();
  await expect(submit).toBeEnabled();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/bff/me/account-deletion-requests'),
  );
  await submit.dblclick();
  const response = await responsePromise;
  expect(posts).toHaveLength(1);
  expect([200, 201, 202]).toContain(response.status());
  const ack = (await response.json()) as { requestId?: string; state?: string };
  expect(ack.requestId).toBeTruthy();
  expect(ack.state).toBe('REQUESTED');
  await expect(page.getByTestId('account-deletion-result')).toContainText(
    'Đã tiếp nhận yêu cầu',
  );
  expect(posts).toHaveLength(1);
  await expect(page.getByTestId('account-deletion-result')).toContainText(
    'chưa phải xóa dữ liệu ngay',
  );
});
