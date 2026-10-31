/** Pure decision, unit-tested: pop when history exists, else replace to a home. */
export function resolveBackOrReplace(
  canGoBack: boolean,
  fallbackHref: string,
): { kind: 'back' } | { kind: 'replace'; href: string } {
  return canGoBack
    ? { kind: 'back' }
    : { kind: 'replace', href: fallbackHref };
}

