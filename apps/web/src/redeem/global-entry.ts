export function isGlobalRedeemEntryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE === '1';
}

export type RedeemQueryScope = {
  tenantId?: string;
  eventId?: string;
  tenantSlug?: string;
  eventSlug?: string;
};

/** True when URL pins tenant/event — use legacy tenant-bound redeem UI. */
export function isTenantBoundRedeemQuery(scope: RedeemQueryScope): boolean {
  return Boolean(
    scope.tenantId?.trim() ||
      scope.eventId?.trim() ||
      scope.tenantSlug?.trim() ||
      scope.eventSlug?.trim(),
  );
}

export function useGlobalRedeemEntry(scope: RedeemQueryScope): boolean {
  return isGlobalRedeemEntryEnabled() && !isTenantBoundRedeemQuery(scope);
}
