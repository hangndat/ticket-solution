import { recoverOps, type GateOp } from './gate-scan.ts';
import type { MeEventItem } from '@ticket/contracts';
import {
  type StaffGateScope,
  pickStaffGateScope,
  sameStaffGateScope,
} from './staff-gate-events.ts';

const MAX_OPS_PER_SCOPE = 5;

export type StaffGateWorkspace = {
  v: 2;
  selected: StaffGateScope | null;
  sessionsByScope: Record<string, string>;
  opsByScope: Record<string, GateOp[]>;
};

export function scopeStorageKey(
  scope: Pick<StaffGateScope, 'tenantId' | 'eventId'>,
): string {
  return `${scope.tenantId}::${scope.eventId}`;
}

export function emptyStaffGateWorkspace(): StaffGateWorkspace {
  return { v: 2, selected: null, sessionsByScope: {}, opsByScope: {} };
}

export function sliceWorkspaceForScope(
  workspace: StaffGateWorkspace,
  scope: StaffGateScope | null,
): { ops: GateOp[]; sessionId: string | null } {
  if (!scope) return { ops: [], sessionId: null };
  const key = scopeStorageKey(scope);
  return {
    ops: recoverOps(workspace.opsByScope[key] ?? []),
    sessionId: workspace.sessionsByScope[key] ?? null,
  };
}

/** Flush in-memory scope slice before switching or saving. */
export function flushScopeIntoWorkspace(
  workspace: StaffGateWorkspace,
  scope: StaffGateScope,
  ops: readonly GateOp[],
  sessionId: string | null,
): StaffGateWorkspace {
  const key = scopeStorageKey(scope);
  const sessionsByScope = { ...workspace.sessionsByScope };
  if (sessionId) {
    sessionsByScope[key] = sessionId;
  } else {
    delete sessionsByScope[key];
  }
  return {
    ...workspace,
    opsByScope: {
      ...workspace.opsByScope,
      [key]: recoverOps([...ops]).slice(0, MAX_OPS_PER_SCOPE),
    },
    sessionsByScope,
  };
}

export function applyWorkspaceSelection(
  workspace: StaffGateWorkspace,
  next: StaffGateScope,
  currentScope: StaffGateScope | null,
  currentOps: readonly GateOp[],
  currentSessionId: string | null,
): StaffGateWorkspace {
  let nextWs = workspace;
  if (currentScope) {
    nextWs = flushScopeIntoWorkspace(
      nextWs,
      currentScope,
      currentOps,
      currentSessionId,
    );
  }
  return { ...nextWs, selected: next };
}

export function persistActiveScope(
  workspace: StaffGateWorkspace,
  scope: StaffGateScope,
  ops: readonly GateOp[],
  sessionId: string | null,
): StaffGateWorkspace {
  const flushed = flushScopeIntoWorkspace(workspace, scope, ops, sessionId);
  return { ...flushed, selected: scope };
}

export function opsForScope(
  ops: readonly GateOp[],
  scope: StaffGateScope | null,
): GateOp[] {
  if (!scope) return [];
  return ops.filter(
    (op) =>
      op.eventId === scope.eventId && op.tenantId === scope.tenantId,
  );
}

export function mergeMeEventsIntoWorkspace(
  workspace: StaffGateWorkspace,
  items: readonly MeEventItem[],
  persistedScope: StaffGateScope | null,
): { workspace: StaffGateWorkspace; scope: StaffGateScope | null } {
  const picked = pickStaffGateScope(items, persistedScope ?? workspace.selected);
  if (!picked) {
    return { workspace: { ...workspace, selected: null }, scope: null };
  }
  if (
    !workspace.selected ||
    !sameStaffGateScope(workspace.selected, picked)
  ) {
    return {
      workspace: { ...workspace, selected: picked },
      scope: picked,
    };
  }
  return {
    workspace: {
      ...workspace,
      selected: { ...picked, name: picked.name },
    },
    scope: picked,
  };
}
