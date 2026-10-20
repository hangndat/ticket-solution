import * as SecureStore from 'expo-secure-store';
import { recoverOps, type GateOp } from './gate-scan.ts';
import { readPersistedStaffGateScope } from './staff-gate-scope.ts';
import {
  emptyStaffGateWorkspace,
  scopeStorageKey,
  type StaffGateWorkspace,
} from './staff-gate-workspace.ts';

const WORKSPACE_KEY_PREFIX = 'ticket.gate.workspace.v2.';
const LEGACY_OPS_KEY = 'ticket.gate.ops.v1';

function workspaceKey(userId: string): string {
  return `${WORKSPACE_KEY_PREFIX}${userId}`;
}

function parseWorkspace(raw: string | null): StaffGateWorkspace | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as Record<string, unknown>;
    if (row.v !== 2) return null;
    const selected = row.selected;
    let selectedScope: StaffGateWorkspace['selected'] = null;
    if (selected && typeof selected === 'object') {
      const s = selected as Record<string, unknown>;
      if (
        typeof s.tenantId === 'string' &&
        typeof s.eventId === 'string' &&
        typeof s.name === 'string'
      ) {
        selectedScope = {
          tenantId: s.tenantId,
          eventId: s.eventId,
          name: s.name,
        };
      }
    }
    const sessionsByScope: Record<string, string> = {};
    if (row.sessionsByScope && typeof row.sessionsByScope === 'object') {
      for (const [k, v] of Object.entries(
        row.sessionsByScope as Record<string, unknown>,
      )) {
        if (typeof v === 'string') sessionsByScope[k] = v;
      }
    }
    const opsByScope: Record<string, GateOp[]> = {};
    if (row.opsByScope && typeof row.opsByScope === 'object') {
      for (const [k, v] of Object.entries(
        row.opsByScope as Record<string, unknown>,
      )) {
        if (Array.isArray(v)) {
          opsByScope[k] = recoverOps(v as GateOp[]);
        }
      }
    }
    return {
      v: 2,
      selected: selectedScope,
      sessionsByScope,
      opsByScope,
    };
  } catch {
    return null;
  }
}

async function migrateLegacyWorkspace(
  userId: string,
): Promise<StaffGateWorkspace> {
  const ws = emptyStaffGateWorkspace();
  const legacyScope = await readPersistedStaffGateScope(userId);
  const legacyOpsRaw = await SecureStore.getItemAsync(LEGACY_OPS_KEY);
  let legacyOps: GateOp[] = [];
  if (legacyOpsRaw) {
    try {
      const parsed = JSON.parse(legacyOpsRaw) as unknown;
      if (Array.isArray(parsed)) legacyOps = recoverOps(parsed as GateOp[]);
    } catch {
      legacyOps = [];
    }
  }
  const selected =
    legacyScope ??
    (legacyOps[0]
      ? {
          tenantId: legacyOps[0].tenantId,
          eventId: legacyOps[0].eventId,
          name: 'Sự kiện đã lưu',
        }
      : null);
  if (!selected) return ws;
  const key = scopeStorageKey(selected);
  return {
    v: 2,
    selected,
    sessionsByScope: {},
    opsByScope: legacyOps.length > 0 ? { [key]: legacyOps } : {},
  };
}

export async function loadStaffGateWorkspace(
  userId: string,
): Promise<StaffGateWorkspace> {
  if (!userId) return emptyStaffGateWorkspace();
  const raw = await SecureStore.getItemAsync(workspaceKey(userId));
  const parsed = parseWorkspace(raw);
  if (parsed) return parsed;
  return migrateLegacyWorkspace(userId);
}

export async function saveStaffGateWorkspace(
  userId: string,
  workspace: StaffGateWorkspace,
): Promise<void> {
  if (!userId) return;
  await SecureStore.setItemAsync(
    workspaceKey(userId),
    JSON.stringify(workspace),
  );
}

/** Drop durable gate workspace for this user (logout / account switch). */
export async function clearStaffGateWorkspace(userId: string): Promise<void> {
  if (!userId) return;
  await SecureStore.deleteItemAsync(workspaceKey(userId));
}
