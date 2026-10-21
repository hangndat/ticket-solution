/**
 * PD §2.1 / §2.2 attendee presentation — redeem + ví hierarchy (Issue #235).
 * Pure copy/mapping; does not change redeem protocol, QR payload, or cache semantics.
 */

import type { TicketSummary } from '@ticket/contracts';
import {
  eventDate,
  findDemoEventById,
} from '../data/demo-events.ts';
import type { RedeemDecision } from '../redeem/redeem-client.ts';

export type OutcomeTone = 'admit' | 'deny' | 'unknown' | 'default';

export type RedeemOutcomeView = {
  title: string;
  /** Primary user-facing detail (plain VI). */
  detail: string;
  /** Secondary selectable tech ids — never the only signal. */
  secondary?: string;
  tone: OutcomeTone;
  assertive: boolean;
};

export type TicketRowView = {
  /** Primary: event name (demo catalog) or plain «Sự kiện». */
  eventTitle: string;
  /** Ticket status in Vietnamese. */
  statusLabel: string;
  /** Accessibility summary. */
  accessibilityLabel: string;
  /** Selectable ticket id. */
  ticketId: string;
  /** Selectable credential version line (secondary). */
  credentialLine: string;
  /** Truncated event id when name unknown. */
  eventIdLine: string;
};

const AUTH_CODES = new Set(['UNAUTHENTICATED', 'EMAIL_NOT_VERIFIED']);

/**
 * Map ticket.state → short VI label for ví list / detail.
 */
export function ticketStateLabelVi(state: string): string {
  const normalized = state.trim().toUpperCase();
  switch (normalized) {
    case 'ACTIVE':
      return 'Chưa sử dụng';
    case 'USED':
      return 'Đã dùng';
    case 'REVOKED':
      return 'Đã thu hồi';
    case 'EXPIRED':
      return 'Hết hạn';
    case 'PENDING':
      return 'Đang chờ';
    default:
      return state.trim() || 'Không rõ';
  }
}

/**
 * Ví row hierarchy (PD §2.2): event + status primary; UUID / credentialVersion secondary.
 */
export function presentTicketRow(ticket: TicketSummary): TicketRowView {
  const demo = findDemoEventById(ticket.eventId);
  const eventTitle =
    ticket.eventName?.trim() || demo?.name?.trim() || 'Sự kiện';
  const statusLabel = ticketStateLabelVi(ticket.state);
  const shortEventId =
    ticket.eventId.length > 12
      ? `${ticket.eventId.slice(0, 8)}…`
      : ticket.eventId;
  return {
    eventTitle,
    statusLabel,
    accessibilityLabel: `${eventTitle} · ${statusLabel}`,
    ticketId: ticket.ticketId,
    credentialLine: `Phiên bản vé · ${ticket.credentialVersion}`,
    eventIdLine: demo ? `ID sự kiện · ${shortEventId}` : `Sự kiện · ${shortEventId}`,
  };
}

function deniedTitle(code: string): string {
  if (code === 'UNAUTHENTICATED') return 'Cần đăng nhập';
  if (code === 'EMAIL_NOT_VERIFIED') return 'Cần xác minh email';
  if (code === 'PENDING_EXPIRED') return 'Yêu cầu hết hạn';
  if (code === 'REJECTED') return 'Không cấp vé';
  return 'Không cấp vé';
}

function deniedDetail(code: string, message: string): string {
  if (code === 'UNAUTHENTICATED') {
    return 'Đăng nhập rồi quay lại đổi mã. Chưa có vé.';
  }
  if (code === 'EMAIL_NOT_VERIFIED') {
    return 'Xác minh email trên tài khoản rồi thử lại. Chưa có vé.';
  }
  const trimmed = message.trim();
  if (
    trimmed &&
    !/redeem was rejected/i.test(trimmed) &&
    !/keycloak|nest|bff|sessionboundary/i.test(trimmed)
  ) {
    return trimmed;
  }
  return 'Không đổi được mã. Thử lại hoặc chọn sự kiện khác.';
}

/**
 * Present redeem/claim decision with PD §2.1 titles — never show a fake ticket.
 */
