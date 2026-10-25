'use client';
import { Button } from '@ticket/ui';
import Link from 'next/link';
import {
  eyebrowKicker,
  routeShellMain,
} from '../src/guest/guest-flow-surface';
import { introLead } from '../src/redeem/redeem-surface';
import { SurfaceState } from '../src/ui/surface-state';

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main id="main" className={routeShellMain}>
      <p className={eyebrowKicker}>Lỗi</p>
      <h1>Không tải được trang này.</h1>
      <p className={introLead}>
        Thử lại. Không có thao tác vé nào được thực hiện từ màn hình này.
      </p>
      <SurfaceState
        kind="error"
        title="Lỗi tải giao diện"
        detail="Chưa biết kết quả phía máy chủ — không suy diễn thành công hay thất bại nghiệp vụ."
        testId="route-error"
        action={
          <Button type="button" variant="attendeePrimary" onClick={reset}>
            Thử lại
          </Button>
        }
      />
      <p>
        <Link href="/">← Trang chủ</Link>
      </p>
    </main>
  );
}
