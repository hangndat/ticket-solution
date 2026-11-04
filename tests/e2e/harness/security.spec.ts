import { createHash, randomBytes } from 'node:crypto';
import { test, expect, loadManifest, fixtureFor, accountFor } from './fixtures';
import {
  bffGet,
  bffMutate,
  bffUploadCsv,
  eventBff,
  eventPath,
  login,
  portalUrl,
  totp,
} from '../portal/helpers';
import { readImportBusinessSnapshot } from '../portal/import-db';
import { readEventConfigMutationSnapshot } from '../portal/lifecycle-db';
import { importObjects } from './import-objects.mjs';

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

test('[SEC-05] multipart byte boundary through authenticated Portal BFF', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'SEC-05');
  await login(page, m, 'SEC-05', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/config')));
  const path = eventBff(f, '/imports/upload');
  const before = await readImportBusinessSnapshot(f);
  const csv = `code\n${'A'.repeat(10 * 1024 * 1024 - 6)}\n`;
  expect(Buffer.byteLength(csv)).toBe(10 * 1024 * 1024);
  const accepted = await bffUploadCsv(page, m, path, csv, 'near-limit.csv');
  expect(accepted.status).toBe(201);
  expect((accepted.json as { fileId?: string }).fileId).toBeTruthy();
  const afterControl = await readImportBusinessSnapshot(f);
  const objectsAfterControl = await importObjects();
  expect(afterControl).toEqual({
    ...before,
    import_files: before.import_files + 1,
  });
  const rejected = await bffUploadCsv(
    page,
    m,
    path,
    `${csv}A`,
    'oversized.csv',
  );
  expect(rejected.status).toBe(422);
  expect((rejected.json as { code?: string }).code).toBe('IMPORT_ROW_LIMIT');
  const duplicate = await page.evaluate(
    async (url) => {
      const csrf =
        document.cookie.match(/(?:^|;\s*)portal_csrf=([^;]+)/)?.[1] ?? '';
      const form = new FormData();
      form.set('kind', 'CODES');
      form.append(
        'file',
        new File(['code\nA\n'], 'a.csv', { type: 'text/csv' }),
      );
      form.append(
        'file',
        new File(['code\nB\n'], 'b.csv', { type: 'text/csv' }),
      );
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'x-portal-csrf': decodeURIComponent(csrf) },
        body: form,
      });
      return { status: response.status, body: await response.json() };
    },
    portalUrl(m, path),
  );
  expect(duplicate.status).toBe(422);
  expect(duplicate.body.code).toBe('IMPORT_FILE_INVALID');
  expect(await readImportBusinessSnapshot(f)).toEqual(afterControl);
  expect(await importObjects()).toEqual(objectsAfterControl);
});

test('[SEC-05] Portal denies upload without event permission', async ({
  page,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'SEC-05');
  const before = await readImportBusinessSnapshot(f);
  await login(page, m, 'SEC-05', 'scanner');
  await page.goto(portalUrl(m, eventPath(f, '/config')));
  const denied = await bffUploadCsv(
    page,
    m,
    eventBff(f, '/imports/upload'),
    'code\nA\n',
  );
  expect(denied.status).toBe(403);
  expect(await readImportBusinessSnapshot(f)).toEqual(before);
});

