'use client';

import { useCallback, useState } from 'react';
import {
  reuseUnclearKey,
  type UnclearAttempt,
} from './idempotent-action';

export function useIdempotentAction() {
  const [attempt, setAttempt] = useState<UnclearAttempt | null>(null);

  const keyFor = useCallback(
    (fingerprint: string) => reuseUnclearKey(attempt, fingerprint),
    [attempt],
  );

  const remember = useCallback(
    (key: string, fingerprint: string, unclear: boolean) => {
      setAttempt({ key, fingerprint, unclear });
    },
    [],
  );

  return { keyFor, remember };
}
