import type {
  EventBusinessStatus,
  EventContentStatus,
  EventVisibility,
  TenantStatus,
} from '@ticket/contracts';
import type { ImportKind } from '@ticket/contracts';
import type { PrepReadinessStatus } from '../prep/readiness';
import type { PortalLocale } from './locale';
import type { MessageKey } from './messages';
import { t } from './t';

function enumLabel(
  locale: PortalLocale,
  prefix: string,
  value: string,
): string {
  const key = `${prefix}.${value}` as MessageKey;
  const label = t(locale, key);
  if (label.startsWith('[VI]')) {
    return t(locale, 'common.mappedStatus', { status: value });
  }
  return label;
}

export function formatTenantStatus(
  locale: PortalLocale,
  status: TenantStatus | string,
): string {
  return enumLabel(locale, 'enum.tenantStatus', status);
}

export function formatTenantRole(
  locale: PortalLocale,
  role: string,
): string {
  return enumLabel(locale, 'enum.tenantRole', role);
}

export function formatEventContentStatus(
  locale: PortalLocale,
  status: EventContentStatus | string,
): string {
  return enumLabel(locale, 'enum.contentStatus', status);
}

export function formatEventBusinessStatus(
  locale: PortalLocale,
  status: EventBusinessStatus | string,
): string {
  return enumLabel(locale, 'enum.businessStatus', status);
}

export function formatEventVisibility(
  locale: PortalLocale,
  visibility: EventVisibility | string,
): string {
  return enumLabel(locale, 'enum.visibility', visibility);
}

export function formatImportKind(
  locale: PortalLocale,
  kind: ImportKind,
): string {
  return enumLabel(locale, 'enum.importKind', kind);
}

export function formatReadinessStatus(
  locale: PortalLocale,
  status: PrepReadinessStatus,
): string {
  return t(locale, `readiness.status.${status}` as MessageKey);
}

export function formatTicketStateCountLabel(
  locale: PortalLocale,
  state: string,
): string {
  return enumLabel(locale, 'enum.ticketState', state);
}
