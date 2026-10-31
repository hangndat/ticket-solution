import { type Href, router } from 'expo-router';
import { ATTENDEE_ACCOUNT_HREF } from '@/navigation/attendee-account-route';
import { parkSignInReturn } from '@/navigation/sign-in-return-intent';

/** Navigate to Account — OIDC runs only there. Optional safe return path after success. */
export function goToAccountForSignIn(returnPathname?: string): void {
  if (returnPathname) {
    parkSignInReturn({ pathname: returnPathname });
  }
  router.push(ATTENDEE_ACCOUNT_HREF as Href);
}

/** Open account for session management (logout, profile) without login-return. */
export function goToAccount(): void {
  router.push(ATTENDEE_ACCOUNT_HREF as Href);
}
