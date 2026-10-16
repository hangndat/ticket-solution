/**
 * Pure env checks for Clerk / OIDC web POC.
 * No Clerk SDK imports — safe for unit tests and fail-closed UI.
 */

type ClerkEnvBag = Record<string, string | undefined>;

export function isClerkConfigured(env: ClerkEnvBag = process.env): boolean {
  const publishable = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  const secret = env.CLERK_SECRET_KEY?.trim() ?? '';
  return publishable.length > 0 && secret.length > 0;
}

export type WebAuthState =
  | { status: 'unconfigured'; authenticated: false }
  | { status: 'signed_out'; authenticated: false }
  | { status: 'signed_in'; authenticated: true; userId: string };

/**
 * Resolve display/auth state. Missing Clerk keys always yield unconfigured
 * (never authenticated), even if a userId is somehow present.
 */
export function resolveWebAuthState(input: {
  configured: boolean;
  userId: string | null | undefined;
}): WebAuthState {
  if (!input.configured) {
    return { status: 'unconfigured', authenticated: false };
  }
  if (!input.userId) {
    return { status: 'signed_out', authenticated: false };
  }
  return {
    status: 'signed_in',
    authenticated: true,
    userId: input.userId,
  };
}
