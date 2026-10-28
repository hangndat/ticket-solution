'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';
import { useAttendeeLocale } from '../../../src/i18n';
import { redeemFormCopy } from '../../../src/redeem/form-copy';
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
  const { locale } = useAttendeeLocale();
  const copy = redeemFormCopy(locale);
  return (
    <section
      className={redeemGateCard}
      aria-labelledby="redeem-auth-gate-title"
      data-testid="redeem-auth-gate"
    >
      <h2 id="redeem-auth-gate-title">{copy.loginToRedeemTitle}</h2>
      <p>{copy.loginToRedeemDetail}</p>
      <div className={cn(authButtonsRow, redeemGateActions)}>
        <Button asChild variant="primary">
          <a href={loginHref}>{copy.loginContinue}</a>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">{copy.home}</Link>
        </Button>
      </div>
    </section>
  );
}
