import React from 'react';
import { randomUUID } from 'node:crypto';

const bytes = globalThis.__f02SecureBytes ??= new Map();
const key = (name, options) => `${options?.keychainService ?? 'app'}:${name}`;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
export const getItemAsync = async (name, options) => {
  globalThis.__f02SecureFault?.('read', name, null);
  if (name === 'ticket.gate.workspace.v2.B' && globalThis.__f02HoldBLoad) await globalThis.__f02HoldBLoad;
  return bytes.get(key(name, options)) ?? null;
};
export const setItemAsync = async (name, value, options) => {
  globalThis.__f02SecureFault?.('write', name, value);
  bytes.set(key(name, options), value);
};
export const deleteItemAsync = async (name, options) => {
  globalThis.__f02SecureFault?.('delete', name, null);
  bytes.delete(key(name, options));
};
export const requireNativeModule = (name) => {
  if (name !== 'GateKeychainIndex') throw new Error(`Unexpected native module: ${name}`);
  return { listGateLegacyKeys: async () => {
    const accounts = (service, prefix) => [...bytes.keys()]
      .filter((item) => item.startsWith(`${service}:${prefix}`))
      .map((item) => item.slice(`${service}:${prefix}`.length));
    return {
      workspaceUserIds: accounts('app', 'ticket.gate.workspace.v2.'),
      scopeUserIds: accounts('app', 'ticket.staff.gate.scope.v1.'),
      queueUserIds: accounts('ticket-foundation.gate-offline-queue', 'ticket.gate.offline-queue.v1.'),
      legacyOpsPresent: bytes.has('app:ticket.gate.ops.v1'),
    };
  } };
};
export const AppState = { addEventListener: () => ({ remove() {} }), currentState: 'active' };
export const Platform = { OS: 'ios', select: (value) => value.ios };
export const StyleSheet = { create: (value) => value };
export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const ScrollView = 'ScrollView';
export const ActivityIndicator = 'ActivityIndicator';
export const Keyboard = { dismiss() {} };
export const Alert = { alert() {} };
export const NativeModules = {};
export const makeRedirectUri = () => 'vemoki://oauth/callback';
export const maybeCompleteAuthSession = () => {};
export const fetchDiscoveryAsync = async () => ({});
export const AuthRequest = class {};
export const ResponseType = { Code: 'code' };
export const randomUUIDShim = randomUUID;
export const randomUUIDAsync = async () => randomUUID();
export const getRandomBytesAsync = async (length) => new Uint8Array(length);
export const useRouter = () => ({});
export const router = { replace() {}, push() {} };
export const useSegments = () => [];
export const useFocusEffect = () => {};
export const Link = 'Link';
export const Stack = 'Stack';
export const Host = 'Host';
export const Picker = 'Picker';
export const SegmentedControl = 'SegmentedControl';
export const SymbolView = 'SymbolView';
export const getPermissionsAsync = async () => ({ status: 'granted' });
export const getDevicePushTokenAsync = async () => ({ data: 'synthetic' });
export const setBadgeCountAsync = async () => true;
export default { expoConfig: { extra: {} }, AppState, Platform, getItemAsync, setItemAsync,
  deleteItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireNativeModule };
