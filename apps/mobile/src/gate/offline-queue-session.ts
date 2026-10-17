import { OfflineScanQueue } from './offline-queue.ts';
import { secureOfflineQueueStore } from './offline-queue-store.ts';

export const offlineScanQueue = new OfflineScanQueue(secureOfflineQueueStore);
