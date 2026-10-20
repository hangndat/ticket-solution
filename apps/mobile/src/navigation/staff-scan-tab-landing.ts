type Listener = () => void;

/**
 * NativeTabs lists Manual first; `router.replace('/(tabs)/staff-scan')` alone often
 * re-mounts tabs on Manual. Redirect consumes this after pop/replace from root stacks.
 */
let pendingScanLanding = false;
const listeners = new Set<Listener>();

export function subscribeStaffScanTabLanding(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function peekStaffScanTabLanding(): boolean {
  return pendingScanLanding;
}

export function requestStaffScanTabLanding(): void {
  pendingScanLanding = true;
  for (const listener of listeners) listener();
}

export function clearStaffScanTabLanding(): void {
  if (!pendingScanLanding) return;
  pendingScanLanding = false;
  for (const listener of listeners) listener();
}

export function consumeStaffScanTabLanding(): boolean {
  if (!pendingScanLanding) return false;
  pendingScanLanding = false;
  for (const listener of listeners) listener();
  return true;
}
