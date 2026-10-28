'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';
import { useAttendeeLocale } from '../i18n';
import {
  attendeeWalletHeading,
  attendeeWalletHeadingCta,
  attendeeWalletIntro,
} from '../attendee-detail-surface';
import { attendeeAuthButtons } from '../attendee-surface';
import { SurfaceState } from '../ui/surface-state';
import { walletCopy } from './types';

export function WalletHeading({
  showIntro = false,
  showCta = false,
}: {
  showIntro?: boolean;
  showCta?: boolean;
}) {
  const { locale } = useAttendeeLocale();
  const copy = walletCopy(locale);
  return (
    <header className={attendeeWalletHeading}>
      {showCta ? (
        <>
          <div>
            <h1>{copy.title}</h1>
            {showIntro ? (
              <p className={attendeeWalletIntro}>{copy.intro}</p>
            ) : null}
          </div>
          <Button asChild variant="brand" className={attendeeWalletHeadingCta}>
            <Link href="/redeem">{copy.redeemCta}</Link>
          </Button>
        </>
      ) : (
        <>
          <h1>{copy.title}</h1>
          {showIntro ? (
            <p className={attendeeWalletIntro}>{copy.intro}</p>
          ) : null}
        </>
      )}
    </header>
  );
}

export function WalletNeedLogin({ loginHref }: { loginHref: string }) {
  const { locale } = useAttendeeLocale();
  const copy = walletCopy(locale);
  return (
    <SurfaceState
      kind="empty"
      title={copy.needLogin.title}
      detail={copy.needLogin.detail}
      testId="wallet-need-login-state"
      action={
        <div className={attendeeAuthButtons}>
          <Button asChild variant="brand">
            <a href={loginHref}>{copy.login}</a>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/redeem">{copy.redeemCta}</Link>
          </Button>
        </div>
      }
    />
  );
}

export function WalletUnreachable() {
  const { locale } = useAttendeeLocale();
  const copy = walletCopy(locale);
  return (
    <SurfaceState
      kind="error"
      title={copy.unreachable.title}
      detail={copy.unreachable.detail}
      testId="wallet-unreachable-state"
      action={
        <Button asChild variant="brand">
          <Link href="/wallet">{copy.retry}</Link>
        </Button>
      }
    />
  );
}

export function WalletInvalid() {
  const { locale } = useAttendeeLocale();
  const copy = walletCopy(locale);
  return (
    <SurfaceState
      kind="error"
      title={copy.invalid.title}
      detail={copy.invalid.detail}
      testId="wallet-invalid-state"
      action={
        <Button asChild variant="brand">
          <Link href="/wallet">{copy.retry}</Link>
        </Button>
      }
    />
  );
}

export function WalletEmpty() {
  const { locale } = useAttendeeLocale();
  const copy = walletCopy(locale);
  return (
    <SurfaceState
      kind="empty"
      title={copy.empty.title}
      detail={copy.empty.detail}
      testId="wallet-empty"
      action={
        <Button asChild variant="brand">
          <Link href="/redeem">{copy.redeemCta}</Link>
        </Button>
      }
    />
  );
}

export function WalletFilterEmpty() {
  const { locale } = useAttendeeLocale();
  const copy = walletCopy(locale);
  return (
    <SurfaceState
      kind="empty"
      title={copy.filterEmptyTitle}
      detail={copy.filterEmptyDetail}
      testId="wallet-filter-empty"
      action={
        <Button asChild variant="brand">
          <Link href="/wallet">{copy.allTickets}</Link>
        </Button>
      }
    />
  );
}
