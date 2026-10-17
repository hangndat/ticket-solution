import * as SecureStore from 'expo-secure-store';
import { serialSecureStore } from '@/platform/secure-store-serial';
import type { CredentialStore } from './session-boundary';

const key = 'ticket.identity.credential.v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.identity',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
export const secureCredentialStore: CredentialStore = {
  read: () =>
    serialSecureStore(() => SecureStore.getItemAsync(key, options)),
  write: (credential) =>
    serialSecureStore(() =>
      SecureStore.setItemAsync(key, credential, options),
    ),
  clear: () =>
    serialSecureStore(() => SecureStore.deleteItemAsync(key, options)),
};
