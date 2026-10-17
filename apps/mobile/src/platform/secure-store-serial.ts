/**
 * Serialize all expo-secure-store access process-wide.
 * Concurrent Keychain calls on iOS Simulator can wedge forever; SessionBoundary
 * already queues identity ops — gate/display stores must join the same line.
 */
let chain: Promise<unknown> = Promise.resolve();

export function serialSecureStore<T>(operation: () => Promise<T>): Promise<T> {
  const result = chain.then(operation);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
