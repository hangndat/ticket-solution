import type { LocalDeviceRegistration } from './device-token-types.ts';

const KEY = 'ticket.push.device-registration.v1';

export type ApnsRegistrationStore = {
  read(): Promise<LocalDeviceRegistration | null>;
  write(value: LocalDeviceRegistration): Promise<void>;
  clear(): Promise<void>;
};

function parse(raw: string | null): LocalDeviceRegistration | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return null;
    const body = value as Record<string, unknown>;
    if (
      typeof body.registrationId !== 'string' ||
      !body.registrationId ||
      typeof body.userId !== 'string' ||
      !body.userId ||
      (body.environment !== 'sandbox' && body.environment !== 'production')
    ) {
      return null;
    }
    return {
      registrationId: body.registrationId,
      userId: body.userId,
      environment: body.environment,
    };
  } catch {
    return null;
  }
}

async function secureOptions() {
  const SecureStore = await import('expo-secure-store');
  return {
    SecureStore,
    options: {
      keychainService: 'ticket-foundation.push',
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    } as const,
  };
}

/** Durable SecureStore adapter for the last server registration (per device). */
export const secureApnsRegistrationStore: ApnsRegistrationStore = {
  read: async () => {
    const { SecureStore, options } = await secureOptions();
    return parse(await SecureStore.getItemAsync(KEY, options));
  },
  write: async (value) => {
    const { SecureStore, options } = await secureOptions();
    await SecureStore.setItemAsync(KEY, JSON.stringify(value), options);
  },
  clear: async () => {
    const { SecureStore, options } = await secureOptions();
    await SecureStore.deleteItemAsync(KEY, options);
  },
};

/** In-memory store for unit tests. */
export function createMemoryApnsRegistrationStore(
  initial: LocalDeviceRegistration | null = null,
): ApnsRegistrationStore & { peek: () => LocalDeviceRegistration | null } {
  let current = initial;
  return {
    peek: () => current,
    read: async () => current,
    write: async (value) => {
      current = value;
    },
    clear: async () => {
      current = null;
    },
  };
}
