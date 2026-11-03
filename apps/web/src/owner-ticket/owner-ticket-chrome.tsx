'use client';

import { Button } from '@ticket/ui';
import Link from 'next/link';
import { formatDual, useAttendeeLocale } from '../i18n';
import { attendeeAuthButtons } from '../attendee-surface';
import {
  attendeeTicketBackLink,
  attendeeTicketBread,
  attendeeTicketCardBody,
  attendeeTicketCardHead,
  attendeeTicketDetailCard,
  attendeeTicketIntro,
  attendeeTicketMetaList,
  attendeeTicketNoticeError,
  attendeeTicketNoticeUnknown,
  attendeeTicketTitle,
} from '../attendee-detail-surface';
import { SurfaceState } from '../ui/surface-state';
import { gateCredentialQrValue } from './gate-credential-payload';
import { OwnerTicketQrPanel } from './owner-ticket-qr-panel';
import { ticketStateLabel, ticketStateTagClass } from './ticket-state';
import {
  OWNER_TICKET_COPY_CATALOG,
  ownerTicketCopy,
  type OwnerTicketDetail,
} from './types';

function shortTicketId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function OwnerTicketHeading() {
  const { locale } = useAttendeeLocale();
  return <h1 className={attendeeTicketTitle}>{ownerTicketCopy(locale).title}</h1>;
}

export function OwnerTicketInvalid() {
  const { locale } = useAttendeeLocale();
  const copy = ownerTicketCopy(locale);
  return (
    <SurfaceState
      kind="error"
      title={copy.invalid.title}
      detail={copy.invalid.detail}
      testId="owner-ticket-invalid-state"
      action={
        <Button asChild variant="brand">
          <Link href="/">{copy.home}</Link>
        </Button>
      }
    />
  );
}

