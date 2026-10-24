import { recoverOps, type GateOp } from './gate-scan.ts';
import { emptyStaffGateWorkspace, type StaffGateWorkspace } from './staff-gate-workspace.ts';
import type { StaffGateScope } from './staff-gate-events.ts';

const PREFIX = 'ticket.gate.workspace.v2.';
const LEGACY = 'ticket.gate.ops.v1';
const LEGACY_SCOPE_PREFIX = 'ticket.staff.gate.scope.v1.';

export type GateWorkspaceStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

function parseWorkspace(raw: string | null): StaffGateWorkspace | null {
  if (!raw) return null;
  try {
    const row = JSON.parse(raw) as Record<string, unknown>;
    if (!row || row.v !== 2) return null;
    const selected = row.selected as Record<string, unknown> | null;
    const scope: StaffGateScope | null = selected &&
      typeof selected.tenantId === 'string' &&
      typeof selected.eventId === 'string' &&
      typeof selected.name === 'string'
      ? { tenantId: selected.tenantId, eventId: selected.eventId, name: selected.name }
      : null;
    const sessionsByScope: Record<string, string> = {};
    if (row.sessionsByScope && typeof row.sessionsByScope === 'object') {
      for (const [key, value] of Object.entries(row.sessionsByScope)) {
        if (typeof value === 'string') sessionsByScope[key] = value;
      }
    }
    const opsByScope: Record<string, GateOp[]> = {};
    if (row.opsByScope && typeof row.opsByScope === 'object') {
      for (const [key, value] of Object.entries(row.opsByScope)) {
        if (Array.isArray(value)) opsByScope[key] = recoverOps(value as GateOp[]);
      }
    }
    return { v: 2, selected: scope, sessionsByScope, opsByScope };
  } catch {
    return null;
  }
}

