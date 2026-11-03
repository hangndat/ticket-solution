import { test, expect, loadManifest, fixtureFor } from './fixtures';
import {
  bffGet,
  bffMutate,
  bffUploadCsv,
  eventBff,
  eventPath,
  login,
  portalUrl,
} from '../portal/helpers';
import { readImportBusinessSnapshot } from '../portal/import-db';
import { readEventConfigMutationSnapshot } from '../portal/lifecycle-db';

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
  expect(await readImportBusinessSnapshot(f)).toEqual(afterControl);
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
