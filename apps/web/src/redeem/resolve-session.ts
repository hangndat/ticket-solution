const SESSION_KEY = 'vemoki.redeem.globalResolveToken';

/** Persist resolve token for the global flow (never in URL). */
export function readStoredResolveToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(SESSION_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writeStoredResolveToken(token: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, token.trim());
  } catch {
    // Quota / private mode — caller still holds token in React state.
  }
}

export function clearStoredResolveToken(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
