/** Stable D9 MFest · Demo scope — local sim-uat / docs only (not runtime SoT). */
export const MFEST_DEMO_GATE_SCOPE = {
  tenantId: 'd9d9f001-0001-4000-8000-000000000001',
  eventId: 'd9d9f001-0002-4000-8000-000000000001',
} as const;

/** Local `.env` placeholders from gate unit tests — must not ship on prod staff gate. */
export const LOCAL_DEV_PLACEHOLDER_GATE_SCOPE = {
  tenantId: 'a1111111-1111-4111-8111-111111111111',
  eventId: 'b2222222-2222-4222-8222-222222222222',
} as const;

export function isLocalDevPlaceholderGateScope(
  tenantId: string | null,
  eventId: string | null,
): boolean {
  if (!tenantId || !eventId) return false;
  return (
    tenantId === LOCAL_DEV_PLACEHOLDER_GATE_SCOPE.tenantId &&
    eventId === LOCAL_DEV_PLACEHOLDER_GATE_SCOPE.eventId
  );
}

