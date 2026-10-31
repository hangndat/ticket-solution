'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type WebActorIdentity = {
  actorId: string;
  authEpoch: string;
  surface: 'web-attendee';
};

export type PrivateView<T> =
  | { status: 'loading' | 'unauthenticated' | 'unreachable' | 'forbidden' | 'not-found' | 'invalid' | 'tenant-unresolved' }
  | { status: 'ready'; value: T };

export class StaleActorResponse extends Error {}

export function currentWebMarker(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split('; ')
    .find((part) => part.startsWith('web_auth_marker='));
  const value = entry?.slice('web_auth_marker='.length) ?? '';
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export async function fetchBoundJson(
  url: string,
  identity: WebActorIdentity,
  signal: AbortSignal,
  isCurrent: () => boolean,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!isCurrent()) throw new StaleActorResponse();
  if (
    response.headers.get('X-Actor-Id') !== identity.actorId ||
    response.headers.get('X-Auth-Epoch') !== identity.authEpoch ||
    response.headers.get('X-Auth-Surface') !== identity.surface
  ) {
    throw new StaleActorResponse();
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON response is rejected by the caller's parser.
  }
  if (!isCurrent()) throw new StaleActorResponse();
  return { status: response.status, body };
}

export function useWebActorData<T>(
  loader: (
    identity: WebActorIdentity,
    signal: AbortSignal,
    isCurrent: () => boolean,
  ) => Promise<PrivateView<T>>,
): PrivateView<T> {
  const [view, setView] = useState<PrivateView<T>>({ status: 'loading' });
  const [committedEpoch, setCommittedEpoch] = useState<string | null>(null);
  const [retrySequence, setRetrySequence] = useState(0);
  const generation = useRef(0);
  const marker = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    const run = ++generation.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    marker.current = currentWebMarker();
    setCommittedEpoch(null);
    setView({ status: 'loading' });
    const isCurrent = () =>
      generation.current === run &&
      !nextController.signal.aborted &&
      currentWebMarker() === marker.current;

    void (async () => {
      try {
        const response = await fetch('/api/auth/identity', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: nextController.signal,
        });
        if (!isCurrent()) throw new StaleActorResponse();
        if (response.status === 401 || response.status === 403) {
          setView({ status: 'unauthenticated' });
          return;
        }
        if (!response.ok) {
          setView({ status: 'unreachable' });
          return;
        }
        const raw = (await response.json()) as Partial<WebActorIdentity>;
        if (!isCurrent()) throw new StaleActorResponse();
        if (
          !raw.actorId ||
          !raw.authEpoch ||
          raw.surface !== 'web-attendee' ||
          raw.authEpoch !== marker.current
        ) {
          setView({ status: 'unauthenticated' });
          return;
        }
        const identity = raw as WebActorIdentity;
        const result = await loader(identity, nextController.signal, isCurrent);
        if (!isCurrent()) throw new StaleActorResponse();
        setCommittedEpoch(identity.authEpoch);
        setView(result);
      } catch (error) {
        if (generation.current !== run || nextController.signal.aborted) return;
        if (error instanceof StaleActorResponse && currentWebMarker() !== marker.current) {
          setRetrySequence((value) => value + 1);
          return;
        }
        setView({ status: error instanceof StaleActorResponse ? 'unauthenticated' : 'unreachable' });
      }
    })();
  }, [loader]);

  useEffect(() => {
    const generationRef = generation;
    const controllerRef = controller;
    let active = true;
    queueMicrotask(() => { if (active) start(); });
    const onCheckpoint = () => start();
    const onVisible = () => {
      if (document.visibilityState === 'visible') start();
    };
    const onLogout = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('a[href^="/api/auth/logout"]')) {
        ++generation.current;
        controller.current?.abort();
        setView({ status: 'loading' });
      }
    };
    const interval = window.setInterval(() => {
      if (currentWebMarker() !== marker.current) start();
    }, 250);
    window.addEventListener('pageshow', onCheckpoint);
    window.addEventListener('focus', onCheckpoint);
    window.addEventListener('popstate', onCheckpoint);
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('click', onLogout, true);
    return () => {
      active = false;
      ++generationRef.current;
      controllerRef.current?.abort();
      window.clearInterval(interval);
      window.removeEventListener('pageshow', onCheckpoint);
      window.removeEventListener('focus', onCheckpoint);
      window.removeEventListener('popstate', onCheckpoint);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('click', onLogout, true);
    };
  }, [start, retrySequence]);

  return view.status === 'ready' && currentWebMarker() !== committedEpoch
    ? { status: 'loading' }
    : view;
}
