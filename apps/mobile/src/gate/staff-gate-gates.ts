import { isMembershipAuthzDenial } from '../identity/staff-eligibility.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O31: a gate (cổng) of an event, as returned by GET /v1/gate/events/{id}/gates. */
export type StaffGate = { id: string; name: string; sortOrder: number };

export type GatesLoadState = {
  /** `${userId}:${tenantId}:${eventId}` the list belongs to. */
  key: string;
  status: 'ready' | 'error' | 'loading';
  gates: StaffGate[];
};

export function gatesStateKey(
  userId: string,
  scope: { tenantId: string; eventId: string },
): string {
  return `${userId}:${scope.tenantId}:${scope.eventId}`;
}

export function parseGateList(json: unknown): StaffGate[] | null {
  if (!json || typeof json !== 'object') return null;
  const list = (json as Record<string, unknown>).gates;
  if (!Array.isArray(list)) return null;
  const out: StaffGate[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || !UUID.test(r.id)) return null;
    if (typeof r.name !== 'string' || !r.name.trim()) return null;
    out.push({
      id: r.id.toLowerCase(),
      name: r.name.trim(),
      sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
    });
  }
  return out;
}

export async function fetchEventGates(input: {
  bearer: string;
  apiBase: string;
  tenantId: string;
  eventId: string;
  fetchImpl?: typeof fetch;
}): Promise<
  { kind: 'ok'; gates: StaffGate[] } | { kind: 'auth' } | { kind: 'error' }
> {
  try {
    const url = `${input.apiBase.replace(/\/$/, '')}/v1/gate/events/${input.eventId}/gates?tenantId=${encodeURIComponent(input.tenantId)}`;
    const response = await (input.fetchImpl ?? fetch)(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.bearer}`,
      },
    });
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    if (response.status === 401 || response.status === 403) {
      return isMembershipAuthzDenial(response.status, json)
        ? { kind: 'auth' }
        : { kind: 'error' };
    }
    if (response.status !== 200) return { kind: 'error' };
    const gates = parseGateList(json);
    return gates ? { kind: 'ok', gates } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}

/** Selected gate: explicit choice if still listed, else the only gate, else none. */
export function effectiveSelectedGate(
  gates: readonly StaffGate[],
  selectedId: string | null,
): StaffGate | null {
  const picked = selectedId ? gates.find((g) => g.id === selectedId) : undefined;
  if (picked) return picked;
  return gates.length === 1 ? gates[0]! : null;
}

export type OpenSessionUi = {
  /** Explicit «Mở phiên cổng» is offered (also for events without gates). */
  explicitOpen: boolean;
  /** Show the gate picker (only when the event has >= 1 gate). */
  showPicker: boolean;
  /**
   * First-scan session open fallback keeps the live camera. Only used while the
   * gate list failed to load, so staff are never blocked by a gates outage.
   */
  scanFallback: boolean;
  canOpen: boolean;
};

export function resolveOpenSessionUi(input: {
  hasScope: boolean;
  hasSession: boolean;
  gates: GatesLoadState | null;
  selected: StaffGate | null;
  opening: boolean;
}): OpenSessionUi {
  const status = input.gates?.status ?? 'loading';
  const none = {
    explicitOpen: false,
    showPicker: false,
    scanFallback: false,
    canOpen: false,
  };
  if (!input.hasScope || input.hasSession) return none;
  if (status === 'error') return { ...none, scanFallback: true };
  if (status === 'loading') return { ...none, explicitOpen: true };
  const count = input.gates?.gates.length ?? 0;
  return {
    explicitOpen: true,
    showPicker: count >= 1,
    scanFallback: false,
    canOpen: !input.opening && (count === 0 || input.selected !== null),
  };
}
