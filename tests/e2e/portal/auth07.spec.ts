import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import { bffGet, eventBff, eventPath, login, portalUrl } from './helpers';

const noStore = (value: string | undefined) => expect(value).toMatch(/private.*no-store/i);

test('[AUTH-07] Portal drops held staff document and audit JSON after another staff login', async ({ browser }) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'AUTH-07');
  const auditPath = eventPath(fixture, '/audit');
  const auditUrl = portalUrl(manifest, auditPath);
  const auditBff = eventBff(fixture, '/audit');
  const context = await browser.newContext();
  const switchPage = await context.newPage();
  let releaseDocument!: () => void;
  let releaseJson!: () => void;
  let documentFetched!: () => void;
  let jsonFetched!: () => void;
  const documentReleased = new Promise<void>((resolve) => { releaseDocument = resolve; });
  const jsonReleased = new Promise<void>((resolve) => { releaseJson = resolve; });
  const documentReady = new Promise<void>((resolve) => { documentFetched = resolve; });
  const jsonReady = new Promise<void>((resolve) => { jsonFetched = resolve; });
  try {
    await login(switchPage, manifest, 'AUTH-07', 'owner');
    const before = await bffGet(switchPage, manifest, '/api/auth/identity?surface=staff');
    expect(before.status).toBe(200);
    noStore(before.headers['cache-control']);
    const actorA = before.json as { actorId: string; authEpoch: string; surface: string };
    expect(actorA.surface).toBe('staff');

    const oldTab = await context.newPage();
    const oldDocument = await oldTab.goto(auditUrl);
    expect(oldDocument?.status()).toBe(200);
    noStore(oldDocument?.headers()['cache-control']);
    expect(await oldDocument?.text()).not.toContain('E2E AUTH-07');
    await expect(oldTab.getByTestId('audit-table')).toBeVisible();

    let heldJson = false;
    await context.route((url) => url.pathname === auditBff, async (route) => {
      if (heldJson) { await route.continue(); return; }
      heldJson = true;
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(200);
      noStore(upstream.headers()['cache-control']);
      expect(upstream.headers()['x-portal-auth-epoch']).toBe(actorA.authEpoch);
      jsonFetched();
      await jsonReleased;
      await route.fulfill({ response: upstream });
    });
    const jsonTab = await context.newPage();
    const jsonNavigation = jsonTab.goto(auditUrl);
    await jsonReady;

    let heldDocument = false;
    await context.route((url) => url.toString() === auditUrl, async (route) => {
      if (route.request().resourceType() !== 'document' || heldDocument) {
        await route.continue(); return;
      }
      heldDocument = true;
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(200);
      noStore(upstream.headers()['cache-control']);
      expect(await upstream.text()).not.toContain('E2E AUTH-07');
      documentFetched();
      await documentReleased;
      await route.fulfill({ response: upstream });
    });
    const documentTab = await context.newPage();
    await documentTab.goto(portalUrl(manifest, '/'));
    const documentNavigation = documentTab.goto(auditUrl);
    await documentReady;

    await switchPage.goto(portalUrl(manifest, '/api/auth/logout'));
    await switchPage.goto(portalUrl(manifest, '/auth'));
    await login(switchPage, manifest, 'AUTH-07', 'scanner');
    const after = await bffGet(switchPage, manifest, '/api/auth/identity?surface=staff');
    expect(after.status).toBe(200);
    const actorB = after.json as typeof actorA;
    expect(actorB.actorId).not.toBe(actorA.actorId);
    expect(actorB.authEpoch).not.toBe(actorA.authEpoch);
    const denied = await bffGet(switchPage, manifest, auditBff);
    expect(denied.status).toBe(403);
    noStore(denied.headers['cache-control']);

    releaseDocument();
    releaseJson();
    await Promise.all([jsonNavigation, documentNavigation]);
    for (const tab of [oldTab, jsonTab, documentTab]) {
      await expect(tab.getByTestId('audit-table')).toHaveCount(0);
    }
    await oldTab.goBack();
    await oldTab.goForward();
    await oldTab.reload();
    await expect(oldTab.getByTestId('audit-table')).toHaveCount(0);
    const freshTab = await context.newPage();
    await freshTab.goto(auditUrl);
    await expect(freshTab.getByTestId('audit-table')).toHaveCount(0);
  } finally {
    releaseDocument();
    releaseJson();
    await context.close();
  }
});

test('[AUTH-07] late real Keycloak refresh cannot replace a same-sub callback token', async ({ browser }) => {
  const manifest = loadManifest();
  fixtureFor(manifest, 'AUTH-07');
  const context = await browser.newContext();
  const page = await context.newPage();
  let release!: () => void;
  let fetched!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { fetched = resolve; });
  try {
    await login(page, manifest, 'AUTH-07', 'owner');
    const first = await bffGet(page, manifest, '/api/auth/identity?surface=staff');
    expect(first.status).toBe(200);
    const actorA = first.json as { actorId: string; authEpoch: string };
    await page.goto(portalUrl(manifest, '/auth'));
    const oldAccessName = `oidc_access_token__${actorA.authEpoch}`;
    await context.addCookies([{ name: oldAccessName, value: 'expired', url: manifest.origins.portal,
      httpOnly: true, secure: true, sameSite: 'Lax' }]);

    let held = false;
    await context.route('**/api/auth/identity?surface=staff', async (route) => {
      if (held) { await route.continue(); return; }
      held = true;
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(200);
      noStore(upstream.headers()['cache-control']);
      const setCookie = upstream.headers()['set-cookie'] ?? '';
      expect(setCookie).toContain(`${oldAccessName}=`);
      expect(setCookie).not.toContain('portal_staff_epoch=');
      fetched();
      await released;
      await route.fulfill({ response: upstream });
    });
    const late = page.evaluate(async () => {
      const response = await fetch('/api/auth/identity?surface=staff', { cache: 'no-store' });
      return response.status;
    });
    await ready;

    const switchPage = await context.newPage();
    await switchPage.goto(portalUrl(manifest, '/api/auth/logout'));
    await switchPage.goto(portalUrl(manifest, '/auth'));
    await login(switchPage, manifest, 'AUTH-07', 'owner');
    const second = await bffGet(switchPage, manifest, '/api/auth/identity?surface=staff');
    expect(second.status).toBe(200);
    const actorB = second.json as typeof actorA;
    expect(actorB.actorId).toBe(actorA.actorId);
    expect(actorB.authEpoch).not.toBe(actorA.authEpoch);
    const newerAccessName = `oidc_access_token__${actorB.authEpoch}`;
    const beforeRelease = await context.cookies(manifest.origins.portal);
    const newerToken = beforeRelease.find((cookie) => cookie.name === newerAccessName)?.value;
    expect(newerToken).toBeTruthy();

    release();
    expect(await late).toBe(200);
    const afterRelease = await context.cookies(manifest.origins.portal);
    expect(afterRelease.find((cookie) => cookie.name === newerAccessName)?.value).toBe(newerToken);
    expect(afterRelease.find((cookie) => cookie.name === 'portal_staff_epoch')?.value).toBe(actorB.authEpoch);
    expect((await bffGet(switchPage, manifest, '/api/auth/identity?surface=staff')).status).toBe(200);
  } finally {
    release();
    await context.close();
  }
});