test('[SEC-05] stored encoded iframe payload renders as inert text in Portal preview', async ({
  page,
  context,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'SEC-05');
  await context.addInitScript(() => {
    (window as unknown as { sec05Executed: boolean }).sec05Executed = false;
  });
  await login(page, m, 'SEC-05', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/config')));
  const path = eventBff(f, '/config-versions');
  const versions = await bffGet(page, m, path);
  expect(versions.status).toBe(200);
  const latest = (versions.json as { items: Array<{ version: number }> })
    .items[0].version;
  const preview = await bffGet(page, m, `${path}/${latest}/preview`);
  expect(preview.status).toBe(200);
  const payload = structuredClone(
    (
      preview.json as {
        payload: { sections: Array<{ kind: string; body: { text?: string } }> };
      }
    ).payload,
  );
  const hero = payload.sections.find((section) => section.kind === 'hero');
  expect(hero).toBeTruthy();
  const probe =
    '<iframe srcdoc="&#60;script&#62;parent.sec05Executed=true&#60;/script&#62;"></iframe> SEC05-STORED SEC05-VALID-CONTENT';
  hero!.body.text = probe;
  const saved = await bffMutate(page, path, {
    payload,
    schemaVersion: 1,
    expectedVersion: latest,
  });
  expect([200, 201]).toContain(saved.status);
  const version = (saved.json as { version: number }).version;
  const savedSnapshot = await readEventConfigMutationSnapshot(f);
  const stored = await bffGet(page, m, `${path}/${version}/preview`);
  expect(JSON.stringify(stored.json)).toContain('SEC05-STORED');
  const response = await page.reload();
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/object-src 'none'/);
  expect(csp).toMatch(/script-src 'self' 'unsafe-inline'/);
  expect(csp).not.toMatch(/unsafe-eval/);
  const section = page.locator('section').filter({ hasText: 'SEC05-STORED' });
  await expect(section).toBeVisible();
  await expect(section).toContainText(probe);
  await expect(section.locator('iframe, script')).toHaveCount(0);
  await expect(section).toContainText('E2E SEC-05');
  expect(
    await page.evaluate(
      () => (window as unknown as { sec05Executed: boolean }).sec05Executed,
    ),
  ).toBe(false);
  expect(await readEventConfigMutationSnapshot(f)).toEqual(savedSnapshot);
  const published = await bffMutate(page, eventBff(f, '/publish'), {
    expectedVersion: version,
  });
  expect([200, 201]).toContain(published.status);
  const afterPublish = await readEventConfigMutationSnapshot(f);
  const api = await context.request.get(
    new URL(
      `/v1/public/tenants/${f.tenantSlug}/events/${f.eventSlug}`,
      m.origins.api,
    ).toString(),
  );
  expect(api.status()).toBe(200);
  const detail = await api.json();
  expect(
    detail.sections.find((s: { kind: string }) => s.kind === 'hero')
      .bodyMarkdown,
  ).toBe(probe);
  const web = await context.newPage();
  try {
    const res = await web.goto(
      new URL(
        `/t/${f.tenantSlug}/events/${f.eventSlug}`,
        m.origins.web,
      ).toString(),
    );
    expect(res?.status()).toBe(200);
    const webCsp = res?.headers()['content-security-policy'] ?? '';
    expect(webCsp).toMatch(/default-src 'self'/);
    expect(webCsp).toMatch(/object-src 'none'/);
    expect(webCsp).toMatch(/script-src 'self' 'unsafe-inline'/);
    expect(webCsp).not.toMatch(/unsafe-eval/);
    const content = web.locator('#event-details');
    await expect(web.getByRole('heading', { level: 1 })).toContainText('E2E SEC-05');
    await expect(content).toContainText(probe);
    await expect(content).toContainText('SEC05-VALID-CONTENT');
    await expect(content.locator('iframe, script')).toHaveCount(0);
    expect(
      await web.evaluate(
        () => (window as unknown as { sec05Executed: boolean }).sec05Executed,
      ),
    ).toBe(false);
    expect(await readEventConfigMutationSnapshot(f)).toEqual(afterPublish);
  } finally {
    await web.close();
  }
});

test('[SEC-05] rejected rich text remains absent from real Web and Portal surfaces', async ({
  page,
  context,
}) => {
  const m = loadManifest();
  const f = fixtureFor(m, 'SEC-05');
  await context.addInitScript(() => {
    (window as unknown as { sec05Executed: boolean }).sec05Executed = false;
  });
  await login(page, m, 'SEC-05', 'owner');
  await page.goto(portalUrl(m, eventPath(f, '/config')));
  const versionsPath = eventBff(f, '/config-versions');
  const versions = await bffGet(page, m, versionsPath);
  expect(versions.status).toBe(200);
  const rows = (
    versions.json as { items: Array<{ version: number; published: boolean }> }
  ).items;
  const published = rows.find((row) => row.published);
  expect(published).toBeTruthy();
  const preview = await bffGet(
    page,
    m,
    `${versionsPath}/${published!.version}/preview`,
  );
  expect(preview.status).toBe(200);
  const payload = structuredClone(
    (
      preview.json as {
        payload: { sections: Array<{ kind: string; body: { text?: string } }> };
      }
    ).payload,
  );
  const hero = payload.sections.find((section) => section.kind === 'hero');
  expect(hero).toBeTruthy();
  hero!.body.text =
    '<img src=x onerror="window.sec05Executed=true">SEC05-XSS-PROBE';
  const before = await readEventConfigMutationSnapshot(f);
  const rejected = await bffMutate(page, versionsPath, {
    payload,
    schemaVersion: 1,
    expectedVersion: rows[0].version,
  });
  expect(rejected.status).toBe(422);
  expect(['CONFIG_UNSAFE_MARKUP', 'CONFIG_INCOMPATIBLE']).toContain(
    (rejected.json as { code: string }).code,
  );
  expect(await readEventConfigMutationSnapshot(f)).toEqual(before);
  await page.reload();
  await expect(page.locator('body')).not.toContainText('SEC05-XSS-PROBE');
  expect(
    await page.evaluate(
      () => (window as unknown as { sec05Executed: boolean }).sec05Executed,
    ),
  ).toBe(false);
  const web = await context.newPage();
  try {
    const response = await web.goto(
      new URL(
        `/t/${f.tenantSlug}/events/${f.eventSlug}`,
        m.origins.web,
      ).toString(),
    );
    expect(response?.status()).toBe(200);
    await expect(web.locator('body')).toContainText('E2E SEC-05');
    await expect(web.locator('body')).not.toContainText('SEC05-XSS-PROBE');
    expect(
      await web.evaluate(
        () => (window as unknown as { sec05Executed: boolean }).sec05Executed,
      ),
    ).toBe(false);
  } finally {
    await web.close();
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
