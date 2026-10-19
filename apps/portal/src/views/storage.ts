import { sanitizeSavedViewPayload } from './allowlist';
import {
  SAVED_VIEWS_SCHEMA_VERSION,
  type SavedViewRecord,
  type SavedViewScope,
  type SavedViewSurface,
  type SavedViewsStore,
} from './types';

/** localStorage prefix — private prefs scoped by userId + tenantId (ADR P2a). */
export const SAVED_VIEWS_STORAGE_PREFIX = 'vemoki_portal_saved_views_v1';

export function savedViewsStorageKey(
  userId: string,
  tenantId: string,
): string {
  return `${SAVED_VIEWS_STORAGE_PREFIX}:${userId}:${tenantId}`;
}

function emptyStore(): SavedViewsStore {
  return { schemaVersion: SAVED_VIEWS_SCHEMA_VERSION, views: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(raw: unknown): SavedViewRecord | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== SAVED_VIEWS_SCHEMA_VERSION) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (typeof raw.surface !== 'string') return null;
  if (raw.scope !== 'event' && raw.scope !== 'org') return null;
  if (raw.eventId !== null && typeof raw.eventId !== 'string') return null;
  if (typeof raw.isDefault !== 'boolean') return null;
  if (typeof raw.updatedAt !== 'string') return null;

  const surface = raw.surface as SavedViewSurface;
  const sanitized = sanitizeSavedViewPayload(surface, {
    filters: isRecord(raw.filters) ? raw.filters : {},
    sort: raw.sort ?? null,
    columns: raw.columns,
  });

  return {
    schemaVersion: SAVED_VIEWS_SCHEMA_VERSION,
    id: raw.id.trim(),
    name: raw.name.trim().slice(0, 80),
    surface,
    scope: raw.scope as SavedViewScope,
    eventId: raw.eventId,
    filters: sanitized.filters,
    sort: sanitized.sort,
    columns: sanitized.columns,
    isDefault: raw.isDefault,
    updatedAt: raw.updatedAt,
  };
}

export function parseSavedViewsStore(raw: unknown): SavedViewsStore {
  if (!isRecord(raw)) return emptyStore();
  if (raw.schemaVersion !== SAVED_VIEWS_SCHEMA_VERSION) return emptyStore();
  if (!Array.isArray(raw.views)) return emptyStore();
  const views: SavedViewRecord[] = [];
  for (const item of raw.views) {
    const parsed = parseRecord(item);
    if (parsed) views.push(parsed);
  }
  return { schemaVersion: SAVED_VIEWS_SCHEMA_VERSION, views };
}

export function readSavedViewsStore(
  userId: string,
  tenantId: string,
): SavedViewsStore {
  if (typeof localStorage === 'undefined') return emptyStore();
  if (!userId.trim() || !tenantId.trim()) return emptyStore();
  try {
    const raw = localStorage.getItem(savedViewsStorageKey(userId, tenantId));
    if (!raw) return emptyStore();
    return parseSavedViewsStore(JSON.parse(raw) as unknown);
  } catch {
    return emptyStore();
  }
}

export function writeSavedViewsStore(
  userId: string,
  tenantId: string,
  store: SavedViewsStore,
): void {
  if (typeof localStorage === 'undefined') return;
  if (!userId.trim() || !tenantId.trim()) return;
  try {
    localStorage.setItem(
      savedViewsStorageKey(userId, tenantId),
      JSON.stringify({
        schemaVersion: SAVED_VIEWS_SCHEMA_VERSION,
        views: store.views,
      } satisfies SavedViewsStore),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function listViewsForSurface(
  store: SavedViewsStore,
  surface: SavedViewSurface,
  eventId: string | null,
): SavedViewRecord[] {
  return store.views
    .filter((v) => {
      if (v.surface !== surface) return false;
      if (v.scope === 'org') return true;
      if (!eventId) return v.eventId == null;
      return v.eventId === eventId;
    })
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function upsertSavedView(
  store: SavedViewsStore,
  next: SavedViewRecord,
): SavedViewsStore {
  const others = store.views.filter((v) => v.id !== next.id);
  let views = [...others, next];
  if (next.isDefault) {
    views = views.map((v) =>
      v.surface === next.surface &&
      v.scope === next.scope &&
      v.eventId === next.eventId &&
      v.id !== next.id
        ? { ...v, isDefault: false }
        : v,
    );
  }
  return { schemaVersion: SAVED_VIEWS_SCHEMA_VERSION, views };
}

export function deleteSavedView(
  store: SavedViewsStore,
  viewId: string,
): SavedViewsStore {
  return {
    schemaVersion: SAVED_VIEWS_SCHEMA_VERSION,
    views: store.views.filter((v) => v.id !== viewId),
  };
}

export function setDefaultView(
  store: SavedViewsStore,
  viewId: string,
): SavedViewsStore {
  const target = store.views.find((v) => v.id === viewId);
  if (!target) return store;
  const views = store.views.map((v) => {
    if (v.id === viewId) return { ...v, isDefault: true };
    if (
      v.surface === target.surface &&
      v.scope === target.scope &&
      v.eventId === target.eventId
    ) {
      return { ...v, isDefault: false };
    }
    return v;
  });
  return { schemaVersion: SAVED_VIEWS_SCHEMA_VERSION, views };
}

/** Detect stale keys when re-applying a stored view to current allowlist. */
export function detectStaleView(view: SavedViewRecord): boolean {
  const result = sanitizeSavedViewPayload(view.surface, {
    filters: view.filters,
    sort: view.sort,
    columns: view.columns,
  });
  if (result.stale) return true;
  const filterKeys = Object.keys(view.filters).sort();
  const cleanedKeys = Object.keys(result.filters).sort();
  if (filterKeys.join(',') !== cleanedKeys.join(',')) return true;
  if ((view.sort?.field ?? '') !== (result.sort?.field ?? '')) return true;
  if (view.columns.join(',') !== result.columns.join(',')) return true;
  return false;
}
