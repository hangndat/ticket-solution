import type { StaffGateWorkspace } from './staff-gate-workspace.ts';
import type { GateKeychainIndex } from './gate-keychain-index.ts';

export type GateOwnerJournal = {
  v: 1;
  lastVerifiedUserId: string | null;
  pendingPurgeUserIds: string[];
};

export type GateOwnershipDeps = {
  readJournal(): Promise<string | null>;
  writeJournal(raw: string): Promise<void>;
  list(): Promise<GateKeychainIndex>;
  deletePartition(userId: string): Promise<void>;
  deleteLegacy(): Promise<void>;
  load(userId: string): Promise<StaffGateWorkspace>;
  save(userId: string, workspace: StaffGateWorkspace, shouldWrite: () => boolean): Promise<void>;
  invalidate(userId: string, generation?: number): void;
  allow(userId: string, generation?: number): void;
};

export function parseGateOwnerJournal(raw: string | null): GateOwnerJournal {
  if (raw === null) return { v: 1, lastVerifiedUserId: null, pendingPurgeUserIds: [] };
  let row: unknown;
  try { row = JSON.parse(raw); } catch { throw new Error('Dữ liệu chủ sở hữu cổng bị lỗi. Vui lòng thử lại.'); }
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Dữ liệu chủ sở hữu cổng bị lỗi. Vui lòng thử lại.');
  const value = row as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== 'lastVerifiedUserId,pendingPurgeUserIds,v' || value.v !== 1 ||
      !(value.lastVerifiedUserId === null || (typeof value.lastVerifiedUserId === 'string' && !!value.lastVerifiedUserId)) ||
      !Array.isArray(value.pendingPurgeUserIds) ||
      value.pendingPurgeUserIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(value.pendingPurgeUserIds).size !== value.pendingPurgeUserIds.length) {
    throw new Error('Dữ liệu chủ sở hữu cổng bị lỗi. Vui lòng thử lại.');
  }
  return value as GateOwnerJournal;
}

function users(index: GateKeychainIndex): Set<string> {
  return new Set([...index.workspaceUserIds, ...index.scopeUserIds, ...index.queueUserIds]);
}

/** One process-wide queue. Rejections reach callers; only the queue tail recovers. */
export function createDurableGateOwnership(deps: GateOwnershipDeps) {
  let tail: Promise<unknown> = Promise.resolve();
  let readyOwner: string | null = null;
  let blocked = false;
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
  const writeConfirmed = async (journal: GateOwnerJournal) => {
    await deps.writeJournal(JSON.stringify(journal));
    const raw = await deps.readJournal();
    if (raw === null) throw new Error('Chưa xác nhận lưu trạng thái cổng. Vui lòng thử lại.');
    const readback = parseGateOwnerJournal(raw);
    if (JSON.stringify(readback) !== JSON.stringify(journal)) {
      throw new Error('Chưa xác nhận lưu trạng thái cổng. Vui lòng thử lại.');
    }
  };
  const deleteAndCheck = async (ids: Set<string>, legacy: boolean) => {
    for (const id of ids) await deps.deletePartition(id);
    if (legacy) await deps.deleteLegacy();
    const after = await deps.list();
    if ([...ids].some((id) => users(after).has(id)) || after.legacyOpsPresent) {
      throw new Error('Chưa xác nhận xóa dữ liệu cổng. Vui lòng thử lại.');
    }
  };
  const prepareVerified = (userId: string, generation?: number, isCurrent: () => boolean = () => true) => {
    if (!userId) return Promise.reject(new Error('Chưa xác minh tài khoản cổng.'));
    if (!isCurrent()) return Promise.reject(new Error('Phiên đăng nhập đã đổi. Vui lòng thử lại.'));
    readyOwner = null;
    blocked = true;
    return serial(async () => {
      try {
        if (!isCurrent()) throw new Error('Phiên đăng nhập đã đổi. Vui lòng thử lại.');
        const journal = parseGateOwnerJournal(await deps.readJournal());
        const index = await deps.list();
        const pending = new Set(journal.pendingPurgeUserIds);
        if (journal.lastVerifiedUserId && journal.lastVerifiedUserId !== userId) pending.add(journal.lastVerifiedUserId);
        for (const id of users(index)) if (id !== userId) pending.add(id);
        await writeConfirmed({ v: 1, lastVerifiedUserId: journal.lastVerifiedUserId, pendingPurgeUserIds: [...pending].sort() });
        await deleteAndCheck(pending, index.legacyOpsPresent);
        if (!isCurrent()) throw new Error('Phiên đăng nhập đã đổi. Vui lòng thử lại.');
        await writeConfirmed({ v: 1, lastVerifiedUserId: userId, pendingPurgeUserIds: [] });
        if (!isCurrent()) throw new Error('Phiên đăng nhập đã đổi. Vui lòng thử lại.');
        readyOwner = userId;
        blocked = false;
        deps.allow(userId, generation);
      } catch (error) {
        blocked = true;
        throw error;
      }
    });
  };
  const beginLogout = (userId: string | null, generation: number | undefined, cleanup: () => Promise<void>) => {
    if (userId) deps.invalidate(userId, generation);
    readyOwner = null;
    blocked = true;
    return serial(async () => {
      const journal = parseGateOwnerJournal(await deps.readJournal());
      const index = await deps.list();
      const pending = new Set(journal.pendingPurgeUserIds);
      if (userId) pending.add(userId);
      if (!userId) {
        if (journal.lastVerifiedUserId) pending.add(journal.lastVerifiedUserId);
        for (const id of users(index)) pending.add(id);
      }
      await writeConfirmed({ v: 1, lastVerifiedUserId: journal.lastVerifiedUserId, pendingPurgeUserIds: [...pending].sort() });
      await deleteAndCheck(pending, index.legacyOpsPresent);
      await cleanup();
      await writeConfirmed({ v: 1, lastVerifiedUserId: null, pendingPurgeUserIds: [] });
      blocked = false;
    });
  };
  const load = (userId: string) => serial(async () => {
    if (blocked || readyOwner !== userId) throw new Error('Dữ liệu cổng chưa sẵn sàng. Vui lòng thử lại.');
    const journal = parseGateOwnerJournal(await deps.readJournal());
    if (journal.lastVerifiedUserId !== userId || journal.pendingPurgeUserIds.length) throw new Error('Dữ liệu cổng chưa sẵn sàng. Vui lòng thử lại.');
    return deps.load(userId);
  });
  const save = (userId: string, workspace: StaffGateWorkspace, shouldWrite: () => boolean) => serial(async () => {
    if (blocked || readyOwner !== userId || !shouldWrite()) return;
    const journal = parseGateOwnerJournal(await deps.readJournal());
    if (journal.lastVerifiedUserId !== userId || journal.pendingPurgeUserIds.length) throw new Error('Dữ liệu cổng chưa sẵn sàng. Vui lòng thử lại.');
    await deps.save(userId, workspace, shouldWrite);
  });
  const runForOwner = <T>(userId: string, task: () => Promise<T>): Promise<T> => serial(async () => {
    if (blocked || readyOwner !== userId) throw new Error('Dữ liệu cổng chưa sẵn sàng. Vui lòng thử lại.');
    const journal = parseGateOwnerJournal(await deps.readJournal());
    if (journal.lastVerifiedUserId !== userId || journal.pendingPurgeUserIds.length) throw new Error('Dữ liệu cổng chưa sẵn sàng. Vui lòng thử lại.');
    return task();
  });
  return { serial, runForOwner, prepareVerified, beginLogout, load, save, getState: () => ({ readyOwner, blocked }) };
}
