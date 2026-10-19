import {
  formatQuotaRemaining,
  formatReportAsOf,
  type QuotaCapacityState,
  QUOTA_CAPACITY_STATES,
} from './report';

/** GET path — ReportController_portfolio (ADR P2-PORTFOLIO-REOPEN). */
export const PORTFOLIO_OPENAPI_PATH =
  '/v1/tenants/{tenantId}/reports/portfolio';

export function portfolioUpstreamPath(tenantId: string): string {
  return PORTFOLIO_OPENAPI_PATH.replaceAll(
    '{tenantId}',
    encodeURIComponent(tenantId),
  );
}

export type ShownPortfolioItem = {
  kind: 'shown';
  eventId: string;
  title: string;
  checkInSuccessCount: number;
  pendingApprovalCount: number;
  emailNeedsCsCount: number;
  quotaRemaining: number | null;
  quotaCapacityState: QuotaCapacityState;
  rejectByReason: Record<string, number>;
};

/** Row present in response but incomplete / unparseable — never invent 0. */
export type UnknownPortfolioItem = {
  kind: 'unknown';
  eventId: string | null;
  title: string | null;
  message: string;
};

export type PortfolioItemView = ShownPortfolioItem | UnknownPortfolioItem;

export type PortfolioView =
  | {
      kind: 'shown';
      asOf: string;
      items: PortfolioItemView[];
      nextCursor: string | null;
      limit: number;
      /** True when ≥1 item failed field parse (page Alert). */
      hasPartial: boolean;
    }
  | { kind: 'unknown'; message: string }
  | { kind: 'rejected'; code: string; message: string };

export const PORTFOLIO_UNKNOWN =
  'Chưa tải được phân tích tổ chức. Không hiện số check-in / pending / quota như thể chúng đang đúng.';

export const PORTFOLIO_PARTIAL_ALERT =
  'Một số sự kiện chưa tải được — không dùng số 0 giả.';

export const PORTFOLIO_ITEM_UNKNOWN = 'Không tải được';

export { formatQuotaRemaining, formatReportAsOf };

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function parseQuotaCapacityState(value: unknown): QuotaCapacityState | null {
  if (typeof value !== 'string') return null;
  return (QUOTA_CAPACITY_STATES as readonly string[]).includes(value)
    ? (value as QuotaCapacityState)
    : null;
}

function parseRejectByReason(
  value: unknown,
): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== 'string' || key.length === 0) return null;
    const n = finiteNumber(raw);
    if (n === null) return null;
    out[key] = n;
  }
  return out;
}

function parseAsOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value;
}

function parseUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t,
    )
  ) {
    return null;
  }
  return t;
}

function parseItem(raw: unknown): PortfolioItemView {
  const body = record(raw);
  if (!body) {
    return {
      kind: 'unknown',
      eventId: null,
      title: null,
      message: PORTFOLIO_ITEM_UNKNOWN,
    };
  }

  const eventId = parseUuid(body.eventId);
  const title =
    typeof body.title === 'string' && body.title.trim().length > 0
      ? body.title.trim()
      : null;

  const quotaCapacityState = parseQuotaCapacityState(body.quotaCapacityState);
  const pendingApprovalCount = finiteNumber(body.pendingApprovalCount);
  const checkInSuccessCount = finiteNumber(body.checkInSuccessCount);
  const emailNeedsCsCount = finiteNumber(body.emailNeedsCsCount);
  const rejectByReason = parseRejectByReason(body.rejectByReason);

  let quotaRemaining: number | null = null;
  let quotaOk = false;
  if (quotaCapacityState === 'FINITE') {
    const n = finiteNumber(body.quotaRemaining);
    if (n !== null) {
      quotaRemaining = n;
      quotaOk = true;
    }
  } else if (
    quotaCapacityState === 'UNLIMITED' ||
    quotaCapacityState === 'MISSING_BUCKET'
  ) {
    if (body.quotaRemaining === null) {
      quotaRemaining = null;
      quotaOk = true;
    }
  }

  if (
    eventId === null ||
    title === null ||
    quotaCapacityState === null ||
    !quotaOk ||
    pendingApprovalCount === null ||
    checkInSuccessCount === null ||
    emailNeedsCsCount === null ||
    rejectByReason === null
  ) {
    return {
      kind: 'unknown',
      eventId,
      title,
      message: PORTFOLIO_ITEM_UNKNOWN,
    };
  }

  return {
    kind: 'shown',
    eventId,
    title,
    checkInSuccessCount,
    pendingApprovalCount,
    emailNeedsCsCount,
    quotaRemaining,
    quotaCapacityState,
    rejectByReason,
  };
}

/**
 * Counts only for HTTP 200 with a complete portfolio envelope.
 * Missing assignment → absent from `items` (not unknown rows).
 * Bad row fields → `unknown` cell + page partial Alert — never fake 0.
 */
export function interpretPortfolio(
  status: number,
  json: unknown,
  networkError: boolean,
): PortfolioView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: PORTFOLIO_UNKNOWN };
  }

  const body = record(json);
  if (status === 200) {
    if (!body) {
      return { kind: 'unknown', message: PORTFOLIO_UNKNOWN };
    }
    const asOf = parseAsOf(body.asOf);
    if (asOf === null || !Array.isArray(body.items)) {
      return { kind: 'unknown', message: PORTFOLIO_UNKNOWN };
    }
    const limit = finiteNumber(body.limit);
    if (limit === null) {
      return { kind: 'unknown', message: PORTFOLIO_UNKNOWN };
    }
    const nextCursor =
      body.nextCursor === null
        ? null
        : typeof body.nextCursor === 'string'
          ? body.nextCursor
          : null;
    if (body.nextCursor !== null && typeof body.nextCursor !== 'string') {
      return { kind: 'unknown', message: PORTFOLIO_UNKNOWN };
    }

    const items = body.items.map(parseItem);
    return {
      kind: 'shown',
      asOf,
      items,
      nextCursor,
      limit,
      hasPartial: items.some((i) => i.kind === 'unknown'),
    };
  }

  if (body && typeof body.code === 'string' && body.code.length > 0) {
    const message =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message
        : body.code;
    return { kind: 'rejected', code: body.code, message };
  }

  return { kind: 'unknown', message: PORTFOLIO_UNKNOWN };
}

export function portfolioEventHref(
  tenantId: string,
  eventId: string,
): string {
  return `/t/${tenantId}/e/${eventId}`;
}

export function formatPortfolioMetric(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return String(value);
}
