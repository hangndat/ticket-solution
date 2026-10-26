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

export type PrepReadinessStatus = 'ok' | 'missing' | 'unknown' | 'forbidden';
export type ReadinessSignal = boolean | 'unknown';

export type PrepReadinessItem = {
  key: PrepReadinessKey;
  label: string;
  status: PrepReadinessStatus;
  detail: string;
};

export type PrepReadinessInput = {
  hasEventContext: boolean;
  hasTicketType: ReadinessSignal;
  hasSource: ReadinessSignal;
  quotaKnown: boolean;
  quotaCapacity: number | null;
  hasTermsOrPublished: ReadinessSignal;
  hasBrand: ReadinessSignal;
  forbiddenKeys?: ReadonlyArray<PrepReadinessKey>;
};

function readinessStatus(
  key: PrepReadinessKey,
  signal: ReadinessSignal,
  forbiddenKeys: ReadonlyArray<PrepReadinessKey>,
): PrepReadinessStatus {
  if (forbiddenKeys.includes(key)) return 'forbidden';
  if (signal === 'unknown') return 'unknown';
  return signal ? 'ok' : 'missing';
}

function readinessDetail(
  key: PrepReadinessKey,
  status: PrepReadinessStatus,
  locale: PortalLocale,
): string {
  if (status === 'forbidden') return t(locale, 'readiness.forbidden');
  if (status === 'unknown') return t(locale, 'readiness.unknown');
  return t(locale, `readiness.${key}.${status}` as MessageKey);
}

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

  const forbiddenKeys = input.forbiddenKeys ?? [];

  let quotaStatus: PrepReadinessStatus = forbiddenKeys.includes('quota')
    ? 'forbidden'
    : 'unknown';
  let quotaDetail = t(locale, 'readiness.quota.unknown');
  if (quotaStatus === 'forbidden') {
    quotaDetail = t(locale, 'readiness.forbidden');
  } else if (input.quotaKnown) {
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
      status: readinessStatus('types', input.hasTicketType, forbiddenKeys),
      detail: readinessDetail(
        'types',
        readinessStatus('types', input.hasTicketType, forbiddenKeys),
        locale,
      ),
    },
    {
      key: 'sources',
      label: LABELS.sources,
      status: readinessStatus('sources', input.hasSource, forbiddenKeys),
      detail: readinessDetail(
        'sources',
        readinessStatus('sources', input.hasSource, forbiddenKeys),
        locale,
      ),
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
      status: readinessStatus('form', input.hasTermsOrPublished, forbiddenKeys),
      detail: readinessDetail(
        'form',
        readinessStatus('form', input.hasTermsOrPublished, forbiddenKeys),
        locale,
      ),
    },
    {
      key: 'brand',
      label: LABELS.brand,
      status: readinessStatus('brand', input.hasBrand, forbiddenKeys),
      detail: readinessDetail(
        'brand',
        readinessStatus('brand', input.hasBrand, forbiddenKeys),
        locale,
      ),
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
  const forbidden = items.filter((i) => i.status === 'forbidden');
  if (missing.length === 0 && unknown.length === 0 && forbidden.length === 0) {
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
  if (forbidden.length) {
    parts.push(t(locale, 'readiness.summary.forbidden', {
      items: forbidden.map((item) => item.label).join(', '),
    }));
  }
  return t(locale, 'readiness.summary.tail', { parts: parts.join(' · ') });
}
