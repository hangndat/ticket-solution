import { readFileSync, writeFileSync } from 'node:fs';
import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import {
  eventPath,
  fillPublishedForm,
  login,
  openCodeConfirmation,
  walletTicketIds,
  webUrl,
} from './helpers';

type FaultMode = 'unavailable' | 'error500' | 'lostResponse' | 'timeout';

function catalogListPaths(manifest: ReturnType<typeof loadManifest>): string[] {
  return [
    ...new Set(
      Object.values(manifest.cases)
        .map((entry) => entry.tenantSlug)
        .filter(Boolean)
        .map((slug) => `/v1/public/tenants/${slug}/events`),
    ),
  ];
}

function setFaultRoutes(
  control: string,
  ownerRunId: string,
  paths: string[],
  mode: FaultMode | null,
) {
  let current: { ownerRunId: string; routes: Record<string, string> };
  try {
    current = JSON.parse(readFileSync(control, 'utf8'));
  } catch {
    current = { ownerRunId, routes: {} };
  }
  current.ownerRunId = ownerRunId;
  current.routes = current.routes ?? {};
  for (const path of paths) {
    if (mode) current.routes[path] = mode;
    else delete current.routes[path];
  }
  writeFileSync(control, JSON.stringify(current), { mode: 0o600 });
}

function faultControlPathFor(manifest: ReturnType<typeof loadManifest>) {
  const control = manifest.runtime?.faultControlPath;
  if (typeof control !== 'string')
    throw new Error('BLOCKED: run fault control missing');
  return control;
}

function setFaultRoute(
  control: string,
  ownerRunId: string,
  path: string,
  mode: FaultMode | null,
) {
  let current: { ownerRunId: string; routes: Record<string, string> };
  try {
    current = JSON.parse(readFileSync(control, 'utf8'));
  } catch {
    current = { ownerRunId, routes: {} };
  }
  current.ownerRunId = ownerRunId;
  current.routes = current.routes ?? {};
  if (mode) current.routes[path] = mode;
  else delete current.routes[path];
  writeFileSync(control, JSON.stringify(current), { mode: 0o600 });
}

test('[WEB-10] public detail shows upstream failure and recovers after transport restoration', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'WEB-10');
  const control = faultControlPathFor(manifest);
  const path = `/v1/public/tenants/${fixture.tenantSlug}/events/${fixture.eventSlug}`;
  const setFault = (mode: FaultMode | null) =>
    setFaultRoute(control, manifest.runId, path, mode);
  try {
    setFault('unavailable');
    await page.goto(webUrl(manifest, eventPath(fixture)));
    await expect(page.getByTestId('event-unreachable')).toBeVisible();
    await expect(page.getByTestId('event-published')).toHaveCount(0);
    setFault(null);
    await page.reload();
    await expect(page.getByTestId('event-published')).toBeVisible();
    await expect(page.getByTestId('event-unreachable')).toHaveCount(0);
  } finally {
    setFault(null);
  }
});

test('[WEB-10] home catalog distinguishes upstream unavailable from filter empty and recovers', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'WEB-10');
  const control = faultControlPathFor(manifest);
  const listPaths = catalogListPaths(manifest);
  const setCatalogFault = (mode: FaultMode | null) =>
    setFaultRoutes(control, manifest.runId, listPaths, mode);
  try {
    await page.goto(webUrl(manifest, '/'));
    await expect(page.getByTestId('home-catalog-grid')).toBeVisible();
    await expect(page.getByTestId(`home-event-${fixture.eventId}`)).toBeVisible();

    await page.getByTestId('home-catalog-filter-past').click();
    await expect(page.getByTestId('home-catalog-empty')).toBeVisible();
    await expect(page.getByTestId('home-events-unreachable')).toHaveCount(0);
    await expect(page.getByTestId('home-catalog-grid')).toHaveCount(0);

    await page.getByTestId('home-catalog-filter-upcoming').click();
    await expect(page.getByTestId('home-catalog-grid')).toBeVisible();

    setCatalogFault('unavailable');
    await page.reload();
    await expect(page.getByTestId('home-events-unreachable')).toBeVisible();
    await expect(page.getByTestId('home-catalog-empty')).toHaveCount(0);
    await expect(page.getByTestId('home-catalog-grid')).toHaveCount(0);
    await expect(page.getByTestId('home-events-empty')).toHaveCount(0);

    setCatalogFault(null);
    await page.reload();
    await expect(page.getByTestId('home-catalog-grid')).toBeVisible();
    await expect(page.getByTestId('home-events-unreachable')).toHaveCount(0);
  } finally {
    setCatalogFault(null);
  }
});

