/**
 * Client-side publish readiness from known portal UI state.
 * Unknown stays unknown — never fake OK. Publish ≠ redeem ≠ Gate.
 */

import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';
import type { MessageKey } from '../i18n/messages';
import { t } from '../i18n/t';

export type PrepReadinessKey =
  | 'types'
  | 'sources'
  | 'quota'
  | 'form'
  | 'brand';

export type PrepReadinessStatus = 'ok' | 'missing' | 'unknown';

export type PrepReadinessItem = {
  key: PrepReadinessKey;
  label: string;
  status: PrepReadinessStatus;
  detail: string;
};

export type PrepReadinessInput = {
  hasEventContext: boolean;
  hasTicketType: boolean;
  hasSource: boolean;
  quotaKnown: boolean;
  quotaCapacity: number | null;
  hasTermsOrPublished: boolean;
  hasBrand: boolean;
};

const LABEL_KEYS: Record<PrepReadinessKey, MessageKey> = {
  types: 'nav.event.types',
  sources: 'nav.event.sources',
  quota: 'nav.event.quota',
  form: 'readiness.label.form',
  brand: 'readiness.label.brand',
};

export function derivePrepReadiness(
  input: PrepReadinessInput,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): PrepReadinessItem[] {
  const LABELS = Object.fromEntries(
    (Object.keys(LABEL_KEYS) as PrepReadinessKey[]).map((k) => [
      k,
      t(locale, LABEL_KEYS[k]),
    ]),
  ) as Record<PrepReadinessKey, string>;
  if (!input.hasEventContext) {
    return (Object.keys(LABELS) as PrepReadinessKey[]).map((key) => ({
      key,
      label: LABELS[key],
      status: 'unknown' as const,
      detail: t(locale, 'readiness.noEvent'),
    }));
  }

  let quotaStatus: PrepReadinessStatus = 'unknown';
  let quotaDetail = t(locale, 'readiness.quota.unknown');
  if (input.quotaKnown) {
    quotaStatus = 'ok';
    quotaDetail =
      input.quotaCapacity === null
        ? t(locale, 'readiness.quota.unlimited')
        : t(locale, 'readiness.quota.configured', {
            capacity: input.quotaCapacity,
          });
  }

  return [
    {
      key: 'types',
      label: LABELS.types,
      status: input.hasTicketType ? 'ok' : 'missing',
      detail: input.hasTicketType
        ? t(locale, 'readiness.types.ok')
        : t(locale, 'readiness.types.missing'),
    },
    {
      key: 'sources',
      label: LABELS.sources,
      status: input.hasSource ? 'ok' : 'missing',
      detail: input.hasSource
        ? t(locale, 'readiness.sources.ok')
        : t(locale, 'readiness.sources.missing'),
    },
    {
      key: 'quota',
      label: LABELS.quota,
      status: quotaStatus,
      detail: quotaDetail,
    },
    {
      key: 'form',
      label: LABELS.form,
      status: input.hasTermsOrPublished ? 'ok' : 'missing',
      detail: input.hasTermsOrPublished
        ? t(locale, 'readiness.form.ok')
        : t(locale, 'readiness.form.missing'),
    },
    {
      key: 'brand',
      label: LABELS.brand,
      status: input.hasBrand ? 'ok' : 'missing',
      detail: input.hasBrand
        ? t(locale, 'readiness.brand.ok')
        : t(locale, 'readiness.brand.missing'),
    },
  ];
}

export function readinessAllOk(items: PrepReadinessItem[]): boolean {
  return items.every((i) => i.status === 'ok');
}

export function readinessSummary(
  items: PrepReadinessItem[],
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): string {
  const missing = items.filter((i) => i.status === 'missing');
  const unknown = items.filter((i) => i.status === 'unknown');
  if (missing.length === 0 && unknown.length === 0) {
    return t(locale, 'readiness.summary.allReady');
  }
  const parts: string[] = [];
  if (missing.length) {
    parts.push(
      t(locale, 'readiness.summary.missing', {
        items: missing.map((m) => m.label).join(', '),
      }),
    );
  }
  if (unknown.length) {
    parts.push(
      t(locale, 'readiness.summary.unknown', {
        items: unknown.map((u) => u.label).join(', '),
      }),
    );
  }
  return t(locale, 'readiness.summary.tail', { parts: parts.join(' · ') });
}
