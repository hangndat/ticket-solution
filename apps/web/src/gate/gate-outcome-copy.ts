/**
 * Pure UX presentation for web Gate fallback (PD §1.3 / §2.4 · AC-G4).
 * Web never queues CHECKIN_OFFLINE — that stays iOS-only (ADR-18).
 */

import type { GateDecision } from './decide';
import type { GateLinkState } from './connectivity';

export type OutcomeTone = 'admit' | 'deny' | 'unknown' | 'default';

export type GateOutcomeView = {
  kind: 'idle' | 'admitted' | 'already-checked-in' | 'denied' | 'unknown' | 'offline-blocked';
  title: string;
  detail: string;
  tone: OutcomeTone;
  /** Assertive live region for unknown / unclear outcomes. */
  assertive: boolean;
};

const ALREADY_MESSAGE = /đã (check-in|vào|có check-in)/i;

/**
 * Map GateDecision → large outcome canvas (PD §2.4 titles).
 * Never invent a queued/pending tone on web.
 */
export function presentGateDecision(
  decision: GateDecision | null,
): GateOutcomeView {
  if (!decision) {
    return {
      kind: 'idle',
      title: 'Chờ mã vé',
      detail:
        'Nhập ticket ID rồi giữ chỗ và xác nhận. Chỉ cho vào sau khi hệ thống ghi nhận.',
      tone: 'default',
      assertive: false,
    };
  }

  if (decision.kind === 'unknown') {
    return {
      kind: 'unknown',
      title: 'Chưa rõ — không cho vào',
      detail: decision.message,
      tone: 'unknown',
      assertive: true,
    };
  }

  if (decision.kind === 'deny') {
    if (decision.code === 'GATE_OFFLINE' || decision.code === 'GATE_DEGRADED') {
      return {
        kind: 'offline-blocked',
        title: 'Cổng web offline',
        detail: decision.message,
        tone: 'deny',
        assertive: true,
      };
    }
    return {
      kind: 'denied',
      title: 'Không cho vào',
      detail: decision.message,
      tone: 'deny',
      assertive: false,
    };
  }

  const already = ALREADY_MESSAGE.test(decision.message);
  if (already) {
    return {
      kind: 'already-checked-in',
      title: 'Đã check-in trước đó',
      detail: decision.message,
      tone: 'admit',
      assertive: false,
    };
  }

  return {
    kind: 'admitted',
    title: 'Cho vào',
    detail: decision.message,
    tone: 'admit',
    assertive: false,
  };
}

export function connectivityLabel(link: GateLinkState): string {
  if (link === 'online') return 'Trực tuyến';
  if (link === 'offline') return 'Web · offline';
  return 'Web · API suy giảm';
}

/** Short hex / UUID for context strip — never primary staff chrome. */
export function shortId(value: string | null | undefined, keep = 8): string {
  const v = value?.trim() ?? '';
  if (!v) return '—';
  if (v.length <= keep) return v;
  return `${v.slice(0, keep)}…`;
}
