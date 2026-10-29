import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  loadManifest,
  fixtureFor,
  accountFor,
} from '../harness/fixtures';
import {
  caseData,
  eventPath,
  fillPublishedForm,
  login,
  openCodeConfirmation,
  assertRedeemOutcomePanel,
  assertWalletUnchanged,
  postRedeemDirect,
  resolveGlobalCode,
  submitGlobalRedeemForm,
  walletTicketIds,
  webUrl,
} from './helpers';
import { ticketLink, waitForMail } from './mailpit';
import {
  assertIssuedExactlyOnce,
  assertNoExtraIssue,
  codeIdFor,
  readRedemptionState,
} from './redemption-db';
import { withLegacyCodeCollision } from './web03-ambiguity';

async function redeemCode(
  page: import('playwright/test').Page,
  manifest: import('../harness/contract').E2EManifest,
  caseId: string,
) {
  const f = fixtureFor(manifest, caseId);
  if (!f.code) throw new Error(`BLOCKED: ${caseId} cần code riêng`);
  await login(page, manifest, accountFor(manifest, caseId, 'attendee'));
  await openCodeConfirmation(page, manifest, f.code);
  await fillPublishedForm(
    page,
    f.data?.answers as Record<string, string | boolean> | undefined,
  );
  await page
    .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
    .click();
  return f;
}

function stableOutbox(state: Awaited<ReturnType<typeof readRedemptionState>>) {
  return state.outbox.map(({ status, ...row }) => row);
}

test('[WEB-02] verified attendee redeems auto code and reloads QR', async ({
  page,
}) => {
  const manifest = loadManifest();
  const fixture = fixtureFor(manifest, 'WEB-02');
  const codeId = codeIdFor(fixture);
  const before = await readRedemptionState(fixture, codeId);
  const f = await redeemCode(page, manifest, 'WEB-02');
  await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
  const card = page.getByTestId('redeem-ticket-card');
  await expect(card).toBeVisible();
  const ticketId = (await card.locator('dd').first().textContent())?.trim();
  expect(ticketId).toMatch(/^[0-9a-f-]{36}$/i);
  const issued = await readRedemptionState(f, codeId);
  assertIssuedExactlyOnce(
    before,
    issued,
    f,
    accountFor(manifest, 'WEB-02', 'attendee').userId!,
    ticketId,
  );
  const ids = await walletTicketIds(page, manifest, f.tenantId);
  expect(ids.filter((id) => id === ticketId)).toHaveLength(1);
  await page.goto(webUrl(manifest, '/wallet'));
  await expect(page.getByTestId(`wallet-ticket-${ticketId}`)).toBeVisible();
  await page.getByTestId(`wallet-ticket-${ticketId}`).click();
  await expect(page.getByTestId('owner-ticket-qr-figure')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('owner-ticket-qr-figure')).toBeVisible();
  assertNoExtraIssue(issued, await readRedemptionState(f, codeId));
});

