import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

export type AdminAction =
  | 'save'
  | 'publish'
  | 'import'
  | 'quota'
  | 'approve'
  | 'deny';

export type AdminDecision =
  | { kind: 'saved'; version: number }
  | { kind: 'published'; version: number }
  | { kind: 'imported'; count: number }
  | { kind: 'quota'; capacity: number | null; allocated: number }
  | { kind: 'approved'; requestId: string; replayed: boolean }
  | { kind: 'denied'; requestId: string; replayed: boolean }
  | { kind: 'rejected'; code: string; message: string; requestId?: string }
  | { kind: 'unknown'; message: string };

export const ADMIN_UNKNOWN =
  t(DEFAULT_PORTAL_LOCALE, 'ops.decide.unknown');

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

export function decideAdmin(
  action: AdminAction,
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): AdminDecision {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.decide.unknown') };
  }
  const body = record(json);
  if (
    action === 'save' &&
    (status === 200 || status === 201) &&
    typeof body?.version === 'number'
  ) {
    return { kind: 'saved', version: body.version };
  }
  if (
    action === 'publish' &&
    (status === 200 || status === 201) &&
    body?.status === 'PUBLISHED' &&
    typeof body.publishedConfigVersion === 'number'
  ) {
    return { kind: 'published', version: body.publishedConfigVersion };
  }
  if (
    action === 'import' &&
    (status === 200 || status === 201) &&
    typeof body?.imported === 'number'
  ) {
    return { kind: 'imported', count: body.imported };
  }
  if (
    action === 'quota' &&
    status === 200 &&
    (body?.capacity === null || typeof body?.capacity === 'number') &&
    typeof body.allocated === 'number'
  ) {
    return {
      kind: 'quota',
      capacity: body.capacity as number | null,
      allocated: body.allocated,
    };
  }
  const approval = approvalDecision(action, status, body);
  if (approval) return approval;
  if (
    (action === 'approve' || action === 'deny') &&
    (body?.decision === 'approve' || body?.decision === 'deny')
  ) {
    return { kind: 'unknown', message: t(locale, 'ops.decide.unknown') };
  }
  if (body && typeof body.code === 'string' && !secretField(body, body.code)) {
    return {
      kind: 'rejected',
      code: body.code,
      message: rejectionMessage(body),
      ...(typeof body.requestId === 'string'
        ? { requestId: body.requestId }
        : {}),
    };
  }
  return { kind: 'unknown', message: t(locale, 'ops.decide.unknown') };
}

const SECRET_FIELDS = [
  'redemptionCode',
  'inviteCode',
  'plaintext',
  'rawCode',
  'codeValue',
] as const;

function secretField(body: Record<string, unknown>, value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  return SECRET_FIELDS.some((key) => body[key] === value);
}

function rejectionMessage(body: Record<string, unknown>): string {
  const fallback = typeof body.code === 'string' ? body.code : '';
  let message = typeof body.message === 'string' ? body.message : fallback;
  for (const key of SECRET_FIELDS) {
    const secret = body[key];
    if (typeof secret === 'string' && secret.length > 0) {
      message = message.split(secret).join('');
    }
  }
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function approvalDecision(
  action: AdminAction,
  status: number,
  body: Record<string, unknown> | null,
): AdminDecision | null {
  if (action !== 'approve' && action !== 'deny') return null;
  if (status !== 200 && status !== 201) return null;
  const expectedDecision = action === 'approve' ? 'approve' : 'deny';
  const expectedStatus = action === 'approve' ? 'ISSUED' : 'REJECTED';
  if (body?.decision !== expectedDecision || body.status !== expectedStatus) {
    return null;
  }
  if (typeof body.requestId !== 'string' || body.requestId.trim() === '') {
    return null;
  }
  const replayed = body.replayed === true;
  if (action === 'approve') {
    return { kind: 'approved', requestId: body.requestId, replayed };
  }
  return { kind: 'denied', requestId: body.requestId, replayed };
}

/** Page status text. Never echoes redemption-code fields from the API body. */
export function adminDecisionLabel(decision: AdminDecision, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  if (decision.kind === 'saved') {
    return t(locale, 'ops.decide.savedVersion', { version: decision.version });
  }
  if (decision.kind === 'published') {
    return t(locale, 'ops.decide.publishedVersion', { version: decision.version });
  }
  if (decision.kind === 'imported') {
    return t(locale, 'ops.decide.importedCount', { count: decision.count });
  }
  if (decision.kind === 'quota') {
    return t(locale, 'ops.decide.quotaSummary', { allocated: decision.allocated, capacity: decision.capacity ?? 'null' });
  }
  if (decision.kind === 'approved') {
    const replay = decision.replayed ? t(locale, 'ops.decide.replaySuffix') : '';
    return t(locale, 'ops.decide.approvedRequest', { requestId: decision.requestId, replaySuffix: replay });
  }
  if (decision.kind === 'denied') {
    const replay = decision.replayed ? t(locale, 'ops.decide.replaySuffix') : '';
    return t(locale, 'ops.decide.deniedRequest', { requestId: decision.requestId, replaySuffix: replay });
  }
  if (decision.kind === 'rejected') {
    const id = decision.requestId ? t(locale, 'ops.decide.requestIdSuffix', { requestId: decision.requestId }) : '';
    return t(locale, 'ops.decide.rejectedApi', { code: decision.code, message: decision.message, requestIdSuffix: id });
  }
  return decision.message;
}
