import type { MessageKey } from '../i18n';

/** Default i18n keys formerly centralized in `SurfaceState` (O26-PR3, non-UI only). */
export const SURFACE_MESSAGE_KEYS = {
  loading: 'surface.loading',
  emptyDefault: 'surface.empty.default',
  errorLoadFailed: 'surface.error.loadFailed',
  retry: 'surface.action.retry',
  unknownTitle: 'surface.unknown.title',
  unknownDefaultDescription: 'surface.unknown.defaultDescription',
  recheck: 'surface.action.recheck',
  permissionTitle: 'surface.permission.title',
  permissionDefaultDescription: 'surface.permission.defaultDescription',
  permissionGoAllowed: 'surface.permission.goAllowed',
  suspendedTitle: 'surface.suspended.title',
  suspendedDescription: 'surface.suspended.description',
  pendingActivationTitle: 'surface.pendingActivation.title',
  pendingActivationDescription: 'surface.pendingActivation.description',
} as const satisfies Record<string, MessageKey>;

export type SurfaceMessageKeyId = keyof typeof SURFACE_MESSAGE_KEYS;

export function surfaceMessageKeys(): readonly MessageKey[] {
  return Object.values(SURFACE_MESSAGE_KEYS);
}
