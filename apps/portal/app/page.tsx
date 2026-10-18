'use client';

import { Button, Card, Typography } from 'antd';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadShellContext } from '../src/nav/load-shell-context';
import { SurfaceState } from '../src/components/surface-state';

/**
 * Home: redirect to first tenant when discovery returns one; else empty org.
 */
export default function PortalHomePage() {
  const router = useRouter();
  const [state, setState] = useState<
    'loading' | 'empty' | 'error' | 'redirecting'
  >('loading');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    void loadShellContext().then((shell) => {
      if (cancelled) return;
      if (shell.status === 'unauthenticated') {
        window.location.href = '/api/auth/login?return=/';
        return;
      }
      if (shell.status === 'error') {
        setState('error');
        setMessage(shell.message);
        return;
      }
      if (shell.status !== 'ready') {
        setState('loading');
        return;
      }
      const first = shell.meTenants?.items[0];
      if (first) {
        setState('redirecting');
        router.replace(`/t/${first.tenantId}`);
        return;
      }
      setState('empty');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === 'loading' || state === 'redirecting') {
    return <SurfaceState kind="loading" />;
  }
  if (state === 'error') {
    return (
      <SurfaceState
        kind="unknown"
        description={message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3}>Chưa có tổ chức</Typography.Title>
      <Typography.Paragraph>
        Tài khoản đã đăng nhập nhưng chưa được gán vào tổ chức nào. Liên hệ chủ
        tổ chức để nhận lời mời nhân sự (portal), không dùng luồng khách trên
        app.
      </Typography.Paragraph>
      <Button type="primary">
        <Link href="/account/security">Xem phiên đăng nhập</Link>
      </Button>
    </Card>
  );
}
