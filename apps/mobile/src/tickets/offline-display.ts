/**
 * Local offline-display identity — separate from SessionBoundary verified/authz.
 *
 * Binding is written only after a successful online GET /v1/me verify.
 * It never elevates SessionBoundary to verified, never authorizes API calls,
 * and never treats UI-supplied userId / JWT claims as proof.
 */

import {
  offlineBindingWriteGate,
  type DurableWriteGate,
} from './durable-write-gate.ts';

export type OfflineDisplayBinding = {
  userId: string;
  tenantId: string;
};

export type OfflineDisplayState =
  | { status: 'unknown' }
  | { status: 'none' }
  | { status: 'bound'; userId: string; tenantId: string };

export type OfflineDisplayStore = {
  read(): Promise<OfflineDisplayBinding | null>;
  write(binding: OfflineDisplayBinding): Promise<void>;
  clear(): Promise<void>;
};

export function currentOfflineBindingWriteEpoch(): number {
  return offlineBindingWriteGate.current();
}

export function invalidateOfflineBindingWrites(): number {
  return offlineBindingWriteGate.invalidate();
}

export class OfflineDisplayBoundary {
  private state: OfflineDisplayState = { status: 'unknown' };
  private generation = 0;
  private listeners = new Set<() => void>();
  private store: OfflineDisplayStore;
  private gate: DurableWriteGate;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    store: OfflineDisplayStore,
    gate: DurableWriteGate = offlineBindingWriteGate,
  ) {
    this.store = store;
    this.gate = gate;
  }

  getSnapshot = (): OfflineDisplayState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(state: OfflineDisplayState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private storage<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Immediate fail-closed memory clear (does not touch durable store). */
  invalidateMemory(): void {
    this.generation += 1;
    this.publish({ status: 'none' });
  }

  /** Load durable binding into memory — does not touch SessionBoundary. */
  async hydrate(): Promise<OfflineDisplayState> {
    const generation = this.generation;
    const binding = await this.storage(() => this.store.read());
    if (generation !== this.generation) return this.state;
    if (!binding?.userId || !binding.tenantId) {
      this.publish({ status: 'none' });
      return this.state;
    }
    this.publish({
      status: 'bound',
      userId: binding.userId,
      tenantId: binding.tenantId,
    });
    return this.state;
  }

  /**
   * Record that this device previously completed online verify for user+tenant.
   * Call only after SessionBoundary is verified via GET /v1/me.
   *
   * If the write epoch is stale after awaiting store.write, only clear durable
   * storage when it still holds *this* binding — never wipe a newer account's
   * binding that replaced ours during the await.
   */
  /**
   * @param writeEpoch must be captured via gate.current() / currentOfflineBindingWriteEpoch()
   * BEFORE the preceding async restore/establish/fetch — never omit (no default) so a
   * post-logout gate.current() cannot silently resurrect a binding.
   */
  async bindAfterOnlineVerify(
    userId: string,
    tenantId: string,
    writeEpoch: number,
  ): Promise<boolean> {
    if (!userId || !tenantId) return false;
    if (!this.gate.isCurrent(writeEpoch)) return false;
    const generation = this.generation;
    const binding = { userId, tenantId };
    return this.storage(async () => {
      if (!this.gate.isCurrent(writeEpoch)) return false;
      if (generation !== this.generation) return false;
      await this.store.write(binding);
      if (!this.gate.isCurrent(writeEpoch)) {
        const current = await this.store.read();
        if (
          current?.userId === binding.userId &&
          current?.tenantId === binding.tenantId
        ) {
          await this.store.clear();
        }
        return false;
      }
      if (generation !== this.generation) return false;
      this.publish({ status: 'bound', userId, tenantId });
      return true;
    });
  }

  /**
   * Clear memory + durable binding. Propagates store deletion failures.
   * Callers should invalidateOfflineBindingWrites() before this on logout.
   */
  async clear(): Promise<void> {
    this.invalidateMemory();
    await this.storage(() => this.store.clear());
  }
}
