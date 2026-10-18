'use client';

import { Alert, Button, Empty, Result, Spin } from 'antd';
import type { ReactNode } from 'react';

export type SurfaceKind =
  | 'loading'
  | 'empty'
  | 'ready'
  | 'error'
  | 'unknown'
  | 'permission-denied'
  | 'suspended';

export function SurfaceState(props: {
  kind: SurfaceKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  emptyAction?: ReactNode;
  children?: ReactNode;
}) {
  switch (props.kind) {
    case 'loading':
      return (
        <div
          role="status"
          aria-busy="true"
          style={{ padding: 48, textAlign: 'center' }}
        >
          <Spin tip="Đang tải…" size="large" />
        </div>
      );
    case 'empty':
      return (
        <Empty
          description={props.description ?? 'Chưa có dữ liệu'}
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
          message={props.title ?? 'Không tải được dữ liệu'}
          description={props.description}
          action={
            props.onRetry ? (
              <Button size="small" onClick={props.onRetry}>
                Thử lại
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
          message={props.title ?? 'Chưa rõ kết quả'}
          description={
            props.description ??
            'Phản hồi không xác định — kiểm tra lại trước khi coi là thành công.'
          }
          action={
            props.onRetry ? (
              <Button size="small" onClick={props.onRetry}>
                Kiểm tra lại
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
          title={props.title ?? 'Không có quyền'}
          subTitle={
            props.description ??
            'Bạn không có quyền xem nội dung này. Quyền do máy chủ quyết định.'
          }
          extra={
            props.onRetry ? (
              <Button type="primary" onClick={props.onRetry}>
                Về trang được phép
              </Button>
            ) : undefined
          }
        />
      );
    case 'suspended':
      return (
        <Alert
          type="error"
          showIcon
          banner
          message={props.title ?? 'Tổ chức đã tạm ngưng'}
          description={
            props.description ??
            'Không thể thao tác khi tổ chức ở trạng thái SUSPENDED.'
          }
        />
      );
    case 'ready':
    default:
      return <>{props.children}</>;
  }
}
