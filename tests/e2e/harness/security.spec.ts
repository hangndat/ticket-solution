import { test, expect, loadManifest, fixtureFor } from './fixtures';

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
