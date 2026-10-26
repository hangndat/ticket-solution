'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortalUserId } from '../views/use-portal-user-id';
import type { PortalFetchResult } from './portal-fetch';
import { MutationIntent, type IntentResult } from './mutation-intent';

export function useMutationIntent(tenantId: string, eventId: string | undefined, command: string) {
  const identity = usePortalUserId();
  const actorId = identity.status === 'ready' ? identity.userId : '';
  const scope = JSON.stringify([actorId, tenantId, eventId ?? '', command]);
  const currentScope = useRef(scope);
  useEffect(() => { currentScope.current = scope; }, [scope]);
  const [, refresh] = useState(0);
  const controller = useMemo(() => {
    if (!actorId || !tenantId || typeof window === 'undefined') return null;
    try {
      return new MutationIntent({ actorId, tenantId, eventId, command }, window.localStorage);
    } catch {
      return null;
    }
  }, [actorId, tenantId, eventId, command]);

  async function run(
    payload: object,
    send: (body: Record<string, unknown>) => Promise<PortalFetchResult>,
  ): Promise<IntentResult> {
    if (!controller) return { kind: 'blocked', reason: 'identity' };
    const result = await controller.run(payload, send);
    if (currentScope.current !== scope) return { kind: 'blocked', reason: 'changed' };
    refresh((n) => n + 1);
    return result;
  }

  function release() {
    controller?.release();
    refresh((n) => n + 1);
  }

  return {
    run,
    release,
    pending: controller?.status ?? null,
    needsReconciliation: controller?.needsReconciliation ?? false,
  };
}