/** The app and tests use the same writer and purge implementation. */
export function createGateWorkspaceStore(
  storage: GateWorkspaceStorage,
  readLegacyScope: (userId: string) => Promise<StaffGateScope | null>,
) {
  const writes = new Map<string, Promise<void>>();
  const generations = new Map<string, number>();
  const blocked = new Set<string>();
  const blockedSessionGenerations = new Map<string, number>();
  const purges = new Map<string, Promise<void>>();
  const pendingAllows = new Map<string, number | undefined>();
  const failedPurges = new Set<string>();
  const invalidationListeners = new Set<(userId: string) => void>();
  const key = (userId: string) => `${PREFIX}${userId}`;
  const generation = (userId: string) => generations.get(userId) ?? 0;
  const current = (userId: string, value: number) => !blocked.has(userId) && generation(userId) === value;
  const invalidate = (userId: string, sessionGeneration?: number) => {
    if (!userId) return;
    generations.set(userId, generation(userId) + 1);
    blocked.add(userId);
    if (sessionGeneration !== undefined) blockedSessionGenerations.set(userId, sessionGeneration);
    for (const listener of invalidationListeners) {
      try { listener(userId); } catch { /* a view listener cannot cancel the durable purge */ }
    }
  };
  const subscribeInvalidation = (listener: (userId: string) => void) => {
    invalidationListeners.add(listener);
    return () => { invalidationListeners.delete(listener); };
  };
  const allow = (userId: string, sessionGeneration?: number) => {
    const blockedGeneration = blockedSessionGenerations.get(userId);
    if (blockedGeneration !== undefined && blockedGeneration === sessionGeneration) return;
    if (purges.has(userId)) {
      pendingAllows.set(userId, sessionGeneration);
      return;
    }
    if (failedPurges.has(userId)) return;
    blocked.delete(userId);
    blockedSessionGenerations.delete(userId);
  };
  const serialize = (userId: string, task: () => Promise<void>) => {
    const next = (writes.get(userId) ?? Promise.resolve()).catch(() => undefined).then(task);
    writes.set(userId, next);
    void next.finally(() => {
      if (writes.get(userId) === next) writes.delete(userId);
    }).catch(() => undefined);
    return next;
  };
  const awaitPurge = async (userId: string) => {
    // A second logout can extend the transaction while the first cleanup is
    // pending. Both loads and saves must wait for the latest barrier.
    while (purges.has(userId)) {
      await purges.get(userId)?.catch(() => undefined);
    }
  };
  const load = async (userId: string): Promise<StaffGateWorkspace> => {
    if (!userId) return emptyStaffGateWorkspace();
    await awaitPurge(userId);
    const value = generation(userId);
    const parsed = parseWorkspace(await storage.getItemAsync(key(userId)));
    if (!current(userId, value)) return emptyStaffGateWorkspace();
    if (parsed) return parsed;
    const scope = await readLegacyScope(userId);
    if (!current(userId, value)) return emptyStaffGateWorkspace();
    // V1 operations have no verified owner. Drop them, including on cold start.
    await storage.deleteItemAsync(LEGACY);
    return current(userId, value) ? { ...emptyStaffGateWorkspace(), selected: scope } : emptyStaffGateWorkspace();
  };
  const save = (userId: string, workspace: StaffGateWorkspace, shouldWrite: () => boolean = () => true) => {
    if (!userId || (blocked.has(userId) && !pendingAllows.has(userId))) return Promise.resolve();
    const value = generation(userId);
    const bytes = JSON.stringify(workspace);
    const write = () => serialize(userId, async () => {
      if (current(userId, value) && shouldWrite()) await storage.setItemAsync(key(userId), bytes);
    });
    return purges.has(userId) ? awaitPurge(userId).then(write) : write();
  };
  const trackPurge = (userId: string, purge: Promise<void>) => {
    purges.set(userId, purge);
    void purge.then(() => {
      if (purges.get(userId) !== purge) return;
      purges.delete(userId);
      failedPurges.delete(userId);
      if (pendingAllows.has(userId)) {
        const allowedGeneration = pendingAllows.get(userId);
        pendingAllows.delete(userId);
        allow(userId, allowedGeneration);
      }
    }, () => {
      if (purges.get(userId) !== purge) return;
      purges.delete(userId);
      pendingAllows.delete(userId);
      failedPurges.add(userId);
    });
  };
  const beginPurge = (userId: string, sessionGeneration?: number, beforeDelete?: () => Promise<void>): Promise<void> => {
    // Install the fence before the caller's first await. Concurrent logout
    // callers share the delete and cannot invalidate a new session twice.
    const existing = userId ? purges.get(userId) : undefined;
    if (existing) {
      // A verified switch to B may reach here after A briefly reauthenticated.
      // That newer A session is no longer allowed to reopen the partition.
      pendingAllows.delete(userId);
      if (sessionGeneration !== undefined && blockedSessionGenerations.get(userId) !== sessionGeneration) {
        invalidate(userId, sessionGeneration);
      }
      if (!beforeDelete) return existing;
      const extended = existing.then(
        () => beforeDelete(),
        async (error: unknown) => { await beforeDelete(); throw error; },
      );
      trackPurge(userId, extended);
      return extended;
    }
    if (userId) invalidate(userId, sessionGeneration);
    const purge = (async () => {
      const errors: unknown[] = [];
      try {
        if (beforeDelete) await Promise.resolve().then(beforeDelete);
      } catch (error) {
        errors.push(error);
      }
      try {
        if (userId) await serialize(userId, () => storage.deleteItemAsync(key(userId)));
      } catch (error) {
        errors.push(error);
      }
      try {
        if (userId) await storage.deleteItemAsync(`${LEGACY_SCOPE_PREFIX}${userId}`);
      } catch (error) {
        errors.push(error);
      }
      try {
        await storage.deleteItemAsync(LEGACY);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new Error(`Gate purge failed (${errors.length} steps)`);
    })();
    if (userId) trackPurge(userId, purge);
    return purge;
  };
  const clear = (userId: string) => beginPurge(userId);
  return { load, save, clear, beginPurge, invalidate, allow, generation, current, subscribeInvalidation };
}
