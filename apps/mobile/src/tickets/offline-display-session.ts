import { OfflineDisplayBoundary } from './offline-display.ts';
import { secureOfflineDisplayStore } from './offline-display-store.ts';

export const offlineDisplay = new OfflineDisplayBoundary(
  secureOfflineDisplayStore,
);
