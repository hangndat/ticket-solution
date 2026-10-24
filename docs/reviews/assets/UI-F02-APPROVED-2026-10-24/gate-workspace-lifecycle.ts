/**
 * Serializes gate workspace mount + foreground AppState work on one chain.
 * Generation bumps invalidate in-flight steps after await boundaries.
 */

export type LifecycleGenerationRef = { current: number };
export type LifecycleChainRef = { current: Promise<void> };

export function isGateWorkspaceLifecycleCurrent(
  generationRef: LifecycleGenerationRef,
  lifecycleToken: number,
): boolean {
  return generationRef.current === lifecycleToken;
}

export function invalidateGateWorkspaceLifecycle(
  generationRef: LifecycleGenerationRef,
): number {
  generationRef.current += 1;
  return generationRef.current;
}

/**
 * Queue async work behind prior mount/foreground steps. Each step captures
 * `lifecycleToken` at schedule time; bumps drop remaining work in that step.
 */
export function scheduleGateWorkspaceLifecycleWork(
  generationRef: LifecycleGenerationRef,
  chainRef: LifecycleChainRef,
  work: (lifecycleToken: number) => Promise<void>,
): Promise<void> {
  const lifecycleToken = generationRef.current;
  const step = async () => {
    if (!isGateWorkspaceLifecycleCurrent(generationRef, lifecycleToken)) return;
    await work(lifecycleToken);
  };
  chainRef.current = chainRef.current.catch(() => undefined).then(step);
  return chainRef.current;
}

/**
 * Await hydrate/load, then apply only if lifecycle generation still matches.
 * Prevents user-A workspace bytes from landing in memory after user switch.
 */
export async function loadWorkspaceWithLifecycleGuard<T>(
  generationRef: LifecycleGenerationRef,
  lifecycleToken: number,
  load: () => Promise<T>,
): Promise<T | null> {
  const loaded = await load();
  if (!isGateWorkspaceLifecycleCurrent(generationRef, lifecycleToken)) {
    return null;
  }
  return loaded;
}
