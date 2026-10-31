'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';
import { useAttendeeLocale } from '../../../src/i18n';
import { authNoticeFromParam } from '../../../src/oidc/auth-notice';
import { redeemFormCopy } from '../../../src/redeem/form-copy';
import {
  authButtonsRow,
  redeemAuthNotice,
  redeemEyebrow,
  redeemHeader,
  redeemLead,
} from '../../../src/redeem/redeem-surface';

export function RedeemPageHeader() {
  const { locale } = useAttendeeLocale();
  const copy = redeemFormCopy(locale);
  return (
    <header className={redeemHeader}>
      <p className={redeemEyebrow}>{copy.pageEyebrow}</p>
      <h1>{copy.pageTitle}</h1>
      <p className={redeemLead}>{copy.pageLead}</p>
    </header>
  );
}

export function RedeemAuthNoticePanel({
  notice,
  retryHref,
}: {
  notice: string;
  retryHref: string;
}) {
  const { locale } = useAttendeeLocale();
  const copy = redeemFormCopy(locale);
  const authNotice = authNoticeFromParam(notice, { retryHref, locale });
  if (!authNotice) return null;
  return (
    <aside
      className={redeemAuthNotice}
      role="alert"
      data-testid="redeem-auth-notice"
    >
      <h2>{authNotice.title}</h2>
      <p>{authNotice.detail}</p>
      <p className={authButtonsRow}>
        <Button asChild variant="primary">
          <a href={authNotice.retryHref}>{copy.retry}</a>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">{copy.home}</Link>
        </Button>
      </p>
    </aside>
  );
}

export function RedeemOidcDown({
  loginHref,
  devStatus,
}: {
  loginHref: string;
  devStatus: string | null;
}) {
  const { locale } = useAttendeeLocale();
  const copy = redeemFormCopy(locale);
  return (
    <>
      <h2>{copy.oidcDownTitle}</h2>
      <p>
        {copy.oidcDownDetail}
        {devStatus}
      </p>
      <p className={authButtonsRow}>
        <Button asChild variant="primary">
          <a href={loginHref}>{copy.login}</a>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">{copy.home}</Link>
        </Button>
      </p>
    </>
  );
}
