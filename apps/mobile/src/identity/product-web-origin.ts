type TicketPublicExtra = {
  productOrigin?: string;
};

function readTicketPublicExtra(): TicketPublicExtra {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-constants') as {
      default?: { expoConfig?: { extra?: { ticketPublic?: TicketPublicExtra } } };
      expoConfig?: { extra?: { ticketPublic?: TicketPublicExtra } };
    };
    const Constants = mod.default ?? mod;
    return Constants.expoConfig?.extra?.ticketPublic ?? {};
  } catch {
    return {};
  }
}

/** O13 product web origin — `/invite`, `/redeem`, `/claim` live here (not marketing apex). */
export const DEFAULT_PRODUCT_WEB_ORIGIN = 'https://app.vemoki.com';

/**
 * Public product site for opening web-only flows (membership `/invite`).
 * Empty env → production default; never invent a tenant-specific host.
 */
export function getProductWebOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PRODUCT_ORIGIN?.trim() ?? '';
  const fromExtra = readTicketPublicExtra().productOrigin?.trim() ?? '';
  const raw = fromEnv || fromExtra || DEFAULT_PRODUCT_WEB_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_PRODUCT_WEB_ORIGIN;
  }
}
