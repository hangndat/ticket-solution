import type {
  MeEventItem,
  MeEventsResponse,
  MeTenantItem,
  MeTenantsResponse,
  PlatformMeResponse,
} from '@ticket/contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) return null;
    out.push(item);
  }
  return out;
}

function parseMeEventItem(value: unknown): MeEventItem | null {
  if (!isRecord(value)) return null;
  const permissions = parsePermissions(value.permissions);
  if (
    typeof value.tenantId !== 'string' ||
    value.tenantId.trim().length === 0 ||
    typeof value.eventId !== 'string' ||
    value.eventId.trim().length === 0 ||
    typeof value.name !== 'string' ||
    permissions === null
  ) {
    return null;
  }
  return {
    tenantId: value.tenantId,
    eventId: value.eventId,
    name: value.name,
    permissions,
  };
}

export function parseMeEventsResponse(
  status: number,
  body: unknown,
): MeEventsResponse | null {
  if (status !== 200 || !isRecord(body)) return null;
  if (typeof body.staffEligible !== 'boolean') return null;
  if (!Array.isArray(body.items)) return null;
  const items: MeEventItem[] = [];
  for (const raw of body.items) {
    const item = parseMeEventItem(raw);
    if (!item) return null;
    items.push(item);
  }
  return { staffEligible: body.staffEligible, items };
}

function parseMeTenantItem(value: unknown): MeTenantItem | null {
  if (!isRecord(value)) return null;
  const tenantPermissions = parsePermissions(value.tenantPermissions);
  if (
    typeof value.tenantId !== 'string' ||
    typeof value.slug !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.role !== 'string' ||
    tenantPermissions === null
  ) {
    return null;
  }
  return {
    tenantId: value.tenantId,
    slug: value.slug,
    name: value.name,
    status: value.status as MeTenantItem['status'],
    role: value.role as MeTenantItem['role'],
    tenantPermissions,
  };
}

export function parseMeTenantsResponse(
  status: number,
  body: unknown,
): MeTenantsResponse | null {
  if (status !== 200 || !isRecord(body) || !Array.isArray(body.items)) {
    return null;
  }
  const items: MeTenantItem[] = [];
  for (const raw of body.items) {
    const item = parseMeTenantItem(raw);
    if (!item) return null;
    items.push(item);
  }
  return { items };
}

export function parsePlatformMeResponse(
  status: number,
  body: unknown,
): PlatformMeResponse | null {
  if (status !== 200 || !isRecord(body)) return null;
  if (typeof body.operator !== 'boolean') return null;
  if (!Array.isArray(body.permittedCommands)) return null;
  if (body.assurance !== 'mfa' && body.assurance !== 'missing') return null;
  const permittedCommands: string[] = [];
  for (const item of body.permittedCommands) {
    if (typeof item !== 'string') return null;
    permittedCommands.push(item);
  }
  return {
    operator: body.operator,
    permittedCommands,
    assurance: body.assurance,
  };
}
