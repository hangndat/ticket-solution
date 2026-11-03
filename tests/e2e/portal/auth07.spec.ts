import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright/test';
import { test, expect, loadManifest, fixtureFor } from '../harness/fixtures';
import {
  annotateAuth07BfcacheDirection,
  annotateAuth07BfcacheEvidence,
  annotateAuth07BfcacheTimeline,
  annotateAuth07ControlGap,
  assertAuth07AuditTableNotActorA,
  auth07BfcacheProbeInit,
  installAuth07BfcacheTimeline,
  readAuth07BfcacheEvidence,
  readAuth07NavigationObservation,
  readForwardPageshowPersisted,
  resetAuth07PageshowObservation,
} from './auth07-bfcache-probe';
import { bffGet, bffMutate, eventBff, eventPath, login, portalUrl } from './helpers';

const noStore = (value: string | undefined) => expect(value).toMatch(/private.*no-store/i);

test('[AUTH-07] Portal drops held staff document and audit JSON after another staff login', async ({ browser }) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'AUTH-07');
  expect(process.env.E2E_AUTH07_BFCACHE).toBe('1');
  const auditPath = eventPath(fixture, '/audit');
  const auditUrl = portalUrl(manifest, auditPath);
  const auditBff = eventBff(fixture, '/audit');
  const context = await browser.newContext();
  const timeline = await installAuth07BfcacheTimeline(context);
  test.info().annotations.push({
    type: 'auth07-browser',
    description: `channel=chromium-new-headless version=${browser.version()} executable=${chromium.executablePath().split('/').pop()}`,
  });
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
    await oldTab.addInitScript(auth07BfcacheProbeInit);
    await oldTab.goto(portalUrl(manifest, '/auth'));
    const oldDocument = await oldTab.goto(auditUrl);
    expect(oldDocument?.status()).toBe(200);
    noStore(oldDocument?.headers()['cache-control']);
    expect(await oldDocument?.text()).not.toContain('E2E AUTH-07');
    await expect(oldTab.getByTestId('audit-table')).toBeVisible();

    const staffHomePath = eventPath(fixture);
    const staffHome = portalUrl(manifest, staffHomePath);
    await oldTab.goto(staffHome);
    const controlTimelineMark = timeline.mark();
    await oldTab.goBack();
    await expect(oldTab).toHaveURL(auditUrl, { ignoreTrailingSlash: true });
    await oldTab.waitForLoadState('domcontentloaded');
    const controlBack = await readAuth07NavigationObservation(oldTab);
    await resetAuth07PageshowObservation(oldTab);
    const controlForwardDocument = await oldTab.goForward();
    if (controlForwardDocument) noStore(controlForwardDocument.headers()['cache-control']);
    await expect(oldTab).toHaveURL(staffHome);
    await oldTab.waitForLoadState('domcontentloaded');
    const controlForwardPersisted = await readForwardPageshowPersisted(oldTab);
    const controlForward = await readAuth07NavigationObservation(oldTab);
    const controlCookieEpoch = (await context.cookies(auditUrl)).find(
      (cookie) => cookie.name === 'portal_staff_epoch',
    )?.value;
    expect(controlCookieEpoch).toBe(actorA.authEpoch);
    const controlBfcacheEvidence = await readAuth07BfcacheEvidence(oldTab, controlForwardPersisted);
    annotateAuth07BfcacheEvidence(test.info(), controlBfcacheEvidence, {
      actorAEpoch: actorA.authEpoch,
      actorBEpoch: actorA.authEpoch,
      cookieStaffEpoch: controlCookieEpoch,
    }, { phase: 'control' });
    annotateAuth07BfcacheDirection(test.info(), 'control', 'back', controlBack);
    annotateAuth07BfcacheDirection(test.info(), 'control', 'forward', controlForward);
    annotateAuth07BfcacheTimeline(test.info(), timeline.since(controlTimelineMark), 'control');
    const controlValid = controlForwardPersisted === true;
    test.info().annotations.push({
      type: 'auth07-control-gate',
      description: controlValid ? 'valid' : 'gap',
    });
    if (!controlValid) {
      annotateAuth07ControlGap(test.info(), {
        browserVersion: browser.version(),
        back: controlBack,
        forward: controlForward,
        notRestoredReasons: controlBfcacheEvidence.notRestoredReasons,
      });
    }
    await oldTab.goto(auditUrl);
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
    const switchTimelineMark = timeline.mark();
    await oldTab.goBack();
    await oldTab.waitForLoadState('domcontentloaded');
    const switchBack = await readAuth07NavigationObservation(oldTab);
    await resetAuth07PageshowObservation(oldTab);
    const forwardDocument = await oldTab.goForward();
    if (forwardDocument) noStore(forwardDocument.headers()['cache-control']);
    await expect(oldTab).toHaveURL(auditUrl);
    await oldTab.waitForLoadState('domcontentloaded');
    const forwardPersisted = await readForwardPageshowPersisted(oldTab);
    const switchForward = await readAuth07NavigationObservation(oldTab);
    if (controlValid) {
      annotateAuth07BfcacheDirection(test.info(), 'post-switch', 'back', switchBack);
      annotateAuth07BfcacheDirection(test.info(), 'post-switch', 'forward', switchForward);
      annotateAuth07BfcacheTimeline(test.info(), timeline.since(switchTimelineMark), 'post-switch');
      const bfcacheEvidence = await readAuth07BfcacheEvidence(oldTab, forwardPersisted);
      annotateAuth07BfcacheEvidence(test.info(), bfcacheEvidence, {
        actorAEpoch: actorA.authEpoch,
        actorBEpoch: actorB.authEpoch,
        cookieStaffEpoch: (await context.cookies(auditUrl)).find(
          (cookie) => cookie.name === 'portal_staff_epoch',
        )?.value,
      }, { phase: 'post-switch' });
    } else {
      test.info().annotations.push({
        type: 'auth07-switch-measurement',
        description: 'skipped-invalid-control',
      });
    }
    await assertAuth07AuditTableNotActorA(oldTab, actorA);
    await oldTab.waitForTimeout(0);
    const cookieStaffEpoch = (await context.cookies(auditUrl)).find(
      (cookie) => cookie.name === 'portal_staff_epoch',
    )?.value;
    expect(cookieStaffEpoch).toBe(actorB.authEpoch);
    const reloaded = await oldTab.reload();
    noStore(reloaded?.headers()['cache-control']);
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
  let releaseLogout: (() => void) | undefined;
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
    let identityRequests = 0;
    let probeError: unknown;
    await context.route('**/api/auth/identity?surface=staff', async (route) => {
      identityRequests += 1;
      const requestNumber = identityRequests;
      const probe = route.request().headers()['x-e2e-auth07-probe'] === 'refresh';
      const cookieHeader = (await route.request().allHeaders()).cookie ?? '';
      const accessCookie = cookieHeader.split(';').map((part) => part.trim())
        .find((part) => part.startsWith(`${oldAccessName}=`));
      test.info().annotations.push({ type: 'auth07-identity-request', description:
        `request=${requestNumber} time=${Date.now()} probe=${probe} accessPresent=${Boolean(accessCookie)} accessExpiredFixture=${accessCookie === `${oldAccessName}=expired`}` });
      if (!probe || held) { await route.continue(); return; }
      held = true;
      try {
        const upstream = await route.fetch();
        const setCookie = upstream.headers()['set-cookie'] ?? '';
        test.info().annotations.push({ type: 'auth07-refresh-probe', description:
          `request=${requestNumber} time=${Date.now()} status=${upstream.status()} accessCookie=${setCookie.includes(`${oldAccessName}=`)} epochCookie=${setCookie.includes('portal_staff_epoch=')}` });
        expect(upstream.status()).toBe(200);
        noStore(upstream.headers()['cache-control']);
        expect(setCookie).toContain(`${oldAccessName}=`);
        expect(setCookie).not.toContain('portal_staff_epoch=');
        fetched();
        await released;
        await route.fulfill({ response: upstream });
      } catch (error) {
        probeError = error;
        fetched();
        await route.abort().catch(() => {});
      }
    });
    const late = page.evaluate(async () => {
      const response = await fetch('/api/auth/identity?surface=staff', { cache: 'no-store', headers: { 'x-e2e-auth07-probe': 'refresh' } });
      return response.status;
    });
    await ready;
    if (probeError) { await late.catch(() => {}); throw probeError; }

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

    await context.addCookies([{ name: newerAccessName, value: 'expired', url: manifest.origins.portal,
      httpOnly: true, secure: true, sameSite: 'Lax' }]);
    let fetchedLogout!: () => void;
    const logoutReleased = new Promise<void>((resolve) => { releaseLogout = resolve; });
    const logoutReady = new Promise<void>((resolve) => { fetchedLogout = resolve; });
    let heldLogout = false;
    let logoutProbeError: unknown;
    await context.route('**/api/auth/identity?surface=staff', async (route) => {
      if (route.request().headers()['x-e2e-auth07-probe'] !== 'logout' || heldLogout) { await route.continue(); return; }
      heldLogout = true;
      try {
        const upstream = await route.fetch();
        expect(upstream.status()).toBe(200);
        noStore(upstream.headers()['cache-control']);
        expect(upstream.headers()['set-cookie']).toContain(`${newerAccessName}=`);
        fetchedLogout();
        await logoutReleased;
        await route.fulfill({ response: upstream });
      } catch (error) {
        logoutProbeError = error;
        fetchedLogout();
        await route.abort().catch(() => {});
      }
    });
    const lateLogout = page.evaluate(async () =>
      (await fetch('/api/auth/identity?surface=staff', { cache: 'no-store', headers: { 'x-e2e-auth07-probe': 'logout' } })).status);
    await logoutReady;
    if (logoutProbeError) { await lateLogout.catch(() => {}); throw logoutProbeError; }
    await switchPage.goto(portalUrl(manifest, '/api/auth/logout'));
    await switchPage.goto(portalUrl(manifest, '/auth'));
    const loggedOut = await context.cookies(manifest.origins.portal);
    const logoutEpoch = loggedOut.find((cookie) => cookie.name === 'portal_staff_epoch')?.value;
    expect(logoutEpoch).toBeTruthy();
    expect(logoutEpoch).not.toBe(actorB.authEpoch);
    expect(loggedOut.some((cookie) => cookie.name === 'portal_staff_subject')).toBe(false);
    releaseLogout();
    expect(await lateLogout).toBe(200);
    const afterLateLogout = await context.cookies(manifest.origins.portal);
    expect(afterLateLogout.find((cookie) => cookie.name === 'portal_staff_epoch')?.value).toBe(logoutEpoch);
    expect(afterLateLogout.some((cookie) => cookie.name === 'portal_staff_subject')).toBe(false);
    expect((await bffGet(switchPage, manifest, '/api/auth/identity?surface=staff')).status).toBe(401);
  } finally {
    release();
    releaseLogout?.();
    await context.close();
  }
});

