'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import type { MeResponse } from '@ticket/contracts';
import { useAttendeeLocale } from '../../../src/i18n';
import { redeemFormCopy } from '../../../src/redeem/form-copy';
import { redeemFormCard, redeemGateCard } from '../../../src/redeem/redeem-surface';
import { RedeemAuthGate } from './redeem-auth-gate';
import { RedeemForm } from './redeem-form';

type Props = ComponentProps<typeof RedeemForm> & { loginHref: string };
type IdentityState = 'checking' | 'verified' | 'unverified' | 'signed_out';

/** Route-handler /me can refresh cookies; an RSC read cannot rotate them. */
export function RedeemVerifiedBoundary({ loginHref, ...formProps }: Props) {
  const [identity, setIdentity] = useState<IdentityState>('checking');
  const { locale } = useAttendeeLocale();
  const copy = redeemFormCopy(locale);

  useEffect(() => {
    const controller = new AbortController();
    async function checkIdentity() {
      try {
        const response = await fetch('/api/bff/me', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) {
          setIdentity('signed_out');
          return;
        }
        const me = (await response.json()) as Partial<MeResponse>;
        setIdentity(me.emailVerified === true ? 'verified' : 'unverified');
      } catch {
        if (!controller.signal.aborted) setIdentity('signed_out');
      }
    }
    void checkIdentity();
    return () => controller.abort();
  }, []);

  if (identity === 'checking') {
    return <section className={redeemGateCard} role="status">{copy.checkingSession}</section>;
  }
  if (identity !== 'verified') {
    return <RedeemAuthGate loginHref={loginHref} unverified={identity === 'unverified'} />;
  }
  return (
    <div className={redeemFormCard}>
      <RedeemForm {...formProps} />
    </div>
  );
}
