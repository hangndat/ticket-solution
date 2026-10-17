import type { MembershipRole } from '@ticket/contracts';

/** Server allowlist — never accept arbitrary client permission arrays. */
export const ROLE_SCHEMA_VERSION = 1;

const OWNER: readonly string[] = [
  'tenant.profile',
  'members.manage',
  'event.create',
  'event.list',
];

const MANAGER_EVENT: readonly string[] = [
  'event.config',
  'event.publish',
  'inventory.import',
  'redemption.approve',
  'report.read',
  'export.create',
  'export.download',
];

const CS_EVENT: readonly string[] = ['cs.lookup', 'cs.resend'];

const SUPERVISOR_EVENT: readonly string[] = [
  'gate.confirm',
  'gate.undo',
  'ticket.revoke',
];

const SCANNER_EVENT: readonly string[] = ['gate.confirm'];

export function tenantPermissionsForRole(role: MembershipRole): string[] {
  switch (role) {
    case 'Owner':
      return [...OWNER];
    case 'Manager':
      return ['event.create'];
    case 'CS':
    case 'Supervisor':
    case 'Scanner':
      return [];
    default: {
      const _exhaustive: never = role;
      void _exhaustive;
      return [];
    }
  }
}

export function eventPermissionsForRole(role: MembershipRole): string[] {
  switch (role) {
    case 'Owner':
      // Owner still needs explicit assignment for ops on others' events.
      return [
        ...MANAGER_EVENT,
        ...CS_EVENT,
        ...SUPERVISOR_EVENT,
      ];
    case 'Manager':
      return [...MANAGER_EVENT];
    case 'CS':
      return [...CS_EVENT];
    case 'Supervisor':
      return [...SUPERVISOR_EVENT];
    case 'Scanner':
      return [...SCANNER_EVENT];
    default: {
      const _exhaustive: never = role;
      void _exhaustive;
      return [];
    }
  }
}

export function isMembershipRole(value: unknown): value is MembershipRole {
  return (
    value === 'Owner' ||
    value === 'Manager' ||
    value === 'CS' ||
    value === 'Supervisor' ||
    value === 'Scanner'
  );
}