test('[AUTH-07] held audit JSON from a prior same-sub login never commits', async ({ browser }) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'AUTH-07');
  const auditUrl = portalUrl(manifest, eventPath(fixture, '/audit'));
  const auditBff = eventBff(fixture, '/audit');
  const context = await browser.newContext();
  const switchPage = await context.newPage();
  let releaseOld!: () => void;
  let releaseNew!: () => void;
  let oldFetched!: () => void;
  let oldFulfilled!: () => void;
  const oldReleased = new Promise<void>((resolve) => { releaseOld = resolve; });
  const newReleased = new Promise<void>((resolve) => { releaseNew = resolve; });
  const oldReady = new Promise<void>((resolve) => { oldFetched = resolve; });
  const oldDone = new Promise<void>((resolve) => { oldFulfilled = resolve; });
  try {
    await login(switchPage, manifest, 'AUTH-07', 'owner');
    const first = await bffGet(switchPage, manifest, '/api/auth/identity?surface=staff');
    expect(first.status).toBe(200);
    const actorA = first.json as { actorId: string; authEpoch: string };
    let firstRequest = true;
    await context.route((url) => url.pathname === auditBff, async (route) => {
      if (!firstRequest) {
        await newReleased;
        await route.continue();
        return;
      }
      firstRequest = false;
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(200);
      noStore(upstream.headers()['cache-control']);
      expect(upstream.headers()['x-portal-auth-epoch']).toBe(actorA.authEpoch);
      oldFetched();
      await oldReleased;
      try { await route.fulfill({ response: upstream }); }
      finally { oldFulfilled(); }
    });
    const oldTab = await context.newPage();
    await oldTab.goto(portalUrl(manifest, '/auth'));
    const oldNavigation = oldTab.goto(auditUrl);
    await oldReady;

    await switchPage.goto(portalUrl(manifest, '/api/auth/logout'));
    await switchPage.goto(portalUrl(manifest, '/auth'));
    await login(switchPage, manifest, 'AUTH-07', 'owner');
    const second = await bffGet(switchPage, manifest, '/api/auth/identity?surface=staff');
    expect(second.status).toBe(200);
    const actorB = second.json as typeof actorA;
    expect(actorB.actorId).toBe(actorA.actorId);
    expect(actorB.authEpoch).not.toBe(actorA.authEpoch);

    releaseOld();
    await oldDone;
    await oldNavigation;
    await expect(oldTab.getByTestId('audit-table')).toHaveCount(0);
    releaseNew();
    await expect(oldTab.getByTestId('audit-table')).toBeVisible();
  } finally {
    releaseOld();
    releaseNew();
    await context.close();
  }
});

