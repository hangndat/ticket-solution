'use client';

import { Button, Typography } from 'antd';

/**
 * GATE-STAY-APP: portal never mounts scanner — only deep-link to app./gate.
 */
export function GateDeeplinkButton(props: {
  href: string;
  label?: string;
}) {
  return (
    <Button
      type="default"
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="gate-deeplink"
    >
      {props.label ?? 'Mở cổng quét trên app'}
    </Button>
  );
}

export function GateStayAppNotice() {
  return (
    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
      Quét vé chạy trên ứng dụng sản phẩm (app), không trên portal. Portal chỉ
      hiển thị báo cáo khi máy chủ cấp quyền báo cáo sự kiện.
    </Typography.Paragraph>
  );
}
