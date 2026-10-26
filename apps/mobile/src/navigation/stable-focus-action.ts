import { useCallback, useLayoutEffect, useRef } from 'react';

/** Keep the focus subscription stable while using the current owned workspace action. */
export function useStableFocusAction(action: () => Promise<void>): () => void {
  const actionRef = useRef(action);
  useLayoutEffect(() => {
    actionRef.current = action;
  }, [action]);
  return useCallback(() => {
    void actionRef.current();
  }, []);
}