test('[WEB-03] event link survives login and issues for the globally resolved event', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-03');
  if (!f.code) throw new Error('BLOCKED: WEB-03 cần code');
  const codeId = codeIdFor(f);
  const before = await readRedemptionState(f, codeId);
  await page.goto(webUrl(manifest, eventPath(f)));
  const eventTitle = (await page.locator('#event-title').textContent())?.trim();
  expect(eventTitle).toBeTruthy();
  await page
    .getByTestId('event-sidebox')
    .getByRole('link', { name: 'Đổi mã lấy vé' })
    .click();
  await expect(page).toHaveURL(/\/redeem\?tenantSlug=/);
  await expect(page.getByTestId('redeem-auth-gate')).toBeVisible();
  await page
    .getByTestId('redeem-auth-gate')
    .getByRole('link', { name: 'Tiếp tục đăng nhập' })
    .click();
  const actor = accountFor(manifest, 'WEB-03', 'attendee');
  await page.locator('#username').fill(actor.username);
  await page.locator('#password').fill(actor.password);
  await page.locator('#kc-login').click();
  await expect(page).toHaveURL(/\/redeem\?tenantSlug=/);
  await expect(page.locator('#redeem-code-confirm')).toBeVisible();
  await expect(page.locator('input[name="tenantSlug"]')).toHaveValue(
    f.tenantSlug,
  );
  await expect(page.locator('input[name="eventSlug"]')).toHaveValue(
    f.eventSlug,
  );
  await page.goto(webUrl(manifest, '/redeem'));
  await page.getByTestId('redeem-global-code').fill(f.code);
  await page.getByTestId('redeem-global-resolve').click();
  await expect(page.getByTestId('redeem-global-context')).toBeVisible();
  await expect(
    page.getByTestId('redeem-global-context').getByText(eventTitle!, {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(webUrl(manifest, eventPath(f)));
  await page
    .getByTestId('event-sidebox')
    .getByRole('link', { name: 'Đổi mã lấy vé' })
    .click();
  await expect(page.locator('input[name="tenantSlug"]')).toHaveValue(
    f.tenantSlug,
  );
  await expect(page.locator('input[name="eventSlug"]')).toHaveValue(
    f.eventSlug,
  );
  await page.locator('#redeem-code-confirm').fill(f.code);
  await fillPublishedForm(
    page,
    f.data?.answers as Record<string, string | boolean>,
  );
  const [issueResponse] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/bff/redeem',
    ),
    page.getByRole('button', { name: 'Đổi mã lấy vé', exact: true }).click(),
  ]);
  expect(issueResponse.status()).toBe(201);
  await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
  const card = page.getByTestId('redeem-ticket-card');
  await expect(card).toBeVisible();
  const ticketId = (await card.locator('dd').first().textContent())?.trim();
  expect(ticketId).toMatch(/^[0-9a-f-]{36}$/i);
  const issued = await readRedemptionState(f, codeId);
  assertIssuedExactlyOnce(before, issued, f, actor.userId!, ticketId);
  expect(await walletTicketIds(page, manifest, f.tenantId)).toContain(ticketId);
});

