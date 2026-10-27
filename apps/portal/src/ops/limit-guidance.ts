import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';
import type { MessageKey } from '../i18n/messages';

export const TENANT_LIMIT_ERROR_CODES = [
  'TENANT_LIMIT_REACHED',
  'RATE_LIMITED',
  'RESEND_LIMIT',
  'PENDING_LIMIT',
  'ATTENDEE_LIMIT',
] as const;

export type TenantLimitErrorCode = (typeof TENANT_LIMIT_ERROR_CODES)[number];

export type LimitGuidanceAction =
  | 'events'
  | 'members'
  | 'pending'
  | 'cs'
  | 'quota'
  | 'retry';

export type LimitGuidance = {
  code: TenantLimitErrorCode;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  actionKey: MessageKey;
  action: LimitGuidanceAction;
  /** Never true for ticket list / check-in routes. */
  locksTicketOrCheckIn: false;
};

const TABLE: Record<TenantLimitErrorCode, Omit<LimitGuidance, 'code'>> = {
  TENANT_LIMIT_REACHED: {
    titleKey: 'limits.guidance.tenantReachedTitle',
    bodyKey: 'limits.guidance.tenantReachedBody',
    actionKey: 'limits.guidance.tenantReachedAction',
    action: 'events',
    locksTicketOrCheckIn: false,
  },
  RATE_LIMITED: {
    titleKey: 'limits.guidance.rateLimitedTitle',
    bodyKey: 'limits.guidance.rateLimitedBody',
    actionKey: 'limits.guidance.rateLimitedAction',
    action: 'retry',
    locksTicketOrCheckIn: false,
  },
  RESEND_LIMIT: {
    titleKey: 'limits.guidance.resendLimitTitle',
    bodyKey: 'limits.guidance.resendLimitBody',
    actionKey: 'limits.guidance.resendLimitAction',
    action: 'cs',
    locksTicketOrCheckIn: false,
  },
  PENDING_LIMIT: {
    titleKey: 'limits.guidance.pendingLimitTitle',
    bodyKey: 'limits.guidance.pendingLimitBody',
    actionKey: 'limits.guidance.pendingLimitAction',
    action: 'pending',
    locksTicketOrCheckIn: false,
  },
  ATTENDEE_LIMIT: {
    titleKey: 'limits.guidance.attendeeLimitTitle',
    bodyKey: 'limits.guidance.attendeeLimitBody',
    actionKey: 'limits.guidance.attendeeLimitAction',
    action: 'quota',
    locksTicketOrCheckIn: false,
  },
};

export function isTenantLimitErrorCode(
  code: string | null | undefined,
): code is TenantLimitErrorCode {
  return (
    typeof code === 'string' &&
    (TENANT_LIMIT_ERROR_CODES as readonly string[]).includes(code)
  );
}

export function limitGuidance(code: string | null | undefined): LimitGuidance | null {
  if (!isTenantLimitErrorCode(code)) return null;
  return { code, ...TABLE[code] };
}

export function limitGuidanceHref(
  guidance: LimitGuidance,
  scope: { tenantId: string; eventId?: string | null },
): string | null {
  switch (guidance.action) {
    case 'events':
      return `/t/${scope.tenantId}/events`;
    case 'members':
      return `/t/${scope.tenantId}/members`;
    case 'retry':
      return null;
    case 'pending':
      return scope.eventId
        ? `/t/${scope.tenantId}/e/${scope.eventId}/guests#pending`
        : `/t/${scope.tenantId}`;
    case 'cs':
      return scope.eventId
        ? `/t/${scope.tenantId}/e/${scope.eventId}/support#cs`
        : `/t/${scope.tenantId}`;
    case 'quota':
      return scope.eventId
        ? `/t/${scope.tenantId}/e/${scope.eventId}/quota`
        : `/t/${scope.tenantId}`;
  }
}

export function formatLimitGuidance(
  code: string | null | undefined,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): { title: string; body: string; action: string } | null {
  const guidance = limitGuidance(code);
  if (!guidance) return null;
  return {
    title: t(locale, guidance.titleKey),
    body: t(locale, guidance.bodyKey),
    action: t(locale, guidance.actionKey),
  };
}