export function OwnerTicketNeedLogin({ loginHref }: { loginHref: string }) {
  const { locale } = useAttendeeLocale();
  const copy = ownerTicketCopy(locale);
  return (
    <SurfaceState
      kind="empty"
      title={copy.needLogin.title}
      detail={copy.needLogin.detail}
      testId="owner-ticket-need-login-state"
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

export function OwnerTicketLoading() {
  const { locale } = useAttendeeLocale();
  return <SurfaceState kind="loading" title={ownerTicketCopy(locale).loading} testId="owner-ticket-loading-state" />;
}

export function OwnerTicketUnreachable({ path }: { path: string }) {
  const { locale } = useAttendeeLocale();
  const copy = ownerTicketCopy(locale);
  return (
    <SurfaceState
      kind="error"
      title={copy.unreachable.title}
      detail={copy.unreachable.detail}
      testId="owner-ticket-unreachable-state"
      action={
        <Button asChild variant="brand">
          <Link href={path}>{copy.retry}</Link>
        </Button>
      }
    />
  );
}

export function OwnerTicketTenantUnresolved() {
  const { locale } = useAttendeeLocale();
  const copy = ownerTicketCopy(locale);
  return (
    <SurfaceState
      kind="empty"
      title={copy.tenantUnresolved.title}
      detail={copy.tenantUnresolved.detail}
      testId="owner-ticket-tenant-unresolved-state"
      action={
        <Button asChild variant="brand">
          <Link href="/redeem">{copy.redeemCta}</Link>
        </Button>
      }
    />
  );
}

export function OwnerTicketForbidden() {
  const { locale } = useAttendeeLocale();
  const copy = ownerTicketCopy(locale);
  return (
    <SurfaceState
      kind="empty"
      title={copy.forbidden.title}
      detail={copy.forbidden.detail}
      testId="owner-ticket-forbidden-state"
      action={
        <Button asChild variant="brand">
          <Link href="/wallet" prefetch={false}>{copy.wallet}</Link>
        </Button>
      }
    />
  );
}

export function OwnerTicketMissing() {
  const { locale } = useAttendeeLocale();
  const copy = ownerTicketCopy(locale);
  return (
    <SurfaceState
      kind="empty"
      title={copy.missing.title}
      detail={copy.missing.detail}
      testId="owner-ticket-missing-state"
      action={
        <Button asChild variant="brand">
          <Link href="/">{copy.home}</Link>
        </Button>
      }
    />
  );
}

export function OwnerTicketReady({
  ticket,
  tenantSlug,
  isDemo,
}: {
  ticket: OwnerTicketDetail;
  tenantSlug: string;
  isDemo: boolean;
}) {
  const { locale } = useAttendeeLocale();
  const copy = ownerTicketCopy(locale);
  const qrLabel = formatDual(OWNER_TICKET_COPY_CATALOG.qrLabel, locale, {
    id: shortTicketId(ticket.ticketId),
  });
  const qrPayload = gateCredentialQrValue(ticket);
  const stateBlocked = ticket.state !== 'ACTIVE';
  const canShowCredential = qrPayload !== null;
  const stateLabel = ticketStateLabel(ticket.state, locale);

  return (
    <>
      <p className={attendeeTicketBread}>
        <Link className={attendeeTicketBackLink} href="/wallet" prefetch={false}>
          {copy.backWalletShort}
        </Link>
      </p>
      <h1 className={attendeeTicketTitle}>{copy.title}</h1>
      <p className={attendeeTicketIntro}>
        {copy.introPrefix}{' '}
        <span data-testid="owner-ticket-tenant">{tenantSlug}</span>.
      </p>

      <article className={attendeeTicketDetailCard} data-testid="owner-ticket-card">
        <div className={attendeeTicketCardHead}>
          <span
            className={ticketStateTagClass(ticket.state)}
            data-testid="owner-ticket-state-tag"
          >
            {stateLabel}
          </span>
        </div>
        <div className={attendeeTicketCardBody}>
          {isDemo ? (
            <aside
              className={attendeeTicketNoticeUnknown}
              role="status"
              data-testid="owner-ticket-demo-label"
            >
              <strong>{copy.demoTitle}</strong>
              <p>{copy.demoDetail}</p>
            </aside>
          ) : null}

          {stateBlocked ? (
            <aside
              className={attendeeTicketNoticeError}
              role="status"
              data-testid="owner-ticket-state-notice"
            >
              <p>
                {formatDual(OWNER_TICKET_COPY_CATALOG.stateBlocked, locale, {
                  state: stateLabel,
                })}
              </p>
            </aside>
          ) : null}

          {canShowCredential ? (
            <OwnerTicketQrPanel qrPayload={qrPayload} qrLabel={qrLabel} />
          ) : null}

          {ticket.state === 'ACTIVE' && !qrPayload ? (
            <aside
              className={attendeeTicketNoticeError}
              role="status"
              data-testid="owner-ticket-credential-unavailable"
            >
              <p>{copy.credentialUnavailable}</p>
            </aside>
          ) : null}

          <dl className={attendeeTicketMetaList} data-testid="owner-ticket-detail">
            <div>
              <dt>{copy.ticketCode}</dt>
              <dd>
                <code data-testid="owner-ticket-id" title={ticket.ticketId}>
                  {shortTicketId(ticket.ticketId)}
                </code>
              </dd>
            </div>
            <div>
              <dt>{copy.status}</dt>
              <dd data-testid="owner-ticket-state">{ticket.state}</dd>
            </div>
            <div>
              <dt>{copy.credentialVersion}</dt>
              <dd>{ticket.credentialVersion}</dd>
            </div>
            {ticket.state === 'ACTIVE' ? (
              <div data-testid="owner-ticket-manual-entry">
                <dt>{copy.manualEntryCode}</dt>
                <dd>
                  {ticket.manualEntryCode ? (
                    <code>{ticket.manualEntryCode}</code>
                  ) : (
                    <span role="status">{copy.manualEntryCodeUnavailable}</span>
                  )}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{copy.issuedAt}</dt>
              <dd>
                <time dateTime={ticket.createdAt}>{ticket.createdAt}</time>
              </dd>
            </div>
          </dl>
        </div>
      </article>
      <p>
        <Link className={attendeeTicketBackLink} href="/wallet" prefetch={false}>
          {copy.backWallet}
        </Link>
        {' · '}
        <Link href="/redeem">{copy.redeemCta}</Link>
      </p>
    </>
  );
}
