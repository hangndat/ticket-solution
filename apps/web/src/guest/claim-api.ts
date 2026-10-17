/**
 * Guest invitation claim BFF client helpers + decision mapping (C-I + C-F).
 */

import { IMPORT_ERROR_CODES } from '@ticket/contracts';
import {
  decideRedeemBody,
  type RedeemDecision,
} from '../redeem/decide';
import type { AdminScope } from '../admin/scope';

export function invitationClaimUpstreamPath(scope: AdminScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/invitations/claim`;
}

/**
 * Map claim HTTP body through redeem discriminator so pending ≠ ticket.
 * Adds invitation-specific codes for wrong-email / unverified / expired.
 */
export function decideClaimBody(
  status: number,
  json: unknown,
  idempotencyKey: string,
  networkError = false,
): RedeemDecision {
  const decision = decideRedeemBody(
    status,
    json,
    idempotencyKey,
    networkError,
  );
  if (decision.kind !== 'denied' && decision.kind !== 'expired') {
    return decision;
  }

  const code = decision.code;
  if (
    code === IMPORT_ERROR_CODES.INVITATION_EXPIRED ||
    code === IMPORT_ERROR_CODES.INVITATION_REVOKED ||
    code === IMPORT_ERROR_CODES.INVITATION_TOKEN_INVALID
  ) {
    return {
      kind: 'expired',
      code,
      message: decision.message,
    };
  }
  if (
    code === IMPORT_ERROR_CODES.INVITATION_EMAIL_MISMATCH ||
    code === IMPORT_ERROR_CODES.EMAIL_NOT_VERIFIED
  ) {
    return {
      kind: 'denied',
      code,
      message:
        code === IMPORT_ERROR_CODES.EMAIL_NOT_VERIFIED
          ? 'Email chưa verified — không cấp vé. Đăng nhập đúng tài khoản đã mời.'
          : 'Email không khớp lời mời — không cấp vé và không lộ email đích.',
    };
  }
  return decision;
}
