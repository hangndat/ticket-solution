import { router } from 'expo-router';
import { parkSignInReturn } from './sign-in-return-intent.ts';

let pendingImmediateSignIn = false;

/**
 * Context auth gate: park return path, open Account, start OIDC on Account mount.
 * OIDC still runs only in Account screen code — not a second login implementation.
 */
export function requestAttendeeAuthGate(returnPathname?: string): void {
  if (returnPathname) {
    parkSignInReturn({ pathname: returnPathname });
  }
  pendingImmediateSignIn = true;
  router.push('/account');
}

export function peekPendingImmediateSignIn(): boolean {
  return pendingImmediateSignIn;
}

export function consumePendingImmediateSignIn(): boolean {
  const next = pendingImmediateSignIn;
  pendingImmediateSignIn = false;
  return next;
}

export function clearPendingImmediateSignIn(): void {
  pendingImmediateSignIn = false;
}