test('[WEB-03] invalid and ambiguous codes keep context private and state unchanged', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-03');
  if (!f.code) throw new Error('BLOCKED: WEB-03 cần code');
  const codeId = codeIdFor(f);
  const before = await readRedemptionState(f, codeId);

  // The global entry must also survive login without putting the raw code in URL.
  await page.goto(webUrl(manifest, '/redeem'));
  await expect(page.getByTestId('redeem-auth-gate')).toBeVisible();
  await page
    .getByTestId('redeem-auth-gate')
    .getByRole('link', { name: 'Tiếp tục đăng nhập' })
    .click();
  const actor = accountFor(manifest, 'WEB-03', 'attendee');
  const ownerEmail = accountFor(manifest, 'WEB-03', 'owner').username;
  await page.locator('#username').fill(actor.username);
  await page.locator('#password').fill(actor.password);
  await page.locator('#kc-login').click();
  await expect(page).toHaveURL(webUrl(manifest, '/redeem'));
  await expect(page.getByTestId('redeem-global-code')).toBeVisible();
  const walletSignedIn = await walletTicketIds(page, manifest, f.tenantId);

  const invalidCode = caseData<string>(f, 'invalidCode');
  const [invalidGlobalResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/bff/redeem/resolve',
    ),
    resolveGlobalCode(page, manifest, invalidCode),
  ]);
  expect(invalidGlobalResponse.status()).toBe(422);
  expect(await invalidGlobalResponse.text()).not.toContain(f.eventId);
  expect(await invalidGlobalResponse.text()).not.toContain(f.tenantId);
  expect(await invalidGlobalResponse.text()).not.toContain(ownerEmail);
  await assertRedeemOutcomePanel(page, 'invalid');
  await expect(page.getByTestId('redeem-global-context')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(`E2E WEB-03`);
  await expect(page.locator('main')).not.toContainText(ownerEmail);
  const afterInvalidGlobal = await readRedemptionState(f, codeId);
  expect({
    ...afterInvalidGlobal,
    outbox: stableOutbox(afterInvalidGlobal),
  }).toEqual({
    ...before,
    outbox: stableOutbox(before),
  });
  await assertWalletUnchanged(page, manifest, f.tenantId, walletSignedIn);

  // The event link may show its published event, but a wrong code cannot issue.
  await page.goto(webUrl(manifest, eventPath(f)));
  await page
    .getByTestId('event-sidebox')
    .getByRole('link', { name: 'Đổi mã lấy vé' })
    .click();
  await expect(page.locator('input[name="tenantSlug"]')).toHaveValue(
    f.tenantSlug,
  );
  await expect(page.locator('input[name="eventSlug"]')).toHaveValue(
    f.eventSlug,
  );
  await page.locator('#redeem-code-confirm').fill(invalidCode);
  await fillPublishedForm(
    page,
    f.data?.answers as Record<string, string | boolean>,
  );
  const [invalidEventResponse] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/bff/redeem',
    ),
    page.getByRole('button', { name: 'Đổi mã lấy vé', exact: true }).click(),
  ]);
  expect(invalidEventResponse.status()).toBe(422);
  expect(await invalidEventResponse.text()).not.toContain(ownerEmail);
  await assertRedeemOutcomePanel(page, 'invalid');
  await expect(page).toHaveURL(/\/redeem\?tenantSlug=/);
  const afterInvalidEvent = await readRedemptionState(f, codeId);
  expect(afterInvalidEvent.code).toEqual(before.code);
  expect(afterInvalidEvent.requests).toEqual(before.requests);
  expect(afterInvalidEvent.tickets).toEqual(before.tickets);
  expect(afterInvalidEvent.quotas).toEqual(before.quotas);
  expect(stableOutbox(afterInvalidEvent)).toEqual(stableOutbox(before));
  expect(afterInvalidEvent.operations).toHaveLength(
    before.operations.length + 1,
  );
  expect(
    afterInvalidEvent.operations.filter(
      (row) =>
        (row.response_json as { code?: string } | null)?.code ===
        'CODE_INVALID',
    ),
  ).toHaveLength(1);
  await assertWalletUnchanged(page, manifest, f.tenantId, walletSignedIn);

  // A second event with the same legacy code makes the real routing group ambiguous.
  await withLegacyCodeCollision(f, codeId, async () => {
    const [ambiguousResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/bff/redeem/resolve',
      ),
      resolveGlobalCode(page, manifest, f.code!),
    ]);
    expect(((await ambiguousResponse.json()) as { code?: string }).code).toBe(
      'RESOLVE_DISABLED',
    );
    expect(await ambiguousResponse.text()).not.toContain(f.eventId);
    expect(await ambiguousResponse.text()).not.toContain(f.tenantId);
    expect(await ambiguousResponse.text()).not.toContain(ownerEmail);
    await assertRedeemOutcomePanel(page, 'closed');
    await expect(page.getByTestId('redeem-global-context')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(`E2E WEB-03`);
    await expect(page.locator('main')).not.toContainText(ownerEmail);
    const afterAmbiguous = await readRedemptionState(f, codeId);
    expect({ ...afterAmbiguous, outbox: stableOutbox(afterAmbiguous) }).toEqual(
      {
        ...afterInvalidEvent,
        outbox: stableOutbox(afterInvalidEvent),
      },
    );
    await assertWalletUnchanged(page, manifest, f.tenantId, walletSignedIn);
  });
});

