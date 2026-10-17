/** Normalize optional remote URL into Image source, or null. */
export function remoteImageSource(
  url: string | null | undefined,
): { uri: string } | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return { uri: trimmed };
}
