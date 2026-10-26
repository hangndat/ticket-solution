'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { portalGet, type PortalFetchResult } from './portal-fetch';
import { IntentMutation, type IntentOutcome } from './intent-mutation';
import { ActorBoundIntent, actorFromSubject } from './actor-bound-intent';

async function currentActor(): Promise<string | null> {
  return actorFromSubject(await portalGet('/api/bff/me/subject'));
}

export function useIntentMutation<T extends object>(
  tenantId: string,
  eventId: string | undefined,
  command: string,
) {
  const scope = `${tenantId}/${eventId ?? ''}/${command}`;
  const controller = useRef<{ scope: string; value: ActorBoundIntent<T> } | null>(null);
  const [state, setState] = useState<'loading' | 'idle' | 'in-flight' | 'unknown' | 'blocked'>('loading');
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setState('loading'); });
    controller.current = null;
    void currentActor().then((actorId) => {
      if (!active) return;
      if (!actorId) {
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
      const bound = new ActorBoundIntent(actorId, value, currentActor);
      controller.current = { scope, value: bound };
      setState(bound.state);
      setReason(bound.reason);
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
    if (!current || current.scope !== scope) return { kind: 'blocked', reason: 'identity' };
    const promise = current.value.run(payload, send, confirmed);
    setState(current.value.state);
    const outcome = await promise;
    if (controller.current !== current) return { kind: 'blocked', reason: 'recovery' };
    setState(current.value.state);
    setReason(current.value.reason);
    return outcome;
  }, [scope]);

  return { run, state, reason };
}
