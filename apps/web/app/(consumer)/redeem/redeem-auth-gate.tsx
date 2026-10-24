import { Button } from '@ticket/ui';
import Link from 'next/link';
import { eyebrowKicker } from '../../../src/guest/guest-flow-surface';
import {
  authButtonsRow,
  redeemGateActions,
  redeemGateCard,
  redeemGateIllustration,
} from '../../../src/redeem/redeem-surface';
import { cn } from '../../../lib/utils';

type Props = {
  loginHref: string;
  intentCopy?: boolean;
};

/** Guest-facing login gate — matches mockup narrow redeem/login intent. */
export function RedeemAuthGate({ loginHref, intentCopy = true }: Props) {
  return (
    <section
      className={redeemGateCard}
      aria-labelledby="redeem-auth-gate-title"
      data-testid="redeem-auth-gate"
    >
      <div className={redeemGateIllustration} aria-hidden="true">
        🔐
      </div>
      <p className={eyebrowKicker}>Đăng nhập</p>
      <h2 id="redeem-auth-gate-title">Tiếp tục để đổi mã</h2>
      <p>
        {intentCopy
          ? 'Hoàn tất đăng nhập để tiếp tục đổi mã — sau khi đăng nhập bạn sẽ quay lại trang này.'
          : 'Đăng nhập để đổi mã lấy vé trên Vemoki.'}
      </p>
      <div className={cn(authButtonsRow, redeemGateActions)}>
        <Button asChild variant="primary">
          <a href={loginHref}>Tiếp tục đăng nhập</a>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </section>
  );
}
