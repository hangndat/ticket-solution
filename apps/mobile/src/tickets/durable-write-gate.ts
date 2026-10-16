/** Monotonic write gate shared by durable ticket cache / offline binding. */
export type DurableWriteGate = {
  current(): number;
  invalidate(): number;
  isCurrent(epoch: number): boolean;
};

export function createDurableWriteGate(): DurableWriteGate {
  let epoch = 0;
  return {
    current: () => epoch,
    invalidate: () => {
      epoch += 1;
      return epoch;
    },
    isCurrent: (value) => value === epoch,
  };
}

export const ticketDisplayWriteGate = createDurableWriteGate();
export const offlineBindingWriteGate = createDurableWriteGate();
