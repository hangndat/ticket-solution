import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultOnboardingProgress,
  firstRunCurrentStep,
  isPendingActivationStatus,
  isValidRegistrationSlug,
  normalizeRegistrationBody,
  parseRegistrationResponse,
  pickPrimaryTenant,
  resolveOnboardingSurface,
  shouldShowFirstRun,
} from '../src/onboarding';
import type { MeTenantItem } from '@ticket/contracts';

test('slug allowlist matches BE kebab pattern', () => {
  assert.equal(isValidRegistrationSlug('acme-events'), true);
  assert.equal(isValidRegistrationSlug('a'), true);
  assert.equal(isValidRegistrationSlug('-bad'), false);
  assert.equal(isValidRegistrationSlug('Bad_Slug'), false);
  assert.equal(isValidRegistrationSlug(''), false);
});

test('normalizeRegistrationBody lowercases slug and trims', () => {
  const body = normalizeRegistrationBody({
    slug: 'Acme-Events',
    name: ' Acme ',
    defaultTimezone: 'Asia/Ho_Chi_Minh',
    contact: '  ',
  });
  assert.deepEqual(body, {
    slug: 'acme-events',
    name: 'Acme',
    defaultTimezone: 'Asia/Ho_Chi_Minh',
    contact: null,
  });
  assert.equal(normalizeRegistrationBody({ slug: 'x', name: '' }), null);
});

test('parseRegistrationResponse requires PENDING status', () => {
  assert.equal(
    parseRegistrationResponse(201, {
      registrationId: 'r1',
      tenantId: 't1',
      status: 'PENDING',
    })?.status,
    'PENDING',
  );
  assert.equal(
    parseRegistrationResponse(201, {
      registrationId: 'r1',
      tenantId: 't1',
      status: 'ACTIVE',
    }),
    null,
  );
  assert.equal(isPendingActivationStatus('PENDING'), true);
  assert.equal(isPendingActivationStatus('ACTIVE'), false);
});

test('PENDING policy wins — first-run only after ACTIVE', () => {
  const pending: MeTenantItem = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    slug: 'pending-org',
    name: 'Pending Org',
    status: 'PENDING',
    role: 'Owner',
    tenantPermissions: ['event.create', 'members.manage', 'tenant.profile'],
  };
  const surface = resolveOnboardingSurface({
    tenants: [pending],
    userId: null,
    eventCountForTenant: () => 0,
  });
  assert.equal(surface.kind, 'pending-activation');
  assert.equal(
    shouldShowFirstRun({
      tenantStatus: 'PENDING',
      progress: defaultOnboardingProgress(),
      hasEvent: false,
    }),
    false,
  );
});

test('first-run Steps advance org → team → event → ready', () => {
  assert.equal(
    firstRunCurrentStep({
      progress: defaultOnboardingProgress(),
      hasEvent: false,
    }),
    0,
  );
  assert.equal(
    firstRunCurrentStep({
      progress: { ...defaultOnboardingProgress(), orgDone: true },
      hasEvent: false,
    }),
    1,
  );
  assert.equal(
    firstRunCurrentStep({
      progress: {
        ...defaultOnboardingProgress(),
        orgDone: true,
        inviteDone: true,
      },
      hasEvent: false,
    }),
    2,
  );
  assert.equal(
    firstRunCurrentStep({
      progress: {
        ...defaultOnboardingProgress(),
        orgDone: true,
        inviteDone: true,
      },
      hasEvent: true,
    }),
    3,
  );
});

test('pickPrimaryTenant prefers PENDING over ACTIVE', () => {
  const items: MeTenantItem[] = [
    {
      tenantId: '22222222-2222-4222-8222-222222222222',
      slug: 'active',
      name: 'Active',
      status: 'ACTIVE',
      role: 'Owner',
      tenantPermissions: [],
    },
    {
      tenantId: '11111111-1111-4111-8111-111111111111',
      slug: 'pending',
      name: 'Pending',
      status: 'PENDING',
      role: 'Owner',
      tenantPermissions: [],
    },
  ];
  assert.equal(pickPrimaryTenant(items)?.status, 'PENDING');
});