test.describe('[WEB-04] negative redeem matrix', () => {
  test('invalid code does not issue ticket or reveal owner data', async ({
    page,
  }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-04');
    await login(page, manifest, accountFor(manifest, 'WEB-04', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await resolveGlobalCode(page, manifest, caseData<string>(f, 'invalidCode'));
    await assertRedeemOutcomePanel(page, 'invalid');
    await assertWalletUnchanged(page, manifest, f.tenantId, before);
  });

  test('expired redemption window returns closed UX without issuing', async ({
    page,
  }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-04');
    await login(page, manifest, accountFor(manifest, 'WEB-04', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await resolveGlobalCode(page, manifest, caseData<string>(f, 'expiredCode'));
    await assertRedeemOutcomePanel(page, 'closed');
    await assertWalletUnchanged(page, manifest, f.tenantId, before);
  });

  test('used code does not issue a second ticket', async ({ page }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-04');
    await login(page, manifest, accountFor(manifest, 'WEB-04', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await resolveGlobalCode(page, manifest, caseData<string>(f, 'usedCode'));
    await expect(page.getByTestId('redeem-global-context')).toBeVisible();
    await submitGlobalRedeemForm(
      page,
      f.data?.answers as Record<string, string | boolean> | undefined,
    );
    await assertRedeemOutcomePanel(page, 'used');
    await assertWalletUnchanged(page, manifest, f.tenantId, before);
  });

  test('closed event does not issue ticket or leak email', async ({ page }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-04');
    await login(page, manifest, accountFor(manifest, 'WEB-04', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await resolveGlobalCode(page, manifest, caseData<string>(f, 'closedCode'));
    await assertRedeemOutcomePanel(page, 'closed');
    await assertWalletUnchanged(page, manifest, f.tenantId, before);
  });

  test('exhausted quota does not issue ticket on submit', async ({ page }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-04');
    await login(page, manifest, accountFor(manifest, 'WEB-04', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await resolveGlobalCode(page, manifest, caseData<string>(f, 'quotaCode'));
    await expect(page.getByTestId('redeem-global-context')).toBeVisible();
    await submitGlobalRedeemForm(
      page,
      f.data?.answers as Record<string, string | boolean> | undefined,
    );
    await assertRedeemOutcomePanel(page, 'exhausted');
    await assertWalletUnchanged(page, manifest, f.tenantId, before);
  });

  test('suspended tenant blocks redeem without leaking owner email', async ({
    page,
  }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-04');
    await login(page, manifest, accountFor(manifest, 'WEB-04', 'attendee'));
    const beforeMain = await walletTicketIds(page, manifest, f.tenantId);
    const suspendedTenantId = caseData<string>(f, 'suspendedTenantId');
    const beforeSuspended = await walletTicketIds(
      page,
      manifest,
      suspendedTenantId,
    );
    await resolveGlobalCode(
      page,
      manifest,
      caseData<string>(f, 'suspendedCode'),
    );
    await expect(page.getByTestId('redeem-global-context')).toBeVisible();
    await submitGlobalRedeemForm(
      page,
      f.data?.answers as Record<string, string | boolean> | undefined,
    );
    await assertRedeemOutcomePanel(page, 'error');
    await assertWalletUnchanged(page, manifest, f.tenantId, beforeMain);
    await assertWalletUnchanged(
      page,
      manifest,
      suspendedTenantId,
      beforeSuspended,
    );
  });
});

test('[WEB-05] published form and terms block incomplete submission', async ({
  page,
}) => {
  const manifest = loadManifest();
  const f = fixtureFor(manifest, 'WEB-05');
  if (!f.code) throw new Error('BLOCKED: WEB-05 cần code');
  await login(page, manifest, accountFor(manifest, 'WEB-05', 'attendee'));
  await openCodeConfirmation(page, manifest, f.code);
  let posted = false;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/bff/redeem')
    )
      posted = true;
  });
  await page
    .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
    .click();
  await expect(page.locator('#terms-accepted')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(posted).toBe(false);
  await fillPublishedForm(
    page,
    f.data?.answers as Record<string, string | boolean> | undefined,
  );
  await expect(page.locator('#terms-accepted')).toBeChecked();
});

test('[WEB-06] manual source stays pending without a QR before approval', async ({
  page,
}) => {
  const manifest = loadManifest();
  await redeemCode(page, manifest, 'WEB-06');
  await expect(page.getByTestId('redeem-ux-pending')).toBeVisible();
  await expect(page.getByTestId('redeem-ticket-card')).toHaveCount(0);
});

test.describe('[WEB-07] idempotent redemption', () => {
  test('double submit issues one ticket for a fresh code', async ({ page }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-07');
    if (!f.code) throw new Error('BLOCKED: WEB-07 cần code');
    const codeId = codeIdFor(f);
    const dbBefore = await readRedemptionState(f, codeId);
    await login(page, manifest, accountFor(manifest, 'WEB-07', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await openCodeConfirmation(page, manifest, f.code);
    await fillPublishedForm(
      page,
      f.data?.answers as Record<string, string | boolean> | undefined,
    );
    const button = page.getByRole('button', {
      name: 'Đổi mã lấy vé',
      exact: true,
    });
    await button.dblclick();
    await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
    const after = await walletTicketIds(page, manifest, f.tenantId);
    expect(after.filter((id) => !before.includes(id))).toHaveLength(1);
    assertIssuedExactlyOnce(
      dbBefore,
      await readRedemptionState(f, codeId),
      f,
      accountFor(manifest, 'WEB-07', 'attendee').userId!,
      after.find((id) => !before.includes(id)),
    );
  });

  test('lost response after server commit reconciles to one ticket via poll', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-07');
    const lostResponseCode = caseData<string>(f, 'lostResponseCode');
    const codeId = codeIdFor(f, 'lostResponse');
    const dbBefore = await readRedemptionState(f, codeId);
    await login(page, manifest, accountFor(manifest, 'WEB-07', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await openCodeConfirmation(page, manifest, lostResponseCode);
    await fillPublishedForm(
      page,
      f.data?.answers as Record<string, string | boolean> | undefined,
    );
    // Let the real POST reach the server and commit, then drop the response —
    // the client must never know whether its own request issued the ticket.
    let committedTicketId = '';
    await page.route('**/api/bff/redeem', async (route) => {
      const upstream = await route.fetch();
      const body = (await upstream.json().catch(() => null)) as {
        ticketId?: string;
        state?: string;
      } | null;
      committedTicketId = body?.ticketId ?? '';
      await route.abort('failed');
    });
    await page
      .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
      .click();
    await expect(page.getByTestId('redeem-ux-success')).toBeVisible({
      timeout: 35_000,
    });
    await page.unroute('**/api/bff/redeem');
    // The server committed before the client ever saw a response — the proxied
    // upstream body is the commit evidence, independent of the UI's own poll.
    expect(committedTicketId).toMatch(/^[0-9a-f-]{36}$/i);
    const after = await walletTicketIds(page, manifest, f.tenantId);
    expect(after).toContain(committedTicketId);
    expect(after.filter((id) => !before.includes(id))).toHaveLength(1);
    assertIssuedExactlyOnce(
      dbBefore,
      await readRedemptionState(f, codeId),
      f,
      accountFor(manifest, 'WEB-07', 'attendee').userId!,
      committedTicketId,
    );
  });

  test('reload after success cannot replay a second ticket for the same code', async ({
    page,
  }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-07');
    const reloadCode = caseData<string>(f, 'reloadCode');
    const codeId = codeIdFor(f, 'reload');
    const dbBefore = await readRedemptionState(f, codeId);
    await login(page, manifest, accountFor(manifest, 'WEB-07', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    await openCodeConfirmation(page, manifest, reloadCode);
    await fillPublishedForm(
      page,
      f.data?.answers as Record<string, string | boolean> | undefined,
    );
    await page
      .getByRole('button', { name: 'Đổi mã lấy vé', exact: true })
      .click();
    await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
    const afterFirst = await walletTicketIds(page, manifest, f.tenantId);
    expect(afterFirst.filter((id) => !before.includes(id))).toHaveLength(1);
    const issued = await readRedemptionState(f, codeId);
    assertIssuedExactlyOnce(
      dbBefore,
      issued,
      f,
      accountFor(manifest, 'WEB-07', 'attendee').userId!,
      afterFirst.find((id) => !before.includes(id)),
    );

    // Reload drops the in-memory idempotency key — resubmitting the same
    // code now mints a fresh key with no record of the earlier success.
    await page.reload();
    await resolveGlobalCode(page, manifest, reloadCode);
    await submitGlobalRedeemForm(
      page,
      f.data?.answers as Record<string, string | boolean> | undefined,
    );
    await assertRedeemOutcomePanel(page, 'used');
    await assertWalletUnchanged(page, manifest, f.tenantId, afterFirst);
    assertNoExtraIssue(issued, await readRedemptionState(f, codeId));
  });

  test('same idempotency key with a changed payload is rejected without issuing a second ticket', async ({
    page,
  }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-07');
    const conflictCode = caseData<string>(f, 'conflictCode');
    const codeId = codeIdFor(f, 'conflict');
    const dbBefore = await readRedemptionState(f, codeId);
    const altAnswers = caseData<Record<string, string | boolean>>(
      f,
      'conflictAnswersAlt',
    );
    await login(page, manifest, accountFor(manifest, 'WEB-07', 'attendee'));
    const before = await walletTicketIds(page, manifest, f.tenantId);
    const idempotencyKey = randomUUID();
    const basePayload = {
      tenantId: f.tenantId,
      eventId: f.eventId,
      code: conflictCode,
      formVersion: 'form-v1',
      termsVersion: 'terms-v1',
      answers: f.data?.answers,
      termsAccepted: true,
      idempotencyKey,
    };

    const first = await postRedeemDirect(page, manifest, basePayload);
    expect(first.status).toBe(201);
    const ticketId = (first.json as { ticketId?: string }).ticketId;
    expect(ticketId).toMatch(/^[0-9a-f-]{36}$/i);

    const conflict = await postRedeemDirect(page, manifest, {
      ...basePayload,
      answers: altAnswers,
    });
    expect(conflict.status).toBe(409);
    // ISSUE_ERROR_CODES.IDEMPOTENCY_CONFLICT (@ticket/contracts) — not
    // resolvable from tests/e2e, which sits outside the pnpm workspace graph.
    expect((conflict.json as { code?: string }).code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );

    const after = await walletTicketIds(page, manifest, f.tenantId);
    expect(after).toContain(ticketId);
    expect(after.filter((id) => !before.includes(id))).toHaveLength(1);
    const issued = await readRedemptionState(f, codeId);
    assertIssuedExactlyOnce(
      dbBefore,
      issued,
      f,
      accountFor(manifest, 'WEB-07', 'attendee').userId!,
      ticketId,
    );
    expect(
      issued.operations.filter((row) => row.client_key === idempotencyKey),
    ).toHaveLength(1);
  });

  test('two concurrent requests for one code issue only one ticket', async ({
    page,
  }) => {
    const manifest = loadManifest();
    const f = fixtureFor(manifest, 'WEB-07');
    const raceCode = caseData<string>(f, 'raceCode');
    const codeId = codeIdFor(f, 'race');
    await login(page, manifest, accountFor(manifest, 'WEB-07', 'attendee'));
    const before = await readRedemptionState(f, codeId);
    const payload = {
      tenantId: f.tenantId,
      eventId: f.eventId,
      code: raceCode,
      formVersion: 'form-v1',
      termsVersion: 'terms-v1',
      answers: f.data?.answers,
      termsAccepted: true,
    };
    await page.request.get(webUrl(manifest, '/api/bff/csrf'));
    const cookies = await page.context().cookies(manifest.origins.web);
    const csrfToken = cookies.find(
      (cookie) => cookie.name === 'vemoki_csrf',
    )?.value;
    expect(csrfToken).toBeTruthy();
    const post = async () => {
      const response = await page.request.post(
        webUrl(manifest, '/api/bff/redeem'),
        {
          headers: {
            'content-type': 'application/json',
            origin: manifest.origins.web,
            'x-csrf-token': csrfToken!,
          },
          data: { ...payload, idempotencyKey: randomUUID() },
        },
      );
      return {
        status: response.status(),
        json: await response.json().catch(() => null),
      };
    };
    const [a, b] = await Promise.all([post(), post()]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const winner = a.status === 201 ? a : b;
    const loser = a.status === 409 ? a : b;
    expect((loser.json as { code?: string }).code).toBe('CODE_CONSUMED');
    const ticketId = (winner.json as { ticketId?: string }).ticketId;
    expect(ticketId).toMatch(/^[0-9a-f-]{36}$/i);
    assertIssuedExactlyOnce(
      before,
      await readRedemptionState(f, codeId),
      f,
      accountFor(manifest, 'WEB-07', 'attendee').userId!,
      ticketId,
    );
  });
});

test('[WEB-08] real worker delivers issued ticket email to run Mailpit', async ({
  page,
  browser,
}) => {
  test.setTimeout(75_000);
  const manifest = loadManifest();
  const f = await redeemCode(page, manifest, 'WEB-08');
  await expect(page.getByTestId('redeem-ux-success')).toBeVisible();
  const actor = accountFor(manifest, 'WEB-08', 'attendee');
  const mail = await waitForMail(
    page,
    manifest,
    actor.username,
    caseData<string>(f, 'eventName'),
  );
  const url = ticketLink(mail, manifest.origins.web);
  const ticketId = url.match(/\/tickets\/([0-9a-f-]{36})/i)?.[1];
  expect(ticketId).toBeTruthy();
  expect(mail.Text ?? '').toContain(ticketId!);
  expect(mail.HTML ?? '').toContain('cid:ticket-qr');
  const guest = await browser.newContext();
  try {
    const guestPage = await guest.newPage();
    await guestPage.goto(url);
    await expect(
      guestPage.getByTestId('owner-ticket-need-login'),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
  await page.goto(url);
  await expect(page.getByTestId('owner-ticket-qr-figure')).toBeVisible();
});
