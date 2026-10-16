import * as SecureStore from 'expo-secure-store';
import type { CredentialStore } from './session-boundary';

const key = 'ticket.identity.credential.v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.identity',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
export const secureCredentialStore: CredentialStore = {
  read: () => SecureStore.getItemAsync(key, options),
  write: (credential) => SecureStore.setItemAsync(key, credential, options),
  clear: () => SecureStore.deleteItemAsync(key, options),
};