test('[WEB-10] owner wallet distinguishes upstream unavailable from real empty and recovers with real data', async ({
  page,
}) => {
  const manifest = loadManifest();
  const control = faultControlPathFor(manifest);
  const path = '/v1/me/tickets';
  const setFault = (mode: FaultMode | null) =>
    setFaultRoute(control, manifest.runId, path, mode);
  try {
    await login(page, manifest, accountFor(manifest, 'WEB-10', 'attendee'));
    // Real empty — fresh attendee has no ticket anywhere; this is genuine
    // upstream data, not a fault and not a fixture fallback.
    await expect(page.getByTestId('wallet-ready')).toBeVisible();
    await expect(page.getByTestId('wallet-empty')).toBeVisible();
    await expect(page.getByTestId('wallet-ticket-grid')).toHaveCount(0);

    setFault('unavailable');
    await page.reload();
    await expect(page.getByTestId('wallet-unreachable')).toBeVisible();
    await expect(page.getByTestId('wallet-empty')).toHaveCount(0);
    await expect(page.getByTestId('wallet-ready')).toHaveCount(0);

    setFault(null);
    await page.reload();
    await expect(page.getByTestId('wallet-ready')).toBeVisible();
    await expect(page.getByTestId('wallet-empty')).toBeVisible();
    await expect(page.getByTestId('wallet-unreachable')).toHaveCount(0);

    // A real upstream 500 (non-retryable server error) must collapse to the
    // same unreachable state as 503 — not an empty wallet, not a fake ready
    // grid — and must also recover once the fault clears.
    setFault('error500');
    await page.reload();
    await expect(page.getByTestId('wallet-unreachable')).toBeVisible();
    await expect(page.getByTestId('wallet-empty')).toHaveCount(0);
    await expect(page.getByTestId('wallet-ready')).toHaveCount(0);

    setFault(null);
    await page.reload();
    await expect(page.getByTestId('wallet-ready')).toBeVisible();
    await expect(page.getByTestId('wallet-empty')).toBeVisible();
    await expect(page.getByTestId('wallet-unreachable')).toHaveCount(0);
  } finally {
    setFault(null);
  }
});

test('[WEB-10] redeem shows client timeout when upstream hangs without committing or faking success', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'WEB-10');
  if (!fixture.code)
    throw new Error('BLOCKED: WEB-10 cần code cho timeout branch');
  const control = faultControlPathFor(manifest);
  const path = `/v1/tenants/${fixture.tenantId}/events/${fixture.eventId}/redemptions`;
  const setFault = (mode: FaultMode | null) =>
    setFaultRoute(control, manifest.runId, path, mode);
  const answers = fixture.data?.answers as
    | Record<string, string | boolean>
    | undefined;

  try {
    await login(page, manifest, accountFor(manifest, 'WEB-10', 'attendee'));
    expect(
      await walletTicketIds(page, manifest, fixture.tenantId),
    ).toHaveLength(0);

    setFault('timeout');
    await openCodeConfirmation(page, manifest, fixture.code);
    await fillPublishedForm(page, answers);
    await page
      .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
      .click();
    await expect(page.getByTestId('redeem-ux-timeout')).toBeVisible({
      timeout: 35_000,
    });
    await expect(page.getByTestId('redeem-ux-success')).toHaveCount(0);
    await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
    expect(
      await walletTicketIds(page, manifest, fixture.tenantId),
    ).toHaveLength(0);
  } finally {
    setFault(null);
  }
});

test('[WEB-10] redeem distinguishes a request that never reached the server from a lost response that already committed, and never fakes success', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'WEB-10');
  if (!fixture.code || !fixture.secondCode)
    throw new Error('BLOCKED: WEB-10 cần code và secondCode');
  const control = faultControlPathFor(manifest);
  const path = `/v1/tenants/${fixture.tenantId}/events/${fixture.eventId}/redemptions`;
  const setFault = (mode: FaultMode | null) =>
    setFaultRoute(control, manifest.runId, path, mode);
  const answers = fixture.data?.answers as
    Record<string, string | boolean> | undefined;

  try {
    await login(page, manifest, accountFor(manifest, 'WEB-10', 'attendee'));
    const before = await walletTicketIds(page, manifest, fixture.tenantId);
    expect(before).toHaveLength(0);

    // The request never reaches the API — no operation is ever created, so
    // the UI must not claim success and the code must stay redeemable.
    setFault('unavailable');
    await openCodeConfirmation(page, manifest, fixture.code);
    await fillPublishedForm(page, answers);
    await page
      .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
      .click();
    await expect(page.getByTestId('redeem-ux-error')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
    expect(
      await walletTicketIds(page, manifest, fixture.tenantId),
    ).toHaveLength(0);

    // Clearing the fault lets the same, never-consumed code redeem for real.
    setFault(null);
    await openCodeConfirmation(page, manifest, fixture.code);
    await fillPublishedForm(page, answers);
    await page
      .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
      .click();
    await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
    const firstTicketId = (
      await page
        .getByTestId('redeem-ticket-card')
        .locator('dd')
        .first()
        .textContent()
    )?.trim();
    expect(firstTicketId).toMatch(/^[0-9a-f-]{36}$/i);

    // The server commits the second code, but the proxy drops the response
    // before it reaches the client — outcome must reconcile to the one real
    // operation (no duplicate ticket, no fabricated success).
    setFault('lostResponse');
    await openCodeConfirmation(page, manifest, fixture.secondCode);
    await fillPublishedForm(page, answers);
    await page
      .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
      .click();
    await expect(page.getByTestId('redeem-ux-success')).toBeVisible({
      timeout: 35_000,
    });
    const secondTicketId = (
      await page
        .getByTestId('redeem-ticket-card')
        .locator('dd')
        .first()
        .textContent()
    )?.trim();
    expect(secondTicketId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondTicketId).not.toBe(firstTicketId);

    setFault(null);
    const after = await walletTicketIds(page, manifest, fixture.tenantId);
    expect(after.sort()).toEqual([firstTicketId, secondTicketId].sort());
  } finally {
    setFault(null);
  }
});
