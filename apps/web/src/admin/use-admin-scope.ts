'use client';

import { useCallback, useState } from 'react';
import type { AdminScope } from './scope';

type Initial = { tenantId?: string; eventId?: string };

export function useAdminScope(initial: Initial = {}) {
  const [tenantId, setTenantId] = useState(initial.tenantId ?? '');
  const [eventId, setEventId] = useState(initial.eventId ?? '');

  const scope = useCallback((): AdminScope => {
    return { tenantId: tenantId.trim(), eventId: eventId.trim() };
  }, [tenantId, eventId]);

  return {
    tenantId,
    setTenantId,
    eventId,
    setEventId,
    scope,
  };
}
