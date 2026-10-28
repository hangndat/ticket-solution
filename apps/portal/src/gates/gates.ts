/** Event gates (O31/O32) — pure helpers for the portal «Cổng vào» panel. */

export type PortalGate = {
  id: string;
  name: string;
  sortOrder: number;
};

export const GATE_NAME_MAX = 80;
export const GATE_SORT_MAX = 9999;

export type GateFormError =
  | 'gates.nameRequired'
  | 'gates.nameTooLong'
  | 'gates.sortInvalid';

export type GateFormInput = { name: string; sortOrder?: number };

export function parseGateForm(
  rawName: string,
  rawSort: string | number | null | undefined,
): { ok: true; value: GateFormInput } | { ok: false; error: GateFormError } {
  const name = (rawName ?? '').trim();
  if (!name) return { ok: false, error: 'gates.nameRequired' };
  if (name.length > GATE_NAME_MAX) {
    return { ok: false, error: 'gates.nameTooLong' };
  }
  if (rawSort === null || rawSort === undefined || rawSort === '') {
    return { ok: true, value: { name } };
  }
  const n = typeof rawSort === 'number' ? rawSort : Number(String(rawSort).trim());
  if (!Number.isInteger(n) || n < 0 || n > GATE_SORT_MAX) {
    return { ok: false, error: 'gates.sortInvalid' };
  }
  return { ok: true, value: { name, sortOrder: n } };
}

export function parseGateList(json: unknown): PortalGate[] | null {
  if (!json || typeof json !== 'object') return null;
  const raw = (json as { gates?: unknown }).gates;
  if (!Array.isArray(raw)) return null;
  const out: PortalGate[] = [];
  for (const g of raw) {
    if (!g || typeof g !== 'object') return null;
    const { id, name, sortOrder } = g as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    out.push({
      id,
      name,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    });
  }
  return out;
}

export type GateCreateOutcome =
  | { kind: 'created' }
  | { kind: 'conflict' }
  | { kind: 'forbidden' }
  | { kind: 'failed' };

export function interpretGateCreate(
  status: number,
  json: unknown,
  networkFailure: boolean,
): GateCreateOutcome {
  if (networkFailure || status >= 500) return { kind: 'failed' };
  if (status === 200 || status === 201) return { kind: 'created' };
  if (status === 403) return { kind: 'forbidden' };
  const code =
    json && typeof json === 'object'
      ? (json as { code?: unknown }).code
      : undefined;
  if (status === 409 && code === 'GATE_NAME_CONFLICT') {
    return { kind: 'conflict' };
  }
  return { kind: 'failed' };
}
