import type { MeResponse } from '@ticket/contracts';
import { accountCopy } from '../components/screen-state-copy.ts';
import type { MeProbeResult } from '../identity/fetch-me.ts';

export type AccountMeRefreshOutcome =
  | { kind: 'ok'; me: MeResponse }
  | { kind: 'error'; message: string };

/**
 * Maps GET /v1/me probe to Account refreshMe UI — never collapses 401 into "mất mạng".
 */
export function accountMeRefreshFromProbe(
  result: MeProbeResult,
  epochUserId: string,
): AccountMeRefreshOutcome {
  if (result.status === 'ok') {
    if (result.me.userId !== epochUserId) {
      return { kind: 'error', message: accountCopy.meProbe.wrongUser };
    }
    return { kind: 'ok', me: result.me };
  }
  if (result.status === 'unauthorized') {
    return { kind: 'error', message: accountCopy.meProbe.unauthorized };
  }
  if (result.status === 'unreachable') {
    return { kind: 'error', message: accountCopy.meProbe.unreachable };
  }
  return { kind: 'error', message: accountCopy.meProbe.invalid };
}
