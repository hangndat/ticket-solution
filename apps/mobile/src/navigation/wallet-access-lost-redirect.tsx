import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useWalletAccess } from '@/navigation/use-wallet-access';

/** After explicit logout (access was true, now false), leave wallet routes — tab is hidden. */
export function WalletAccessLostRedirect() {
  const { canAccess } = useWalletAccess();
  const router = useRouter();
  const segments = useSegments();
  const hadAccessRef = useRef(canAccess);

  useEffect(() => {
    const hadAccess = hadAccessRef.current;
    hadAccessRef.current = canAccess;
    if (hadAccess && !canAccess && segments.some((s) => s === 'my-tickets')) {
      router.replace('/(tabs)/(events)');
    }
  }, [canAccess, segments, router]);

  return null;
}
