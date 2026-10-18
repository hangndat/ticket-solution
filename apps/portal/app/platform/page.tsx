'use client';

import { Alert, Button, Card, Result, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { loadShellContext } from '../../src/nav/load-shell-context';
import { SurfaceState } from '../../src/components/surface-state';

function PlatformInner() {
  const params = useSearchParams();
  const error = params.get('error');
  const [kind, setKind] = useState<
    'loading' | 'ready' | 'denied' | 'error' | 'unsigned'
  >('loading');
  const [assurance, setAssurance] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    void loadShellContext().then((shell) => {
      if (shell.status === 'error') {
        setKind('error');
        setMessage(shell.message);
        return;
      }
      if (shell.status !== 'ready') {
        setKind('unsigned');
        return;
      }
      if (!shell.platformMe?.operator) {
        setKind('denied');
        return;
      }
      setAssurance(shell.platformMe.assurance);
      setKind('ready');
    });
  }, []);

  if (error) {
    return (
      <Result
        status="error"
        title="Đăng nhập Platform thất bại"
        subTitle={error}
        extra={
          <Button type="primary" href="/api/auth/platform/login">
            Thử lại Platform login
          </Button>
        }
      />
    );
  }

  if (kind === 'loading') return <SurfaceState kind="loading" />;
  if (kind === 'error') {
    return (
      <SurfaceState
        kind="unknown"
        description={message}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (kind === 'unsigned') {
    return (
      <Card>
        <Typography.Title level={3}>Platform Operator</Typography.Title>
        <Typography.Paragraph>
          Vùng Platform dùng client/audience/cookie riêng — không dùng token
          nhân sự.
        </Typography.Paragraph>
        <Button type="primary" href="/api/auth/platform/login">
          Đăng nhập Platform
        </Button>
      </Card>
    );
  }
  if (kind === 'denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        title="Không phải Platform Operator"
        description="Tài khoản staff tenant không thấy menu Platform. Cần phiên Operator riêng."
        onRetry={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Platform
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={`Operator đã xác nhận · assurance=${assurance}`}
      />
      <Typography.Paragraph>
        Shell nền tảng P1.1 — danh sách tenant / limits sẽ nối API sẵn có ở sóng
        tiếp. Token staff không được tái dùng tại đây.
      </Typography.Paragraph>
      <Button danger href="/api/auth/platform/logout">
        Đăng xuất Platform
      </Button>
    </Card>
  );
}

export default function PlatformPage() {
  return (
    <Suspense fallback={<SurfaceState kind="loading" />}>
      <PlatformInner />
    </Suspense>
  );
}
