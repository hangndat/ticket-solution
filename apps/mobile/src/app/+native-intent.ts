import { routeForInstalledAppLink } from '@/links/installed-app-link';

/**
 * Rewrite installed-app links onto existing screens.
 * Returning null keeps vemoki://oauth/callback (and legacy ticketsolution) on the auth session.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string | null {
  try {
    if (initial && path.trim().length === 0) return '/';
    return routeForInstalledAppLink(path);
  } catch {
    return '/';
  }
}
