import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultOnboardingProgress,
  firstRunCurrentStep,
  isPendingActivationStatus,
  isValidRegistrationSlug,
  normalizeRegistrationBody,
  parseRegistrationResponse,
  isStaffPortalTenant,
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

test('ticket-owner Attendee stays off the admin first-run', () => {
  const attendee: MeTenantItem = {
    tenantId: 'a1111111-1111-4111-8111-111111111111',
    slug: 'uat-device',
    name: 'UAT Device Tenant',
    status: 'ACTIVE',
    role: 'Attendee',
    tenantPermissions: [],
  };
  assert.equal(isStaffPortalTenant(attendee), false);
  const surface = resolveOnboardingSurface({
    tenants: [attendee],
    userId: 'attendee-user',
    eventCountForTenant: () => 1,
  });
  assert.equal(surface.kind, 'customer');
});

test('staff Owner is chosen when a ticket-owner row is also present', () => {
  const attendee: MeTenantItem = {
    tenantId: 'a1111111-1111-4111-8111-111111111111',
    slug: 'uat-device',
    name: 'UAT Device Tenant',
    status: 'ACTIVE',
    role: 'Attendee',
    tenantPermissions: [],
  };
  const owner: MeTenantItem = {
    tenantId: '22222222-2222-4222-8222-222222222222',
    slug: 'active',
    name: 'Active',
    status: 'ACTIVE',
    role: 'Owner',
    tenantPermissions: ['tenant.profile', 'event.create', 'members.manage'],
  };
  const surface = resolveOnboardingSurface({
    tenants: [attendee, owner],
    userId: 'staff-user',
    eventCountForTenant: () => 1,
  });
  assert.notEqual(surface.kind, 'customer');
  assert.notEqual(surface.kind, 'signup');
  if (surface.kind === 'customer' || surface.kind === 'signup') return;
  assert.equal(surface.tenant.role, 'Owner');
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