export function presentRedeemDecision(
  decision: RedeemDecision | null,
  opts: { surface: 'redeem' | 'claim' } = { surface: 'redeem' },
): RedeemOutcomeView {
  if (!decision) {
    return {
      title: opts.surface === 'claim' ? 'Nhận vé mời' : 'Đổi mã lấy vé',
      detail:
        opts.surface === 'claim'
          ? 'Điền biểu mẫu và đồng ý điều khoản khi đã đăng nhập.'
          : 'Nhập mã, trả lời biểu mẫu và đồng ý điều khoản.',
      tone: 'default',
      assertive: false,
    };
  }

  if (decision.kind === 'issued') {
    return {
      title: decision.replayed ? 'Vé đã sẵn sàng' : 'Đã nhận vé',
      detail: 'Mở tab Vé của tôi để xem QR. Đây là vé của bạn.',
      secondary: `Mã vé · ${decision.ticketId}`,
      tone: 'admit',
      assertive: false,
    };
  }

  if (decision.kind === 'pending') {
    return {
      title: 'Chờ duyệt — chưa phải vé',
      detail:
        'Yêu cầu đang chờ nhân viên. Chưa có vé và chưa giữ chỗ. Kiểm tra lại sau.',
      secondary: decision.requestId
        ? `Mã yêu cầu · ${decision.requestId}`
        : undefined,
      tone: 'unknown',
      assertive: true,
    };
  }

  if (decision.kind === 'unknown') {
    return {
      title: 'Chưa rõ kết quả',
      detail:
        'Kiểm tra lại cùng lần thử. Chưa hiện vé — không giả định đã cấp.',
      secondary: `Lần thử · ${decision.idempotencyKey}`,
      tone: 'unknown',
      assertive: true,
    };
  }

  if (decision.kind === 'stale') {
    return {
      title: 'Biểu mẫu hoặc điều khoản đã đổi',
      detail: 'Tải lại biểu mẫu, đồng ý điều khoản mới, rồi gửi lại.',
      secondary: decision.code,
      tone: 'deny',
      assertive: false,
    };
  }

  // denied
  const authish = AUTH_CODES.has(decision.code);
  return {
    title: deniedTitle(decision.code),
    detail: deniedDetail(decision.code, decision.message),
    secondary: authish ? undefined : `Mã · ${decision.code}`,
    tone: 'deny',
    assertive: false,
  };
}

export const attendeeWalletCopy = {
  signedOutTitle: 'Vé của tôi',
  signedOutBody:
    'Đăng nhập cùng tài khoản với web để xem vé. Vé chỉ hiện sau khi phiên được xác minh.',
  offlineBannerTitle: 'Đang xem vé đã lưu — chưa kết nối',
  offlineBannerBody:
    'Chỉ hiển thị. Không đổi mã offline và không check-in cổng từ bộ đệm này.',
  verifiedCaption: 'Vé đã xác minh',
  detailOnlyDisplay:
    'Chỉ để xem trên máy. Máy chủ vẫn quyết định thu hồi hoặc đã dùng tại cổng.',
  /** AC-T1 — fixture / demo ticket must not suggest gate scan. */
  demoNotForGate: 'Không dùng vào cổng',
  revokedHint: 'Vé không còn hiệu lực — không quét cổng.',
  usedHint: 'Vé đã dùng — không quét cổng lại.',
  expiredHint: 'Vé hết hạn — không quét cổng.',
} as const;

/**
 * Gate-scan discouragement copy for ticket detail (AC-T1 / PD §1.4).
 */
/** Giờ và địa điểm khi có trong catalog demo hoặc dữ liệu sự kiện công khai. */
export function ticketScheduleVenueLines(ticket: TicketSummary): {
  when: string | null;
  where: string | null;
} {
  const demo = findDemoEventById(ticket.eventId);
  if (!demo) {
    return { when: null, where: null };
  }
  return {
    when: eventDate(demo),
    where: demo.location?.trim() || null,
  };
}

export function ticketGateHint(
  state: string,
  opts: { demo: boolean },
): string | null {
  if (opts.demo) return attendeeWalletCopy.demoNotForGate;
  const normalized = state.trim().toUpperCase();
  if (normalized === 'REVOKED') return attendeeWalletCopy.revokedHint;
  if (normalized === 'USED') return attendeeWalletCopy.usedHint;
  if (normalized === 'EXPIRED') return attendeeWalletCopy.expiredHint;
  return null;
}
