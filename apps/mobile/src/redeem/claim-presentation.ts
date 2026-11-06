import type { RedeemDecision } from './redeem-client.ts';

export type ClaimPhase =
  'invalid' | 'guest' | 'form' | 'pending' | 'issued' | 'failure';

/** UI-only state: a pending request is never represented as an issued ticket. */
export function claimPresentation(input: {
  hasInvite: boolean;
  verified: boolean;
  decision: RedeemDecision | null;
}): {
  phase: ClaimPhase;
  homeHref: '/(tabs)/(events)' | '/(tabs)/my-tickets';
  homeLabel: string;
} {
  const homeHref = input.verified ? '/(tabs)/my-tickets' : '/(tabs)/(events)';
  const homeLabel = input.verified ? 'Về Vé của tôi' : 'Về Sự kiện';
  if (
    input.decision?.kind === 'denied' &&
    [
      'INVITATION_NOT_FOUND',
      'INVITATION_EXPIRED',
      'INVITATION_REVOKED',
      'INVITATION_TOKEN_INVALID',
      'PENDING_EXPIRED',
    ].includes(input.decision.code)
  ) {
    return { phase: 'invalid', homeHref, homeLabel };
  }
  // The token is consumed after a final response. Keep the server result visible
  // even though there is no longer an active claim intent to resume.
  if (input.decision?.kind === 'pending')
    return { phase: 'pending', homeHref, homeLabel };
  if (input.decision?.kind === 'issued')
    return { phase: 'issued', homeHref, homeLabel };
  if (input.decision?.kind === 'denied')
    return { phase: 'failure', homeHref, homeLabel };
  if (!input.hasInvite) return { phase: 'invalid', homeHref, homeLabel };
  if (!input.verified) return { phase: 'guest', homeHref, homeLabel };
  return { phase: 'form', homeHref, homeLabel };
}
