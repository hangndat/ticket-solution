'use client';

import Link from 'next/link';
import { useAttendeeLocaleOptional } from '../i18n';
import { formatDual } from '../i18n/dual';
import { WALLET_COPY_CATALOG, walletCopy } from './types';
import { isTenantSlug } from '../branding';
import {
  attendeeWalletTicketCard,
  attendeeWalletTicketCardDisabled,
  attendeeWalletTicketCode,
  attendeeWalletTicketCta,
  attendeeWalletTicketDate,
  attendeeWalletTicketFoot,
  attendeeWalletTicketHead,
  attendeeWalletTicketMeta,
  attendeeWalletTicketTitle,
  attendeeWalletTicketTop,
  attendeeWalletTicketWarn,
} from '../attendee-detail-surface';
import type { WalletTicketRow } from './types';
import { ticketStateLabel, ticketStateTagClass } from './ticket-state';

function shortTicketCode(ticketId: string): string {
  if (ticketId.length <= 10) return ticketId;
  return ticketId.slice(0, 8).toUpperCase();
}

type Props = {
  ticket: WalletTicketRow;
  tenantSlug: string | null;
};

/** Membership slug, else tenant UUID (valid slug; detail uses ?tenantId=). */
export function walletTicketHref(
  ticket: Pick<WalletTicketRow, 'ticketId' | 'tenantId'>,
  tenantSlug: string | null,
): string | null {
  const slug = (tenantSlug?.trim() || ticket.tenantId.trim()).toLowerCase();
  if (!slug || !isTenantSlug(slug)) return null;
  return `/t/${encodeURIComponent(slug)}/tickets/${encodeURIComponent(ticket.ticketId)}?tenantId=${encodeURIComponent(ticket.tenantId)}`;
}

export function WalletTicketCard({ ticket, tenantSlug }: Props) {
  const { locale } = useAttendeeLocaleOptional();
  const copy = walletCopy(locale);
  const title =
    ticket.eventName?.trim() ||
    formatDual(WALLET_COPY_CATALOG.eventFallback, locale, {
      id: ticket.eventId.slice(0, 8),
    });
  const href = walletTicketHref(ticket, tenantSlug);

  const inner = (
    <>
      <div className={attendeeWalletTicketTop}>
        <div className={attendeeWalletTicketHead}>
          <span className={ticketStateTagClass(ticket.state)}>
            {ticketStateLabel(ticket.state, locale)}
          </span>
          <time className={attendeeWalletTicketDate} dateTime={ticket.createdAt}>
            {ticket.createdAt.slice(0, 10)}
          </time>
        </div>
        <h3 className={attendeeWalletTicketTitle}>{title}</h3>
        <p className={attendeeWalletTicketMeta}>
          {copy.ticketCode} <code>{shortTicketCode(ticket.ticketId)}</code>
        </p>
      </div>
      <div className={attendeeWalletTicketFoot}>
        <span className={attendeeWalletTicketCode} aria-hidden="true">
          {shortTicketCode(ticket.ticketId)}
        </span>
        <span className={attendeeWalletTicketCta}>
          {copy.openTicket} <span aria-hidden="true">→</span>
        </span>
      </div>
    </>
  );

  if (!href) {
    return (
      <article
        role="listitem"
        className={attendeeWalletTicketCardDisabled}
        data-testid={`wallet-ticket-${ticket.ticketId}`}
        aria-label={formatDual(WALLET_COPY_CATALOG.noOrgAria, locale, { title })}
      >
        {inner}
        <p className={attendeeWalletTicketWarn} role="status">
          {copy.noOrgWarn}
        </p>
      </article>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      role="listitem"
      className={attendeeWalletTicketCard}
      data-testid={`wallet-ticket-${ticket.ticketId}`}
      aria-label={formatDual(WALLET_COPY_CATALOG.openTicketAria, locale, { title })}
    >
      {inner}
    </Link>
  );
}
