import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import { session } from './session';
import { verifyViaMe } from './fetch-me';

/**
 * Bridges Clerk auth → SessionBoundary. Verified identity only after GET /v1/me.
 * Sign-out clears SecureStore credential + generation-guarded cache partitions.
 */
export function SessionBridge() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const syncGeneration = useRef(0);

  useEffect(() => {
    if (!isLoaded) return;
    const generation = ++syncGeneration.current;

    if (!isSignedIn) {
      void session.logout().catch(() => {
        /* Cache already invalidated; Keychain failure surfaces on next establish. */
      });
      return;
    }

    void (async () => {
      const token = await getToken();
      if (generation !== syncGeneration.current) return;
      if (!token) {
        await session.logout().catch(() => undefined);
        return;
      }
      await session.establish(token, verifyViaMe);
    })();
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}
