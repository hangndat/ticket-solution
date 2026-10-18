'use client';

import { Button, Card, Descriptions, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { loadShellContext } from '../../../src/nav/load-shell-context';
import { SurfaceState } from '../../../src/components/surface-state';

export default function AccountSecurityPage() {
  const [kind, setKind] = useState<'loading' | 'ready' | 'error'>('loading');
  const [staffOk, setStaffOk] = useState(false);
  const [platformOk, setPlatformOk] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    void loadShellContext().then((shell) => {
      if (shell.status === 'unauthenticated') {
        window.location.href = '/api/auth/login?return=/account/security';
        return;
      }
      if (shell.status === 'error') {
        setKind('error');
        setMessage(shell.message);
        return;
      }
      if (shell.status !== 'ready') return;
      setStaffOk(shell.meTenants !== null || shell.meEvents !== null);
      setPlatformOk(shell.platformMe?.operator === true);
      setKind('ready');
    });
  }, []);

  if (kind === 'loading') return <SurfaceState kind="loading" />;
  if (kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Bảo mật phiên
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Đăng xuất từng bề mặt riêng (ADR-20). Đăng xuất portal không xóa cookie
        Platform Operator và ngược lại.
      </Typography.Paragraph>
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Phiên nhân sự (staff)">
          {staffOk ? 'Đang hoạt động' : 'Không có'}
        </Descriptions.Item>
        <Descriptions.Item label="Phiên Platform Operator">
          {platformOk ? 'Operator (audience riêng)' : 'Không có / không phải Operator'}
        </Descriptions.Item>
        <Descriptions.Item label="Cookie">
          Host-only · HttpOnly · SameSite=Lax · không Domain=.vemoki.com
        </Descriptions.Item>
      </Descriptions>
      <Space style={{ marginTop: 24 }} wrap>
        <Button danger href="/api/auth/logout" data-testid="logout-staff">
          Đăng xuất portal (staff)
        </Button>
        <Button href="/api/auth/platform/logout" data-testid="logout-platform">
          Đăng xuất Platform
        </Button>
      </Space>
    </Card>
  );
}
