import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/expo';

/**
 * Clerk session token cache on the same SecureStore posture as
 * `secure-credential-store` (WHEN_UNLOCKED_THIS_DEVICE_ONLY + dedicated service).
 * SessionBoundary still owns API bearer verify + user/tenant cache partitions.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.clerk',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const clerkTokenCache: TokenCache = {
  getToken: (key) => SecureStore.getItemAsync(key, options),
  saveToken: (key, token) => SecureStore.setItemAsync(key, token, options),
  clearToken: (key) => SecureStore.deleteItemAsync(key, options),
};
