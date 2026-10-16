import * as SecureStore from 'expo-secure-store';
import { recoverOps, type GateOp } from '@/gate/gate-scan';

const KEY = 'ticket.gate.ops.v1';
const MAX_OPS = 5;

export async function loadGateOps(): Promise<GateOp[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return recoverOps(parsed as GateOp[]);
  } catch {
    return [];
  }
}

export async function saveGateOps(ops: readonly GateOp[]): Promise<void> {
  const trimmed = ops.slice(0, MAX_OPS);
  await SecureStore.setItemAsync(KEY, JSON.stringify(trimmed));
}
