/**
 * Portal saved views P2a — local prefs only (P2-VIEWS-PHASED).
 * Private by default; keyed by userId + tenantId. No Nest / P2b share.
 */

export const SAVED_VIEWS_SCHEMA_VERSION = 1 as const;

/** List surfaces that expose filter toolbars (UX §3.2 / BA P2-B). */
export type SavedViewSurface =
  | 'pending'
  | 'notifications'
  | 'exports'
  | 'cs'
  | 'codes'
  | 'audit'
  | 'members';

export type SavedViewScope = 'event' | 'org';

export type SavedViewSort = {
  field: string;
  order: 'ascend' | 'descend';
};

export type SavedViewRecord = {
  schemaVersion: typeof SAVED_VIEWS_SCHEMA_VERSION;
  id: string;
  name: string;
  surface: SavedViewSurface;
  /** event = this event only; org = tenant-wide for that surface */
  scope: SavedViewScope;
  eventId: string | null;
  /** Allowlisted filter keys only — never raw secrets / free-text PII dumps */
  filters: Record<string, string>;
  sort: SavedViewSort | null;
  /** Visible column keys (allowlisted); empty = surface default */
  columns: string[];
  isDefault: boolean;
  updatedAt: string;
};

export type SavedViewsStore = {
  schemaVersion: typeof SAVED_VIEWS_SCHEMA_VERSION;
  views: SavedViewRecord[];
};

export type SanitizeResult = {
  filters: Record<string, string>;
  sort: SavedViewSort | null;
  columns: string[];
  /** True when unknown/deprecated keys were dropped (AC-PS2 stale banner). */
  stale: boolean;
};
