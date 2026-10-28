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
  /** O32: gate chosen when the scope's session was opened (id only; name comes from the gates API). */
  sessionGateByScope?: Record<string, { sessionId: string; gateId: string }>;
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
): { ops: GateOp[]; sessionId: string | null; gateId: string | null } {
  if (!scope) return { ops: [], sessionId: null, gateId: null };
  const key = scopeStorageKey(scope);
  const sessionId = workspace.sessionsByScope[key] ?? null;
  return {
    ops: recoverOps(workspace.opsByScope[key] ?? []),
    sessionId,
    gateId: gateIdForSession(workspace, scope, sessionId),
  };
}

/** Gate id persisted with this exact session, else null. */
export function gateIdForSession(
  workspace: StaffGateWorkspace,
  scope: Pick<StaffGateScope, 'tenantId' | 'eventId'>,
  sessionId: string | null,
): string | null {
  if (!sessionId) return null;
  const entry = workspace.sessionGateByScope?.[scopeStorageKey(scope)];
  return entry && entry.sessionId === sessionId ? entry.gateId : null;
}

/** Record (or clear when gateId is null) the gate of an opened session. */
export function recordSessionGate(
  workspace: StaffGateWorkspace,
  scope: Pick<StaffGateScope, 'tenantId' | 'eventId'>,
  sessionId: string,
  gateId: string | null,
): StaffGateWorkspace {
  const key = scopeStorageKey(scope);
  const next = { ...(workspace.sessionGateByScope ?? {}) };
  if (gateId) next[key] = { sessionId, gateId };
  else delete next[key];
  return { ...workspace, sessionGateByScope: next };
}

/** Resolve the display name from the API gates list (source of truth). */
export function gateNameFromList(
  gates: ReadonlyArray<{ id: string; name: string }>,
  gateId: string | null,
): string | null {
  if (!gateId) return null;
  return gates.find((g) => g.id === gateId)?.name ?? null;
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
  // The recorded gate only survives while it still belongs to the live session.
  let sessionGateByScope = workspace.sessionGateByScope;
  if (sessionGateByScope?.[key] && sessionGateByScope[key].sessionId !== sessionId) {
    sessionGateByScope = { ...sessionGateByScope };
    delete sessionGateByScope[key];
  }
  return {
    ...workspace,
    ...(sessionGateByScope ? { sessionGateByScope } : {}),
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