test('[AUTH-07] held staff CSV download cannot commit after platform login', async ({ browser }) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'AUTH-07');
  const context = await browser.newContext();
  const staffPage = await context.newPage();
  const exportsPath = eventBff(fixture, '/exports');
  const navigationEvents: string[] = [];
  staffPage.on('framenavigated', (frame) => {
    if (frame === staffPage.mainFrame()) {
      const url = new URL(frame.url());
      if (url.origin === new URL(manifest.origins.portal).origin)
        navigationEvents.push(`navigation:${url.pathname}`);
    }
  });
  staffPage.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === exportsPath)
      navigationEvents.push(`export-request-failed:${request.failure()?.errorText ?? 'unknown'}`);
  });
  let release!: () => void;
  let fetched!: () => void;
  let routeSettled!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { fetched = resolve; });
  const settled = new Promise<void>((resolve) => { routeSettled = resolve; });
  try {
    await login(staffPage, manifest, 'AUTH-07', 'owner');
    // The home page redirects asynchronously after discovery; wait for the
    // actual audit route before issuing a fetch in this document's context.
    await staffPage.goto(portalUrl(manifest, `${eventPath(fixture, '/audit')}#jobs`));
    const input = staffPage.getByTestId('export-id-input');
    await expect(input).toBeVisible();
    await expect.poll(() => staffPage.evaluate(() => document.cookie.includes('portal_csrf='))).toBe(true);
    const created = await bffMutate(staffPage, exportsPath,
      { format: 'csv', filter: {}, idempotencyKey: randomUUID() });
    expect([200, 201], JSON.stringify(created.json)).toContain(created.status);
    const exportId = (created.json as { exportId?: string }).exportId;
    expect(exportId).toMatch(/^[0-9a-f-]{36}$/);
    const statusPath = `${exportsPath}/${exportId}`;
    await expect.poll(async () => {
      const status = await bffGet(staffPage, manifest, statusPath);
      expect(status.status).toBe(200);
      return (status.json as { status?: string }).status;
    }, { timeout: 30_000 }).toBe('READY');

    await input.fill(exportId!);
    const downloadPath = `${statusPath}/download`;
    let held = false;
    await context.route((url) => url.pathname === downloadPath, async (route) => {
      if (held) { await route.continue(); return; }
      held = true;
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(200);
      noStore(upstream.headers()['cache-control']);
      expect(upstream.headers()['content-type']).toMatch(/text\/csv/i);
      fetched();
      await released;
      try { await route.fulfill({ response: upstream }); }
      finally { routeSettled(); }
    });
    let downloads = 0;
    staffPage.on('download', () => { downloads++; });
    await staffPage.getByRole('button', { name: 'Tải CSV' }).click();
    await ready;

    const platformPage = await context.newPage();
    await platformPage.goto(portalUrl(manifest, '/api/auth/logout'));
    await platformPage.goto(portalUrl(manifest, '/auth'));
    await login(platformPage, manifest, 'AUTH-07', 'operator', 'platform');
    const platform = await bffGet(platformPage, manifest, '/api/auth/identity?surface=platform');
    expect(platform.status).toBe(200);
    expect((platform.json as { surface: string }).surface).toBe('platform');
    const denied = await bffGet(platformPage, manifest, downloadPath);
    expect(denied.status).toBe(401);
    noStore(denied.headers['cache-control']);

    release();
    await settled;
    await staffPage.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await expect(staffPage.getByTestId('export-result')).toHaveCount(0);
    expect(downloads).toBe(0);
    await expect(platformPage.getByTestId('audit-table')).toHaveCount(0);
  } finally {
    test.info().annotations.push({ type: 'auth07-csv-navigation', description: navigationEvents.join(' ') });
    release();
    await context.close();
  }
});
