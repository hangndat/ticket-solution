import Link from 'next/link';
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

function eventTitle(ticket: WalletTicketRow): string {
  return ticket.eventName?.trim() || `Sự kiện ${ticket.eventId.slice(0, 8)}…`;
}

type Props = {
  ticket: WalletTicketRow;
  tenantSlug: string | null;
};

export function WalletTicketCard({ ticket, tenantSlug }: Props) {
  const title = eventTitle(ticket);
  const href =
    tenantSlug
      ? `/t/${encodeURIComponent(tenantSlug)}/tickets/${encodeURIComponent(ticket.ticketId)}?tenantId=${encodeURIComponent(ticket.tenantId)}`
      : null;

  const inner = (
    <>
      <div className={attendeeWalletTicketTop}>
        <div className={attendeeWalletTicketHead}>
          <span className={ticketStateTagClass(ticket.state)}>
            {ticketStateLabel(ticket.state)}
          </span>
          <time className={attendeeWalletTicketDate} dateTime={ticket.createdAt}>
            {ticket.createdAt.slice(0, 10)}
          </time>
        </div>
        <h3 className={attendeeWalletTicketTitle}>{title}</h3>
        <p className={attendeeWalletTicketMeta}>
          Mã vé <code>{shortTicketCode(ticket.ticketId)}</code>
        </p>
      </div>
      <div className={attendeeWalletTicketFoot}>
        <span className={attendeeWalletTicketCode} aria-hidden="true">
          {shortTicketCode(ticket.ticketId)}
        </span>
        <span className={attendeeWalletTicketCta}>
          Mở vé <span aria-hidden="true">→</span>
        </span>
      </div>
    </>
  );

  if (!href) {
    return (
      <article
        className={attendeeWalletTicketCardDisabled}
        data-testid={`wallet-ticket-${ticket.ticketId}`}
        aria-label={`${title} — chưa mở được liên kết vé`}
      >
        {inner}
        <p className={attendeeWalletTicketWarn} role="status">
          Không xác định được tổ chức cho vé này. Thử đăng nhập lại hoặc đổi mã.
        </p>
      </article>
    );
  }

  return (
    <Link
      href={href}
      className={attendeeWalletTicketCard}
      data-testid={`wallet-ticket-${ticket.ticketId}`}
      aria-label={`Mở vé ${title}`}
    >
      {inner}
    </Link>
  );
}
