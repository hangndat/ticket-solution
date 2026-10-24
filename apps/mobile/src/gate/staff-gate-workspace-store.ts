import * as SecureStore from 'expo-secure-store';
import { readPersistedStaffGateScopeUnsafe } from './staff-gate-scope.ts';
import { createGateWorkspaceStore } from './staff-gate-workspace-store-core.ts';
import { createDurableGateOwnership, parseGateOwnerJournal } from './durable-gate-ownership.ts';
import { listGateLegacyKeys } from './gate-keychain-index.ts';

const store = createGateWorkspaceStore(SecureStore, readPersistedStaffGateScopeUnsafe);
const ownerOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.gate-ownership',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const queueOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.gate-offline-queue',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const OWNER_KEY = 'ticket.gate.identity-owner.v1';
const ownership = createDurableGateOwnership({
  readJournal: () => SecureStore.getItemAsync(OWNER_KEY, ownerOptions),
  writeJournal: (raw) => SecureStore.setItemAsync(OWNER_KEY, raw, ownerOptions),
  list: listGateLegacyKeys,
  invalidate: store.invalidate,
  allow: store.allow,
  load: store.load,
  save: store.save,
  deletePartition: async (userId) => {
    await store.beginPurge(userId);
    await SecureStore.deleteItemAsync(`ticket.gate.offline-queue.v1.${userId}`, queueOptions);
    await SecureStore.deleteItemAsync(`ticket.gate.offline-seq.v1.${userId}`, queueOptions);
  },
  deleteLegacy: () => SecureStore.deleteItemAsync('ticket.gate.ops.v1'),
});

export const loadStaffGateWorkspace = ownership.load;
export const saveStaffGateWorkspace = ownership.save;
export const prepareVerifiedGateOwnership = ownership.prepareVerified;
export const beginDurableGateLogout = ownership.beginLogout;
export const runGateForOwner = ownership.runForOwner;
export const serialGateStorage = ownership.serial;
export const readLastVerifiedGateOwner = () => ownership.serial(async () =>
  parseGateOwnerJournal(await SecureStore.getItemAsync(OWNER_KEY, ownerOptions)).lastVerifiedUserId);
export const clearStaffGateWorkspace = store.clear;
export const beginStaffGateWorkspacePurge = store.beginPurge;
export const invalidateStaffGateWorkspaceWrites = store.invalidate;
export const allowStaffGateWorkspaceWrites = (userId: string, generation?: number) => {
  if (ownership.getState().readyOwner === userId && !ownership.getState().blocked) store.allow(userId, generation);
};
export const gateWorkspaceWriteGeneration = store.generation;
export const isGateWorkspaceWriteGenerationCurrent = store.current;
export const subscribeStaffGateWorkspaceInvalidation = store.subscribeInvalidation;
