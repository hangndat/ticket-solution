/**
 * P2-ROLES-PRESET helpers — named server presets only (no client permission composer).
 * AC-PS4 / ADR §7: invite role = MembershipRole | { presetId }; never permission arrays.
 */
import type {
  InviteRoleRef,
  MembershipRole,
  RolePresetDto,
} from '@ticket/contracts';

export const SYSTEM_MEMBERSHIP_ROLES: MembershipRole[] = [
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
];

const SYSTEM_ROLE_SET = new Set<string>(SYSTEM_MEMBERSHIP_ROLES);

const PRESET_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSystemMembershipRole(value: string): value is MembershipRole {
  return SYSTEM_ROLE_SET.has(value);
}

export function isRolePresetId(value: string): boolean {
  return PRESET_ID_RE.test(value.trim());
}

/** Select value: built-in name or `preset:<uuid>`. */
export function roleSelectValue(role: InviteRoleRef): string {
  return typeof role === 'string' ? role : `preset:${role.presetId}`;
}

export function parseRoleSelectValue(raw: string): InviteRoleRef | null {
  const value: string = raw.trim();
  if (!value) return null;
  if (isSystemMembershipRole(value)) {
    return value;
  }
  const presetPrefix = 'preset:';
  if (value.length > presetPrefix.length && value.startsWith(presetPrefix)) {
    const presetId = value.slice(presetPrefix.length).trim();
    if (!isRolePresetId(presetId)) return null;
    return { presetId };
  }
  // Raw UUID from member/invite row that already stores preset id.
  if (isRolePresetId(value)) return { presetId: value };
  return null;
}

/** Invite/PATCH body role field — reject forged permission arrays. */
export function inviteRoleFromUnknown(raw: unknown): InviteRoleRef | null {
  if (typeof raw === 'string') {
    return isSystemMembershipRole(raw) ? raw : null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if ('permissions' in obj || 'tenantPermissions' in obj || 'eventPermissions' in obj) {
    return null;
  }
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== 'presetId') return null;
  const presetId = obj.presetId;
  if (typeof presetId !== 'string' || !isRolePresetId(presetId)) return null;
  return { presetId };
}

export function roleLabel(
  roleKey: string,
  presets: ReadonlyArray<Pick<RolePresetDto, 'presetId' | 'name'>>,
): string {
  const key: string = roleKey;
  if (isSystemMembershipRole(key)) return key;
  const hit = presets.find((p) => p.presetId === key);
  return hit?.name ?? key.slice(0, 8);
}

export type RoleCatalogRow = {
  key: string;
  name: string;
  kind: 'system' | 'preset';
  memberCount: number;
  schemaVersion: number | null;
  updatedAt: string | null;
  /** Read-only server permissions — display only, never editable checkboxes. */
  tenantPermissions: string[];
  eventPermissions: string[];
};

export function buildRoleCatalogRows(
  presets: ReadonlyArray<RolePresetDto>,
  memberRoles: ReadonlyArray<string>,
): RoleCatalogRow[] {
  const counts = new Map<string, number>();
  for (const role of memberRoles) {
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  const systemRows: RoleCatalogRow[] = SYSTEM_MEMBERSHIP_ROLES.map((name) => ({
    key: name,
    name,
    kind: 'system',
    memberCount: counts.get(name) ?? 0,
    schemaVersion: null,
    updatedAt: null,
    tenantPermissions: [],
    eventPermissions: [],
  }));

  const presetRows: RoleCatalogRow[] = presets.map((p) => ({
    key: p.presetId,
    name: p.name,
    kind: 'preset',
    memberCount: counts.get(p.presetId) ?? 0,
    schemaVersion: p.schemaVersion,
    updatedAt: p.createdAt,
    tenantPermissions: p.tenantPermissions ?? [],
    eventPermissions: p.eventPermissions ?? [],
  }));

  return [...systemRows, ...presetRows];
}

export function asRolePresetItems(json: unknown): RolePresetDto[] {
  if (!json || typeof json !== 'object') return [];
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: RolePresetDto[] = [];
  for (const row of items) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.presetId !== 'string' || typeof r.name !== 'string') continue;
    if (typeof r.schemaVersion !== 'number' || typeof r.createdAt !== 'string') {
      continue;
    }
    out.push({
      presetId: r.presetId,
      tenantId: typeof r.tenantId === 'string' ? r.tenantId : null,
      name: r.name,
      schemaVersion: r.schemaVersion,
      tenantPermissions: Array.isArray(r.tenantPermissions)
        ? r.tenantPermissions.filter((x): x is string => typeof x === 'string')
        : [],
      eventPermissions: Array.isArray(r.eventPermissions)
        ? r.eventPermissions.filter((x): x is string => typeof x === 'string')
        : [],
      createdAt: r.createdAt,
    });
  }
  return out;
}

export function rolePresetsUpstreamPath(tenantId: string): string {
  return `/v1/tenants/${encodeURIComponent(tenantId)}/role-presets`;
}
