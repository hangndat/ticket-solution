import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import { login, webUrl, fillPublishedForm } from './helpers';

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
    if (!url.pathname.startsWith('/api/auth/') && !url.pathname.startsWith('/api/bff/')) return;
    const setCookie = res.headers()['set-cookie'] ?? '';
    const touched = pendingNames.filter((name) => setCookie.includes(`${name}=`));
    cookieOrder.push(`${url.pathname}:${res.status()}:${touched.join(',') || 'none'}`);
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
    const refreshReleased = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const refreshFetched = new Promise<void>((resolve) => { refreshReady = resolve; });
    let refreshSetAccess = false;
    await context.route('**/api/auth/refresh?*', async (route) => {
      const upstream = await route.fetch({ maxRedirects: 0 });
      refreshSetAccess = (upstream.headers()['set-cookie'] ?? '').includes('oidc_access_token=');
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
    expect(lateCookies.some((cookie) => cookie.name === 'oidc_access_token')).toBe(true);
    expect(lateCookies.some((cookie) => cookie.name === 'web_oidc_sub')).toBe(false);
    expect((await page.request.get(webUrl(manifest, '/api/bff/me'))).status()).toBe(401);
    const afterLogout = await context.cookies(manifest.origins.web);
    expect(afterLogout.some((cookie) => pendingNames.includes(cookie.name))).toBe(false);
    const other = accountFor(manifest, 'AUTH-07', 'otherAttendee');
    try {
      await login(page, manifest, other, '/wallet', async () => {
        const names = new Set((await context.cookies(manifest.origins.web)).map((cookie) => cookie.name));
        for (const name of pendingNames) {
          expect(names.has(name), `pending ${name}; cookie order=${cookieOrder.join(' > ')}`).toBe(true);
        }
      });
    } catch (error) {
      // Only route/status/cookie names: no tokens, authorization code or state values.
      throw new Error(`AUTH-07 login switch; cookie order=${cookieOrder.join(' > ')}`, { cause: error });
    }
    const guestBffPendingDelete = cookieOrder.some((entry) =>
      entry.startsWith('/api/bff/') && pendingNames.some((name) => entry.includes(name)),
    );
    expect(guestBffPendingDelete, `cookie order=${cookieOrder.join(' > ')}`).toBe(false);
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
