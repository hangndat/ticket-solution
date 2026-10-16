/** Clerk publishable key from Expo public env. Empty → fail closed (no verified user). */
export function getClerkPublishableKey(): string | null {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  return key.length > 0 ? key : null;
}

/** Nest API base URL for GET /v1/me (no trailing slash). */
export function getApiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

export function isClerkConfigured(): boolean {
  return getClerkPublishableKey() !== null;
}
