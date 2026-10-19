import type {
  SanitizeResult,
  SavedViewSort,
  SavedViewSurface,
} from './types';

/** Filter keys allowed to persist per surface (ADR P2a / BA AC-B1). */
export const FILTER_ALLOWLIST: Record<
  SavedViewSurface,
  readonly string[]
> = {
  pending: ['sourceId', 'ticketTypeId', 'q'],
  notifications: ['state', 'channel'],
  exports: ['status'],
  /** UUID ticket/request lookup only — not free-text email. */
  cs: ['q'],
  /**
   * Codes: catalog ids + state only.
   * Do NOT persist raw `q` (exact hash lookup / secret-ish).
   */
  codes: ['state', 'sourceId', 'ticketTypeId'],
  audit: ['action', 'from', 'to'],
  members: ['role', 'status'],
};

export const SORT_ALLOWLIST: Record<SavedViewSurface, readonly string[]> = {
  pending: ['createdAt', 'requestId'],
  notifications: ['updatedAt', 'notificationId'],
  exports: ['createdAt', 'exportId'],
  cs: ['ticketId', 'state'],
  codes: ['codeId', 'state'],
  audit: ['at', 'action'],
  members: ['role', 'emailMasked'],
};

export const COLUMN_ALLOWLIST: Record<SavedViewSurface, readonly string[]> = {
  pending: ['requestId', 'sourceId', 'ticketTypeId', 'createdAt', 'actions'],
  notifications: [
    'notificationId',
    'channel',
    'providerStatus',
    'updatedAt',
    'actions',
  ],
  exports: ['exportId', 'status', 'createdAt', 'rowCount', 'actions'],
  cs: ['ticketId', 'state', 'ownerEmailMasked', 'open'],
  codes: ['codeId', 'state', 'sourceId', 'ticketTypeId'],
  audit: ['auditId', 'action', 'at'],
  members: ['emailMasked', 'role', 'status', 'events', 'actions'],
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeFilterValue(
  surface: SavedViewSurface,
  key: string,
  raw: string,
): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 128) return null;

  if (surface === 'pending' && (key === 'sourceId' || key === 'ticketTypeId')) {
    return UUID_RE.test(value) ? value : null;
  }
  if (surface === 'pending' && key === 'q') {
    return UUID_RE.test(value) ? value : null;
  }
  if (surface === 'cs' && key === 'q') {
    return UUID_RE.test(value) ? value : null;
  }
  if (surface === 'codes' && (key === 'sourceId' || key === 'ticketTypeId')) {
    return UUID_RE.test(value) ? value : null;
  }
  if (surface === 'codes' && key === 'state') {
    return ['AVAILABLE', 'HELD', 'CONSUMED'].includes(value) ? value : null;
  }
  if (surface === 'notifications' && key === 'state') {
    return ['PENDING', 'ACCEPTED', 'FAILED', 'DEAD', 'UNKNOWN'].includes(value)
      ? value
      : null;
  }
  if (surface === 'notifications' && key === 'channel') {
    return value === 'email' || value === 'push' ? value : null;
  }
  if (surface === 'exports' && key === 'status') {
    return ['PENDING', 'PROCESSING', 'READY', 'FAILED'].includes(value)
      ? value
      : null;
  }
  if (surface === 'members' && key === 'role') {
    return ['Owner', 'Manager', 'CS', 'Supervisor', 'Scanner'].includes(value)
      ? value
      : null;
  }
  if (surface === 'members' && key === 'status') {
    return value === 'ACTIVE' || value === 'REVOKED' ? value : null;
  }
  if (surface === 'audit' && key === 'action') {
    return /^[a-z0-9._-]{1,64}$/i.test(value) ? value : null;
  }
  if (surface === 'audit' && (key === 'from' || key === 'to')) {
    // Instant with timezone (Z or ±offset) — mirror audit panel hint.
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return null;
    return value.length <= 40 ? value : null;
  }
  return value;
}

export function sanitizeSavedViewPayload(
  surface: SavedViewSurface,
  input: {
    filters?: Record<string, unknown> | null;
    sort?: unknown;
    columns?: unknown;
  },
): SanitizeResult {
  const allowedFilters = new Set(FILTER_ALLOWLIST[surface]);
  const filters: Record<string, string> = {};
  let stale = false;

  const rawFilters = input.filters;
  if (rawFilters && typeof rawFilters === 'object' && !Array.isArray(rawFilters)) {
    for (const [key, value] of Object.entries(rawFilters)) {
      if (!allowedFilters.has(key)) {
        stale = true;
        continue;
      }
      if (typeof value !== 'string') {
        stale = true;
        continue;
      }
      const cleaned = sanitizeFilterValue(surface, key, value);
      if (cleaned === null) {
        if (value.trim()) stale = true;
        continue;
      }
      filters[key] = cleaned;
    }
  }

  let sort: SavedViewSort | null = null;
  if (input.sort && typeof input.sort === 'object' && !Array.isArray(input.sort)) {
    const field = (input.sort as { field?: unknown }).field;
    const order = (input.sort as { order?: unknown }).order;
    if (typeof field === 'string' && SORT_ALLOWLIST[surface].includes(field)) {
      if (order === 'ascend' || order === 'descend') {
        sort = { field, order };
      } else {
        stale = true;
      }
    } else if (field != null) {
      stale = true;
    }
  }

  const columns: string[] = [];
  const allowedCols = new Set(COLUMN_ALLOWLIST[surface]);
  if (Array.isArray(input.columns)) {
    for (const col of input.columns) {
      if (typeof col !== 'string') {
        stale = true;
        continue;
      }
      if (!allowedCols.has(col)) {
        stale = true;
        continue;
      }
      if (!columns.includes(col)) columns.push(col);
    }
  }

  return { filters, sort, columns, stale };
}
