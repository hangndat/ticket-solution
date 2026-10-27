import type { TenantLimitsDto } from '@ticket/contracts';

type TenantLimitsUsageReadDto = {
  tenantId: string;
  limits: TenantLimitsDto;
  usage: {
    events: number;
    staffActive: number;
    staffPendingInvites: number;
    emailToday: number;
  };
  asOf: string;
  emailUsageDate: string;
};
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function intOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return undefined;
  }
  return value;
}

function parseLimits(raw: unknown): TenantLimitsDto | null {
  const body = record(raw);
  if (!body) return null;
  const maxEvents = intOrNull(body.maxEvents);
  const maxStaff = intOrNull(body.maxStaff);
  const emailPerDay = intOrNull(body.emailPerDay);
  const importRowsPerJob = intOrNull(body.importRowsPerJob);
  if (
    maxEvents === undefined ||
    maxStaff === undefined ||
    emailPerDay === undefined ||
    importRowsPerJob === undefined
  ) {
    return null;
  }
  return { maxEvents, maxStaff, emailPerDay, importRowsPerJob };
}

function parseAsOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value;
}

export type TenantLimitsUsageView =
  | { kind: 'shown'; snapshot: TenantLimitsUsageReadDto }
  | { kind: 'unknown'; message: string }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'forbidden' };

export function interpretTenantLimitsUsage(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): TenantLimitsUsageView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'limits.usage.unknown') };
  }
  if (status === 401 || status === 403) {
    return { kind: 'forbidden' };
  }
  const body = record(json);
  if (status === 200) {
    if (!body) return { kind: 'unknown', message: t(locale, 'limits.usage.unknown') };
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : null;
    const limits = parseLimits(body.limits);
    const usage = record(body.usage);
    const asOf = parseAsOf(body.asOf);
    const emailUsageDate =
      typeof body.emailUsageDate === 'string' ? body.emailUsageDate : null;
    if (!tenantId || !limits || !usage || !asOf || !emailUsageDate) {
      return { kind: 'unknown', message: t(locale, 'limits.usage.unknown') };
    }
    const events = intOrNull(usage.events);
    const staffActive = intOrNull(usage.staffActive);
    const staffPendingInvites = intOrNull(usage.staffPendingInvites);
    const emailToday = intOrNull(usage.emailToday);
    if (
      events === undefined ||
      events === null ||
      staffActive === undefined ||
      staffActive === null ||
      staffPendingInvites === undefined ||
      staffPendingInvites === null ||
      emailToday === undefined ||
      emailToday === null
    ) {
      return { kind: 'unknown', message: t(locale, 'limits.usage.unknown') };
    }
    return {
      kind: 'shown',
      snapshot: {
        tenantId,
        limits,
        usage: { events, staffActive, staffPendingInvites, emailToday },
        asOf,
        emailUsageDate,
      },
    };
  }
  if (body && typeof body.code === 'string' && body.code.length > 0) {
    const message =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message
        : t(locale, 'limits.usage.unknown');
    return { kind: 'rejected', code: body.code, message };
  }
  return { kind: 'unknown', message: t(locale, 'limits.usage.unknown') };
}

/** null cap is "no configured cap", never a commercial unlimited promise. */
export function formatConfiguredCap(
  value: number | null,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): string {
  if (value === null) return t(locale, 'limits.usage.noConfiguredCap');
  return String(value);
}

export function displayedSnapshotAsOf(asOf: string): string {
  return asOf;
}
