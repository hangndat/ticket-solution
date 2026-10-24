const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A new server-issued staff session is required after a durable cursor rejection. */
export async function openReplacementGateSession(input: {
  bearer: string;
  apiBase: string;
  tenantId: string;
  eventId: string;
  shouldContinue: () => boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ kind: 'ok'; sessionId: string } | { kind: 'auth' } | { kind: 'stale' } | { kind: 'error' }> {
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
        body: JSON.stringify({ tenantId: input.tenantId }),
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
    return { kind: 'ok', sessionId: sessionId.toLowerCase() };
  } catch {
    return input.shouldContinue() ? { kind: 'error' } : { kind: 'stale' };
  }
}
