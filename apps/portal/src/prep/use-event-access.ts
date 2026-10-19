'use client';

import { useEffect, useState } from 'react';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { loadShellContext } from '../nav/load-shell-context';
import {
  tenantHasAdminChrome,
  tenantHasAnalytics,
} from '../nav/capabilities';
import type { MessageKey } from '../i18n/messages';

export type EventAccessState =
  | { kind: 'loading' }
  | { kind: 'error'; messageKey?: MessageKey }
  | { kind: 'permission-denied' }
  | {
      kind: 'ready';
      tenant: MeTenantItem;
      event: MeEventItem;
      permissions: readonly string[];
    };

export function useEventAccess(
  tenantId: string,
  eventId: string,
): EventAccessState {
  const [state, setState] = useState<EventAccessState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        window.location.href = `/api/auth/login?return=/t/${tenantId}/e/${eventId}`;
        return;
      }
      if (shell.status === 'error') {
        setState({ kind: 'error', messageKey: shell.messageKey });
        return;
      }
      if (shell.status !== 'ready') return;
      const tenant =
        shell.meTenants?.items.find((tenant) => tenant.tenantId === tenantId) ??
        null;
      const event =
        shell.meEvents?.items.find(
          (e) => e.tenantId === tenantId && e.eventId === eventId,
        ) ?? null;
      if (!tenant || !event || !tenantHasAdminChrome(tenant)) {
        setState({ kind: 'permission-denied' });
        return;
      }
      setState({
        kind: 'ready',
        tenant,
        event,
        permissions: event.permissions,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, eventId]);

  return state;
}

export type TenantAccessState =
  | { kind: 'loading' }
  | { kind: 'error'; messageKey?: MessageKey }
  | { kind: 'permission-denied' }
  | {
      kind: 'ready';
      tenant: MeTenantItem;
      events: MeEventItem[];
    };

export function useTenantAccess(tenantId: string): TenantAccessState {
  const [state, setState] = useState<TenantAccessState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        window.location.href = `/api/auth/login?return=/t/${tenantId}`;
        return;
      }
      if (shell.status === 'error') {
        setState({ kind: 'error', messageKey: shell.messageKey });
        return;
      }
      if (shell.status !== 'ready') return;
      const tenant =
        shell.meTenants?.items.find((tenant) => tenant.tenantId === tenantId) ??
        null;
      if (!tenant || !tenantHasAdminChrome(tenant)) {
        setState({ kind: 'permission-denied' });
        return;
      }
      const events =
        shell.meEvents?.items.filter((e) => e.tenantId === tenantId) ?? [];
      setState({ kind: 'ready', tenant, events });
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return state;
}

/**
 * P2 Analytics — membership + ≥1 event with report.read (assignment).
 * Deep-link without report.read → permission-denied (Result 403).
 */
export function useAnalyticsAccess(tenantId: string): TenantAccessState {
  const [state, setState] = useState<TenantAccessState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        window.location.href = `/api/auth/login?return=/t/${tenantId}/analytics`;
        return;
      }
      if (shell.status === 'error') {
        setState({ kind: 'error', messageKey: shell.messageKey });
        return;
      }
      if (shell.status !== 'ready') return;
      const tenant =
        shell.meTenants?.items.find((t) => t.tenantId === tenantId) ?? null;
      const events =
        shell.meEvents?.items.filter((e) => e.tenantId === tenantId) ?? [];
      if (!tenant || !tenantHasAnalytics(tenantId, events)) {
        setState({ kind: 'permission-denied' });
        return;
      }
      setState({ kind: 'ready', tenant, events });
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return state;
}
