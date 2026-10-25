import { Button } from '@ticket/ui';
import Link from 'next/link';
import {
  authButtonsRow,
  redeemGateActions,
  redeemGateCard,
} from '../../../src/redeem/redeem-surface';
import { cn } from '../../../lib/utils';

type Props = {
  loginHref: string;
};

/** Guest-facing login gate — matches mockup narrow redeem/login intent. */
export function RedeemAuthGate({ loginHref }: Props) {
  return (
    <section
      className={redeemGateCard}
      aria-labelledby="redeem-auth-gate-title"
      data-testid="redeem-auth-gate"
    >
      <h2 id="redeem-auth-gate-title">Đăng nhập để đổi mã</h2>
      <p>Đăng nhập để tiếp tục. Bạn sẽ quay lại trang này sau đó.</p>
      <div className={cn(authButtonsRow, redeemGateActions)}>
        <Button asChild variant="attendeePrimary">
          <a href={loginHref}>Tiếp tục đăng nhập</a>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </section>
  );
}
