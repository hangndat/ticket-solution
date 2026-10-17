import * as SecureStore from 'expo-secure-store';
import { serialSecureStore } from '@/platform/secure-store-serial';
import type {
  OfflineDisplayBinding,
  OfflineDisplayStore,
} from './offline-display.ts';

const options: SecureStore.SecureStoreOptions = {
  keychainService: 'ticket-foundation.offline-display',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const BINDING_KEY = 'ticket.offline-display.v1';

function parseBinding(raw: string | null): OfflineDisplayBinding | null {
  if (!raw) return null;
  try {
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object') return null;
    const row = body as Record<string, unknown>;
    if (typeof row.userId !== 'string' || row.userId.length === 0) return null;
    if (typeof row.tenantId !== 'string' || row.tenantId.length === 0)
      return null;
    return { userId: row.userId, tenantId: row.tenantId };
  } catch {
    return null;
  }
}

export const secureOfflineDisplayStore: OfflineDisplayStore = {
  async read() {
    const raw = await serialSecureStore(() =>
      SecureStore.getItemAsync(BINDING_KEY, options),
    );
    return parseBinding(raw);
  },
  async write(binding) {
    await serialSecureStore(() =>
      SecureStore.setItemAsync(
        BINDING_KEY,
        JSON.stringify(binding),
        options,
      ),
    );
  },
  async clear() {
    await serialSecureStore(() =>
      SecureStore.deleteItemAsync(BINDING_KEY, options),
    );
  },
};
