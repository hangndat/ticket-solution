import { router } from 'expo-router';
import { parkSignInReturn } from '@/navigation/sign-in-return-intent';

/** Navigate to Account — OIDC runs only there. Optional safe return path after success. */
export function goToAccountForSignIn(returnPathname?: string): void {
  if (returnPathname) {
    parkSignInReturn({ pathname: returnPathname });
  }
  router.push('/account');
}

/** Open account for session management (logout, profile) without login-return. */
export function goToAccount(): void {
  router.push('/account');
}
