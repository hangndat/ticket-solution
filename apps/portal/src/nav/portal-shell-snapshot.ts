'use client';

import type { ShellLoadState } from './load-shell-context';

let snapshot: ShellLoadState = { status: 'loading' };
const listeners = new Set<() => void>();

export function getPortalShellSnapshot(): ShellLoadState {
  return snapshot;
}

export function subscribePortalShellSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishPortalShellSnapshot(next: ShellLoadState): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function markPortalShellLoading(): void {
  publishPortalShellSnapshot({ status: 'loading' });
}

/** Test-only reset */
export function resetPortalShellSnapshotForTests(): void {
  snapshot = { status: 'loading' };
  listeners.clear();
}
