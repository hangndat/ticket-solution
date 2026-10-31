'use client';

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { actorCommitAllowed, actorGeneration } from './actor-gate';

/** Drop state writes from a mounted panel after callback/logout changes the actor. */
export function useActorState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
export function useActorState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
export function useActorState<S>(initialState?: S | (() => S)) {
  const [state, setState] = useState(initialState);
  const mountedGeneration = useRef(actorGeneration());
  const setIfCurrent = useCallback<Dispatch<SetStateAction<S | undefined>>>((value) => {
    if (actorCommitAllowed(mountedGeneration.current)) setState(value);
  }, []);
  return [state, setIfCurrent] as const;
}
