/** Fallback when modal stack has no back entry (should not happen from Account). */
export const PRIVACY_DISMISS_FALLBACK_PATH = '/(tabs)/account' as const;

export type PrivacyDismissAction =
  | { kind: 'back' }
  | { kind: 'replace'; pathname: typeof PRIVACY_DISMISS_FALLBACK_PATH };

export function resolvePrivacyDismissAction(
  canGoBack: boolean,
): PrivacyDismissAction {
  return canGoBack
    ? { kind: 'back' }
    : { kind: 'replace', pathname: PRIVACY_DISMISS_FALLBACK_PATH };
}
