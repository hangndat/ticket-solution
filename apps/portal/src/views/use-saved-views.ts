'use client';

import { useCallback, useMemo, useState } from 'react';
import { sanitizeSavedViewPayload } from './allowlist';
import {
  deleteSavedView,
  detectStaleView,
  listViewsForSurface,
  readSavedViewsStore,
  setDefaultView,
  upsertSavedView,
  writeSavedViewsStore,
} from './storage';
import type {
  SavedViewRecord,
  SavedViewScope,
  SavedViewSort,
  SavedViewSurface,
} from './types';
import { SAVED_VIEWS_SCHEMA_VERSION } from './types';
import { usePortalUserId } from './use-portal-user-id';

export type ActiveFilters = Record<string, string | undefined>;

type SaveInput = {
  name: string;
  scope: SavedViewScope;
  filters: ActiveFilters;
  sort?: SavedViewSort | null;
  columns?: string[];
  isDefault?: boolean;
};

export function useSavedViews(opts: {
  tenantId: string;
  eventId?: string | null;
  surface: SavedViewSurface;
}) {
  const { tenantId, eventId = null, surface } = opts;
  const identity = usePortalUserId();
  const userId = identity.status === 'ready' ? identity.userId : null;
  const [revision, setRevision] = useState(0);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const views = useMemo(() => {
    if (!userId) return [] as SavedViewRecord[];
    void revision;
    return listViewsForSurface(
      readSavedViewsStore(userId, tenantId),
      surface,
      eventId,
    );
  }, [userId, tenantId, surface, eventId, revision]);

  const defaultView = useMemo(
    () => views.find((v) => v.isDefault) ?? null,
    [views],
  );

  const persist = useCallback(
    (
      mutator: (
        store: ReturnType<typeof readSavedViewsStore>,
      ) => ReturnType<typeof readSavedViewsStore>,
    ) => {
      if (!userId) return;
      const next = mutator(readSavedViewsStore(userId, tenantId));
      writeSavedViewsStore(userId, tenantId, next);
      setRevision((n) => n + 1);
    },
    [userId, tenantId],
  );

  const saveView = useCallback(
    (input: SaveInput): SavedViewRecord | null => {
      if (!userId) return null;
      const sanitized = sanitizeSavedViewPayload(surface, {
        filters: Object.fromEntries(
          Object.entries(input.filters).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === 'string' && entry[1].trim().length > 0,
          ),
        ),
        sort: input.sort ?? null,
        columns: input.columns ?? [],
      });
      const record: SavedViewRecord = {
        schemaVersion: SAVED_VIEWS_SCHEMA_VERSION,
        id: crypto.randomUUID(),
        name: input.name.trim().slice(0, 80),
        surface,
        scope: input.scope,
        eventId: input.scope === 'event' ? eventId : null,
        filters: sanitized.filters,
        sort: sanitized.sort,
        columns: sanitized.columns,
        isDefault: Boolean(input.isDefault),
        updatedAt: new Date().toISOString(),
      };
      if (!record.name) return null;
      persist((store) => upsertSavedView(store, record));
      setActiveViewId(record.id);
      setStale(sanitized.stale);
      return record;
    },
    [userId, surface, eventId, persist],
  );

  const applyView = useCallback(
    (
      view: SavedViewRecord,
    ): {
      filters: Record<string, string>;
      sort: SavedViewSort | null;
      columns: string[];
      stale: boolean;
    } => {
      const sanitized = sanitizeSavedViewPayload(view.surface, {
        filters: view.filters,
        sort: view.sort,
        columns: view.columns,
      });
      const isStale = sanitized.stale || detectStaleView(view);
      setActiveViewId(view.id);
      setStale(isStale);
      return {
        filters: sanitized.filters,
        sort: sanitized.sort,
        columns: sanitized.columns,
        stale: isStale,
      };
    },
    [],
  );

  const removeView = useCallback(
    (viewId: string) => {
      persist((store) => deleteSavedView(store, viewId));
      setActiveViewId((cur) => (cur === viewId ? null : cur));
    },
    [persist],
  );

  const markDefault = useCallback(
    (viewId: string) => {
      persist((store) => setDefaultView(store, viewId));
    },
    [persist],
  );

  const clearStale = useCallback(() => setStale(false), []);

  const reload = useCallback(() => setRevision((n) => n + 1), []);

  return {
    ready: identity.status === 'ready',
    identityStatus: identity.status,
    views,
    defaultView,
    activeViewId,
    stale,
    saveView,
    applyView,
    removeView,
    markDefault,
    clearStale,
    reload,
  };
}
