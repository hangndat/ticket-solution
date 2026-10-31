const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A new server-issued staff session is required after a durable cursor rejection. */
export async function openReplacementGateSession(input: {
  bearer: string;
  apiBase: string;
  tenantId: string;
  eventId: string;
  /** O31: optional gate chosen by staff; omitted keeps the legacy gateless session. */
  gateId?: string | null;
  shouldContinue: () => boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ kind: 'ok'; sessionId: string; gateId: string | null; gateName: string | null } | { kind: 'auth' } | { kind: 'stale' } | { kind: 'error' }> {
  if (!input.shouldContinue()) return { kind: 'stale' };
  try {
    const response = await (input.fetchImpl ?? fetch)(
      `${input.apiBase.replace(/\/$/, '')}/v1/gate/events/${input.eventId}/sessions`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${input.bearer}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          input.gateId
            ? { tenantId: input.tenantId, gateId: input.gateId }
            : { tenantId: input.tenantId },
        ),
      },
    );
    if (!input.shouldContinue()) return { kind: 'stale' };
    if (response.status === 401 || response.status === 403) return { kind: 'auth' };
    if (response.status !== 200 && response.status !== 201) return { kind: 'error' };
    const body: unknown = await response.json();
    if (!input.shouldContinue()) return { kind: 'stale' };
    if (!body || typeof body !== 'object') return { kind: 'error' };
    const sessionId = (body as Record<string, unknown>).sessionId;
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) return { kind: 'error' };
    const record = body as Record<string, unknown>;
    return {
      kind: 'ok',
      sessionId: sessionId.toLowerCase(),
      gateId: typeof record.gateId === 'string' ? record.gateId : null,
      gateName: typeof record.gateName === 'string' ? record.gateName : null,
    };
  } catch {
    return input.shouldContinue() ? { kind: 'error' } : { kind: 'stale' };
  }
}
