import * as SecureStore from 'expo-secure-store';
import type { MeEventItem } from '@ticket/contracts';
import {
  type StaffGateScope,
  pickStaffGateScope,
  sameStaffGateScope,
} from './staff-gate-events.ts';

export { resolveGateScanFallback } from './staff-gate-scope-resolve.ts';

const KEY_PREFIX = 'ticket.staff.gate.scope.v1.';

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function readPersistedStaffGateScope(
  userId: string,
): Promise<StaffGateScope | null> {
  if (!userId) return null;
  const raw = await SecureStore.getItemAsync(storageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as Record<string, unknown>;
    if (
      typeof row.tenantId !== 'string' ||
      typeof row.eventId !== 'string' ||
      typeof row.name !== 'string'
    ) {
      return null;
    }
    return {
      tenantId: row.tenantId,
      eventId: row.eventId,
      name: row.name,
    };
  } catch {
    return null;
  }
}

export async function writePersistedStaffGateScope(
  userId: string,
  scope: StaffGateScope,
): Promise<void> {
  if (!userId) return;
  await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(scope));
}

export async function clearPersistedStaffGateScope(
  userId: string,
): Promise<void> {
  if (!userId) return;
  await SecureStore.deleteItemAsync(storageKey(userId));
}

export async function resolveStaffGateScopeFromMeEvents(
  userId: string,
  items: readonly MeEventItem[],
): Promise<StaffGateScope | null> {
  const persisted = await readPersistedStaffGateScope(userId);
  const picked = pickStaffGateScope(items, persisted);
  if (picked && (!persisted || !sameStaffGateScope(picked, persisted))) {
    await writePersistedStaffGateScope(userId, picked);
  }
  return picked;
}
