import type { MembershipRole } from '@ticket/contracts';

/** Server allowlist — never accept arbitrary client permission arrays. */
export const ROLE_SCHEMA_VERSION = 2;

const OWNER: readonly string[] = [
  'tenant.profile',
  'members.manage',
  'event.create',
  'event.list',
];

const MANAGER_EVENT: readonly string[] = [
  'event.update',
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

/** Full catalog of grantable permissions (AC-D2 — no invent). */
export const PERMISSION_CATALOG: readonly string[] = Object.freeze([
  ...OWNER,
  ...MANAGER_EVENT,
  ...CS_EVENT,
  ...SUPERVISOR_EVENT,
  // SCANNER_EVENT ⊂ SUPERVISOR_EVENT
]);

const PERMISSION_SET = new Set<string>(PERMISSION_CATALOG);

export function isCatalogPermission(value: string): boolean {
  return PERMISSION_SET.has(value);
}

/** Reject unknown / invented permissions (AC-D2). */
export function assertCatalogPermissions(perms: readonly string[]): void {
  for (const p of perms) {
    if (!isCatalogPermission(p)) {
      throw new Error(`unknown_permission:${p}`);
    }
  }
}

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

export function samePermissionSet(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort().join('\0');
  const right = [...b].sort().join('\0');
  return left === right;
}

export function eventPermissionsForRole(role: MembershipRole): string[] {
  switch (role) {
    case 'Owner':
      // Owner still needs explicit assignment for ops on others' events.
      return [...MANAGER_EVENT, ...CS_EVENT, ...SUPERVISOR_EVENT];
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPresetId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Invite role: built-in enum or `{ presetId }` (ADR §7.3). */
export type InviteRoleRef = MembershipRole | { presetId: string };

export function parseInviteRole(value: unknown): InviteRoleRef | null {
  if (isMembershipRole(value)) return value;
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'presetId' in value &&
    isPresetId((value as { presetId: unknown }).presetId)
  ) {
    const keys = Object.keys(value as object);
    if (keys.length !== 1 || keys[0] !== 'presetId') return null;
    return { presetId: (value as { presetId: string }).presetId };
  }
  return null;
}

/** Stored memberships.role / invites.role value after resolution. */
export function inviteRoleStorageKey(role: InviteRoleRef): string {
  return typeof role === 'string' ? role : role.presetId;
}

export function isMembershipRoleOrPresetId(value: unknown): value is string {
  return isMembershipRole(value) || isPresetId(value);
}
