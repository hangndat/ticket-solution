import type { LocalDeviceRegistration } from './device-token-types.ts';

const KEY = 'ticket.push.device-registration.v1';
type Envelope = { v: 2; current: LocalDeviceRegistration | null; pendingDetach: LocalDeviceRegistration[] };
export type ApnsRegistrationStore = {
  read(): Promise<LocalDeviceRegistration | null>;
  write(value: LocalDeviceRegistration): Promise<void>;
  retainPending(value: LocalDeviceRegistration): Promise<void>;
  clearIfMatches(value: LocalDeviceRegistration): Promise<void>;
  pendingFor(userId: string): Promise<LocalDeviceRegistration[]>;
  hasPendingOutside(userId: string | null): Promise<boolean>;
};

function valid(value: unknown): value is LocalDeviceRegistration {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.registrationId === 'string' && !!row.registrationId &&
    typeof row.userId === 'string' && !!row.userId &&
    (row.environment === 'sandbox' || row.environment === 'production');
}
function same(a: LocalDeviceRegistration | null, b: LocalDeviceRegistration): boolean {
  return !!a && a.registrationId === b.registrationId && a.userId === b.userId && a.environment === b.environment;
}
function parse(raw: string | null): Envelope {
  if (raw === null) return { v: 2, current: null, pendingDetach: [] };
  let row: unknown;
  try { row = JSON.parse(raw); } catch { throw new Error('Không thể đọc đăng ký thông báo. Vui lòng thử lại.'); }
  if (valid(row)) return { v: 2, current: row, pendingDetach: [] };
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Không thể đọc đăng ký thông báo. Vui lòng thử lại.');
  const value = row as Record<string, unknown>;
  if (value.v !== 2 || !(value.current === null || valid(value.current)) ||
      !Array.isArray(value.pendingDetach) || value.pendingDetach.some((item) => !valid(item))) {
    throw new Error('Không thể đọc đăng ký thông báo. Vui lòng thử lại.');
  }
  return value as Envelope;
}

/** Every operation, including CAS, uses the same per-adapter serial queue. */
export function createApnsRegistrationStore(io: { read(): Promise<string | null>; write(raw: string): Promise<void> }) {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };
  const get = async () => parse(await io.read());
  const put = (value: Envelope) => io.write(JSON.stringify(value));
  const api: ApnsRegistrationStore = {
    read: () => serial(async () => (await get()).current),
    write: (value) => serial(async () => {
      const state = await get();
      if (state.current && !same(state.current, value) &&
          !state.pendingDetach.some((item) => same(item, state.current!))) state.pendingDetach.push(state.current);
      state.current = value;
      await put(state);
    }),
    retainPending: (value) => serial(async () => {
      const state = await get();
      if (!state.pendingDetach.some((item) => same(item, value))) state.pendingDetach.push(value);
      if (same(state.current, value)) state.current = null;
      await put(state);
    }),
    clearIfMatches: (value) => serial(async () => {
      const state = await get();
      if (same(state.current, value)) state.current = null;
      state.pendingDetach = state.pendingDetach.filter((item) => !same(item, value));
      await put(state);
    }),
    pendingFor: (userId) => serial(async () => (await get()).pendingDetach.filter((item) => item.userId === userId)),
    hasPendingOutside: (userId) => serial(async () => (await get()).pendingDetach.some((item) => item.userId !== userId)),
  };
  return api;
}

/** A module singleton: register, logout and late compensation share this queue. */
export const secureApnsRegistrationStore: ApnsRegistrationStore = createApnsRegistrationStore({
  read: async () => {
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(KEY, { keychainService: 'ticket-foundation.push', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  write: async (raw) => {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(KEY, raw, { keychainService: 'ticket-foundation.push', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
});

export function createMemoryApnsRegistrationStore(initial: LocalDeviceRegistration | null = null): ApnsRegistrationStore & { peek: () => LocalDeviceRegistration | null } {
  let raw: string | null = initial ? JSON.stringify(initial) : null;
  const store = createApnsRegistrationStore({ read: async () => raw, write: async (value) => { raw = value; } });
  return { ...store, peek: () => parse(raw).current };
}
