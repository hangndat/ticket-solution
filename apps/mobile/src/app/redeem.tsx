import { useSyncExternalStore } from 'react';
import { Redirect } from 'expo-router';
import { session } from '@/identity/session';
import { RedeemScreen } from '@/screens/redeem';

/** Guest / anonymous → global auth gate; scoped redeem only after verified. */
export default function RedeemRoute() {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  if (identity.status !== 'verified') {
    return <Redirect href="/redeem-global" />;
  }
  return <RedeemScreen />;
}
