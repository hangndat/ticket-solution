import * as SecureStore from 'expo-secure-store';
import type { GateOp } from '@/gate/gate-scan';

const KEY = 'ticket.gate.ops.v1';
/** V1 has no verified owner; it cannot be read or written safely. */
export async function loadGateOps(): Promise<GateOp[]> {
  await SecureStore.deleteItemAsync(KEY);
  return [];
}

export async function saveGateOps(_ops: readonly GateOp[]): Promise<void> {
  // Retired writer: only the verified-user v2 workspace may persist scans.
}
