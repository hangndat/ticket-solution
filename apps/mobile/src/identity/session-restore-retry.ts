import { verifyViaMe } from './fetch-me.ts';
import type {
  RestoreOutcome,
  SessionBoundary,
  VerifyCredential,
} from './session-boundary.ts';

export type SessionRestoreRetryOutcome = RestoreOutcome | 'already-verified';

/**
 * Fail-closed re-probe of SecureStore credential via /v1/me.
 * Does not clear queue/offline gate data; never elevates without server verify.
 */
export async function tryRestoreVerifiedSession(
  boundary: SessionBoundary,
  verify: VerifyCredential = verifyViaMe,
): Promise<SessionRestoreRetryOutcome> {
  if (boundary.getSnapshot().status === 'verified') {
    return 'already-verified';
  }
  return boundary.restore(verify);
}
