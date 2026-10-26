'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { portalGet, type PortalFetchResult } from './portal-fetch';
import { IntentMutation, type IntentOutcome } from './intent-mutation';

export function useIntentMutation<T extends object>(
  tenantId: string,
  eventId: string | undefined,
  command: string,
) {
  const scope = `${tenantId}/${eventId ?? ''}/${command}`;
  const controller = useRef<{ scope: string; value: IntentMutation<T> } | null>(null);
  const [state, setState] = useState<'loading' | 'idle' | 'in-flight' | 'unknown' | 'blocked'>('loading');
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setState('loading'); });
    controller.current = null;
    void portalGet('/api/bff/me/subject').then((res) => {
      if (!active) return;
      const actorId = res.status === 200 && res.json && typeof res.json === 'object'
        ? (res.json as { userId?: unknown }).userId : null;
      if (typeof actorId !== 'string' || !actorId.trim()) {
        setReason('identity');
        setState('blocked');
        return;
      }
      let value: IntentMutation<T>;
      try {
        value = new IntentMutation<T>(
          { actorId, tenantId, eventId, command },
          window.sessionStorage,
        );
      } catch {
        setReason('storage');
        setState('blocked');
        return;
      }
      controller.current = { scope, value };
      setState(value.state);
      setReason(value.blockReason?.kind === 'blocked' ? value.blockReason.reason : null);
    });
    return () => {
      active = false;
      controller.current = null;
    };
  }, [tenantId, eventId, command, scope]);

  const run = useCallback(async (
    payload: T,
    send: (body: T & { idempotencyKey: string }) => Promise<PortalFetchResult>,
    confirmed: (response: PortalFetchResult) => boolean,
  ): Promise<IntentOutcome> => {
    const current = controller.current;
    if (!current || current.scope !== scope) return { kind: 'blocked', reason: 'storage' };
    const promise = current.value.run(payload, send, confirmed);
    setState(current.value.state);
    const outcome = await promise;
    if (controller.current !== current) return { kind: 'blocked', reason: 'recovery' };
    setState(current.value.state);
    setReason(outcome.kind === 'blocked' ? outcome.reason : null);
    return outcome;
  }, [scope]);

  return { run, state, reason };
}
