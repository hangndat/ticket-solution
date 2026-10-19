'use client';

import { Alert, Button, Empty, Result } from 'antd';
import type { ReactNode } from 'react';
import { usePortalLocale } from '../i18n';

function LoadingSurface({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="portal-surface-loading"
      suppressHydrationWarning
    >
      <div className="portal-surface-loading__spinner" aria-hidden />
      <p className="portal-surface-loading__label">{label}</p>
    </div>
  );
}

export type SurfaceKind =
  | 'loading'
  | 'empty'
  | 'ready'
  | 'error'
  | 'unknown'
  | 'permission-denied'
  | 'suspended'
  | 'pending-activation';

export function SurfaceState(props: {
  kind: SurfaceKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  emptyAction?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = usePortalLocale();
  switch (props.kind) {
    case 'loading':
      return <LoadingSurface label={t('surface.loading')} />;
    case 'empty':
      return (
        <Empty
          description={props.description ?? t('surface.empty.default')}
          style={{ padding: 48 }}
        >
          {props.emptyAction}
        </Empty>
      );
    case 'error':
      return (
        <Alert
          type="error"
          showIcon
          message={props.title ?? t('surface.error.loadFailed')}
          description={props.description}
          action={
            props.onRetry ? (
              <Button size="small" onClick={props.onRetry}>
                {t('surface.action.retry')}
              </Button>
            ) : undefined
          }
          style={{ margin: 24 }}
        />
      );
    case 'unknown':
      return (
        <Alert
          type="warning"
          showIcon
          message={props.title ?? t('surface.unknown.title')}
          description={
            props.description ?? t('surface.unknown.defaultDescription')
          }
          action={
            props.onRetry ? (
              <Button size="small" onClick={props.onRetry}>
                {t('surface.action.recheck')}
              </Button>
            ) : undefined
          }
          style={{ margin: 24 }}
        />
      );
    case 'permission-denied':
      return (
        <Result
          status="403"
          title={props.title ?? t('surface.permission.title')}
          subTitle={
            props.description ?? t('surface.permission.defaultDescription')
          }
          extra={
            props.emptyAction ??
            (props.onRetry ? (
              <Button type="primary" onClick={props.onRetry}>
                {t('surface.permission.goAllowed')}
              </Button>
            ) : undefined)
          }
        />
      );
    case 'suspended':
      return (
        <Alert
          type="error"
          showIcon
          banner
          message={props.title ?? t('surface.suspended.title')}
          description={props.description ?? t('surface.suspended.description')}
        />
      );
    case 'pending-activation':
      return (
        <Result
          status="info"
          title={props.title ?? t('surface.pendingActivation.title')}
          subTitle={
            props.description ?? t('surface.pendingActivation.description')
          }
          extra={props.emptyAction}
        />
      );
    case 'ready':
    default:
      return <>{props.children}</>;
  }
}
