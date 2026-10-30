'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';
import { useAttendeeLocale } from '../../../src/i18n';
import { redeemFormCopy } from '../../../src/redeem/form-copy';
import {
  authButtonsRow,
  redeemCodeField,
  redeemGateActions,
  redeemGateCard,
} from '../../../src/redeem/redeem-surface';
import { cn } from '../../../lib/utils';

type Props = {
  loginHref: string;
  unverified?: boolean;
};

/** The guest code is local to this input; auth navigation never carries it. */
export function RedeemAuthGate({ loginHref, unverified = false }: Props) {
  const { locale } = useAttendeeLocale();
  const copy = redeemFormCopy(locale);
  const nextHref = unverified ? '/account' : loginHref;
  return (
    <section
      className={redeemGateCard}
      aria-labelledby="redeem-auth-gate-title"
      data-testid="redeem-auth-gate"
    >
      <h2 id="redeem-auth-gate-title">
        {unverified ? copy.verifyEmailTitle : copy.oidcDownTitle}
      </h2>
      <p>{unverified ? copy.verifyEmailDetail : copy.loginToRedeemDetail}</p>
      <div>
        <div className={redeemCodeField}>
          <label htmlFor="redeem-code-global">
            {copy.codeLabel}
            <input
              id="redeem-code-global"
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.codePlaceholder}
              data-testid="redeem-global-code"
            />
          </label>
          <p>{copy.guestCodeHint}</p>
        </div>
        <div className={cn(authButtonsRow, redeemGateActions)}>
          <Button asChild variant="primary">
            <a href={nextHref} data-testid="redeem-auth-continue">
              {unverified ? copy.openAccount : copy.loginContinue}
            </a>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">{copy.home}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
