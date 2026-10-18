'use client';

import { Alert, Button, Card, Result, Space, Typography } from 'antd';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SurfaceState } from '../../src/components/surface-state';

const ERROR_COPY: Record<string, string> = {
  misconfigured: 'OIDC chưa cấu hình trên portal — không thể đăng nhập.',
  invalid_state: 'Phiên đăng nhập không hợp lệ (state/PKCE). Thử lại.',
  token_exchange: 'Không đổi được mã ủy quyền. Thử đăng nhập lại.',
  access_denied: 'Bạn đã từ chối ủy quyền tại nhà cung cấp danh tính.',
};

function AuthInner() {
  const params = useSearchParams();
  const error = params.get('error');

  if (error) {
    return (
      <Result
        status="error"
        title="Đăng nhập không thành công"
        subTitle={ERROR_COPY[error] ?? `Lỗi: ${error}`}
        extra={
          <Button type="primary" href="/api/auth/login?return=/">
            Thử đăng nhập lại
          </Button>
        }
      />
    );
  }

  return (
    <Card style={{ maxWidth: 480, margin: '48px auto' }}>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Vemoki Portal
      </Typography.Title>
      <Typography.Paragraph>
        Đăng nhập nhân sự qua nhà cung cấp danh tính. Không dùng phiên khách
        (app) trên portal.
      </Typography.Paragraph>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Cookie phiên chỉ thuộc portal — không chia sẻ với app."
      />
      <Space>
        <Button type="primary" size="large" href="/api/auth/login?return=/">
          Đăng nhập nhân sự
        </Button>
      </Space>
    </Card>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<SurfaceState kind="loading" />}>
      <AuthInner />
    </Suspense>
  );
}
