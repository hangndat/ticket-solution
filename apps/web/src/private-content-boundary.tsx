'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@ticket/ui';
import { PrivateContentTrust, type PrivateTrustState } from './private-content-trust';
import { SurfaceState } from './ui/surface-state';

export function isPrivateConsumerPath(pathname: string): boolean {
  return (
    /^\/(wallet|account|redeem|claim|invite)(\/|$)/.test(pathname) ||
    /^\/t\/[^/]+\/tickets\/[^/]+(?:\/|$)/.test(pathname)
  );
}

async function readCurrentSubject(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch('/api/bff/me', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error('identity unavailable');
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Error('identity malformed');
    }
    const subject = (body as Record<string, unknown>).subject;
    if (typeof subject !== 'string' || !subject.trim()) {
      throw new Error('identity missing subject');
    }
    return subject.trim();
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Isolates every consumer page that can contain account or ticket data. */
export function PrivateContentBoundary({
  children,
  initialSubject,
}: {
  children?: ReactNode;
  initialSubject: string | null;
}) {
  const pathname = usePathname() ?? '/';
  const privateRoute = isPrivateConsumerPath(pathname);
  const host = useRef<HTMLDivElement>(null);
  const route = useRef(pathname);
  const epoch = useRef(0);
  const shownPrivate = useRef(false);
  const controller = useRef<PrivateContentTrust | null>(null);
  const [routeState, setRouteState] = useState({ pathname, epoch: 0 });
  if (routeState.pathname !== pathname) {
    setRouteState({ pathname, epoch: routeState.epoch + 1 });
  }
  const [trust, setTrust] = useState<{
    state: PrivateTrustState;
    epoch: number;
  }>({ state: 'pending', epoch: -1 });

  useLayoutEffect(() => {
    route.current = pathname;
    epoch.current = routeState.epoch;
  }, [pathname, routeState.epoch]);

  useLayoutEffect(() => {
    const current = new PrivateContentTrust({
      initialSubject,
      readSubject: readCurrentSubject,
      context: () => epoch.current,
      mask: () => {
        // Browser events run before React's commit. Hide the already painted
        // private tree synchronously so no old ticket frame can reappear.
        if (shownPrivate.current && isPrivateConsumerPath(route.current) && host.current) {
          host.current.style.visibility = 'hidden';
        }
      },
      publish: (state, currentEpoch) => setTrust({ state, epoch: currentEpoch }),
      reload: () => window.location.reload(),
    });
    controller.current = current;
    const unbind = current.bind(
      window, document, () => document.visibilityState === 'visible',
    );
    return () => {
      unbind();
      controller.current = null;
    };
  }, [initialSubject]);

  useLayoutEffect(() => {
    // Route changes can commit prefetched RSC. Keep the new private route
    // behind the boundary until a fresh no-store identity probe completes.
    void controller.current?.verify();
  }, [pathname, routeState.epoch, initialSubject]);

  useLayoutEffect(() => {
    if (host.current) host.current.style.visibility = '';
    shownPrivate.current = privateRoute &&
      trust.state === 'verified' && trust.epoch === routeState.epoch;
  }, [trust, privateRoute, routeState.epoch]);

  const verified =
    trust.state === 'verified' && trust.epoch === routeState.epoch;
  return (
    <div ref={host} className="min-w-0 w-full flex-1" data-testid="consumer-private-boundary">
      {!privateRoute || verified ? children : (
        <main id="main" className="mx-auto min-h-[40vh] w-full max-w-5xl px-5 py-12">
          {trust.state === 'error' ? (
            <SurfaceState
              kind="error"
              title="Không xác minh được phiên"
              detail="Vui lòng thử lại để xem nội dung tài khoản của bạn."
              testId="consumer-private-error"
              action={
                <Button type="button" variant="attendeePrimary" onClick={() => void controller.current?.verify()}>
                  Thử lại
                </Button>
              }
            />
          ) : (
            <SurfaceState
              kind="loading"
              title="Đang xác minh phiên…"
              testId="consumer-private-pending"
            />
          )}
        </main>
      )}
    </div>
  );
}
