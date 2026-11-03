'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalGet } from '../client/portal-fetch';
import {
  buildGuestListQueryPath,
  type GuestListKind,
} from './guest-list-query';
import { readGuestListPage, type GuestListPage } from './guest-list-page';

type Args = {
  tenantId: string;
  eventId: string;
  kind: GuestListKind;
  cursor: string | null;
  state: string;
  search: string;
  revision: number;
  allowed: boolean;
  forbiddenMessage: string;
  loadFailedMessage: string;
};

export function useGuestListPage({
  tenantId,
  eventId,
  kind,
  cursor,
  state,
  search,
  revision,
  allowed,
  forbiddenMessage,
  loadFailedMessage,
}: Args) {
  const [page, setPage] = useState<GuestListPage>({
    rows: [],
    nextCursor: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });
    void portalGet(
      buildGuestListQueryPath(tenantId, eventId, kind, cursor, state, search),
    ).then((result) => {
      if (!active) return;
      const next = readGuestListPage(
        kind,
        result.status,
        result.json,
        result.networkError,
      );
      if (next) setPage(next);
      else
        setError(result.status === 403 ? forbiddenMessage : loadFailedMessage);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [
    tenantId,
    eventId,
    kind,
    cursor,
    state,
    search,
    revision,
    allowed,
    forbiddenMessage,
    loadFailedMessage,
  ]);

  const clearError = useCallback(() => setError(null), []);
  const reset = useCallback(() => setPage({ rows: [], nextCursor: null }), []);

  return { page, loading, error, setError, clearError, reset };
}
