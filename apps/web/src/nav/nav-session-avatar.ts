export type NavSessionAvatar = {
  initials: string | null;
  displayHint: string | null;
};

function readEmailOrSubject(parsed: Record<string, unknown>): string | null {
  const raw =
    typeof parsed.email === 'string'
      ? parsed.email
      : typeof parsed.sub === 'string'
        ? parsed.sub
        : typeof parsed.subject === 'string'
          ? parsed.subject
          : null;
  if (!raw?.trim()) return null;
  return raw.trim();
}

export function initialsFromSessionBody(
  parsed: Record<string, unknown>,
): string | null {
  const raw = readEmailOrSubject(parsed);
  if (!raw) return null;
  if (raw.includes('@')) {
    const local = raw.split('@')[0] ?? raw;
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

export function navSessionAvatarFromJson(body: unknown): NavSessionAvatar | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  const parsed = body as Record<string, unknown>;
  const displayHint = readEmailOrSubject(parsed);
  const initials = initialsFromSessionBody(parsed);
  if (!displayHint && !initials) return null;
  return { initials, displayHint };
}

export function navSessionAvatarFromText(body: string): NavSessionAvatar | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return navSessionAvatarFromJson(parsed);
  } catch {
    return null;
  }
}
