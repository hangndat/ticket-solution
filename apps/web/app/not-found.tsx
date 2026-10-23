import { Button } from '@ticket/ui';
import Link from 'next/link';
import {
  eyebrowKicker,
  routeShellMain,
} from '../src/guest/guest-flow-surface';
import { introLead } from '../src/redeem/redeem-surface';
import { SurfaceState } from '../src/ui/surface-state';

export default function NotFound() {
  return (
    <main id="main" className={routeShellMain}>
      <p className={eyebrowKicker}>404</p>
      <h1>
        Chưa có gì ở đây,
        <br />
        tạm thời.
      </h1>
      <p className={introLead}>
        Không tìm thấy tổ hợp tenant và sự kiện này — hoặc trang đã chuyển đi.
      </p>
      <SurfaceState
        kind="empty"
        title="Không tìm thấy trang"
        detail="Kiểm tra lại đường dẫn, hoặc quay về trang chủ để xem sự kiện đã xuất bản."
        testId="route-not-found"
        action={
          <Button asChild variant="brand">
            <Link href="/">Về trang chủ</Link>
          </Button>
        }
      />
    </main>
  );
}
