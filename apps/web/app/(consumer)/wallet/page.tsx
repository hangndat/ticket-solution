import type { Metadata } from 'next';
import { isUuid } from '../../../src/bff/ids';
import { loginHref } from '../../../src/oidc/login-href';
import { readRefreshToken } from '../../../src/oidc/cookies';
import {
  redirectOwnerDiscovery401,
  renewOwnerSessionIfPossible,
} from '../../../src/oidc/owner-session-guard';
import {
  attendeeWalletGrid,
  attendeeWalletPage,
} from '../../../src/attendee-detail-surface';
import { loadOwnerWallet, WALLET_COPY } from '../../../src/owner-ticket';
import {
  WalletEmpty,
  WalletFilterEmpty,
  WalletHeading,
  WalletInvalid,
  WalletNeedLogin,
  WalletUnreachable,
} from '../../../src/owner-ticket/wallet-chrome';
import { buildWalletEventFilters } from '../../../src/owner-ticket/wallet-event-filter-data';
import { WalletEventFilters } from '../../../src/owner-ticket/wallet-event-filters';
import { WalletTicketCard } from '../../../src/owner-ticket/wallet-ticket-card';
import { ConsumerPageShell } from '../../../src/consumer-page-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: WALLET_COPY.title,
  description: WALLET_COPY.intro,
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ event?: string }>;
};

export default async function WalletPage({ searchParams }: Props) {
  const query = await searchParams;
  const rawEvent = query.event?.trim() ?? '';
  const eventFilter = isUuid(rawEvent) ? rawEvent : null;
  const walletLogin = loginHref('/wallet');

  await renewOwnerSessionIfPossible('/wallet');
  const result = await loadOwnerWallet();

  if (result.status === 'unauthenticated') {
    if (await readRefreshToken()) {
      await redirectOwnerDiscovery401('/wallet');
    }
    return (
      <ConsumerPageShell
        mainClassName={attendeeWalletPage}
        mainTestId="wallet-need-login"
      >
        <WalletHeading showIntro />
        <WalletNeedLogin loginHref={walletLogin} />
      </ConsumerPageShell>
    );
  }

  if (result.status === 'unreachable') {
    return (
      <ConsumerPageShell
        mainClassName={attendeeWalletPage}
        mainTestId="wallet-unreachable"
      >
        <WalletHeading />
        <WalletUnreachable />
      </ConsumerPageShell>
    );
  }

  if (result.status === 'invalid') {
    return (
      <ConsumerPageShell
        mainClassName={attendeeWalletPage}
        mainTestId="wallet-invalid"
      >
        <WalletHeading />
        <WalletInvalid />
      </ConsumerPageShell>
    );
  }

  const { tickets, tenantSlugById } = result;
  const filters = buildWalletEventFilters(tickets);
  const visible = eventFilter
    ? tickets.filter((ticket) => ticket.eventId === eventFilter)
    : tickets;

  return (
    <ConsumerPageShell
      mainClassName={attendeeWalletPage}
      mainTestId="wallet-ready"
    >
      <WalletHeading showIntro showCta />

      {tickets.length === 0 ? (
        <WalletEmpty />
      ) : (
        <>
          <WalletEventFilters
            filters={filters}
            activeEventId={eventFilter}
            totalCount={tickets.length}
          />
          {visible.length === 0 ? (
            <WalletFilterEmpty />
          ) : (
            <div className={attendeeWalletGrid} role="list" data-testid="wallet-ticket-grid">
              {visible.map((ticket) => (
                <WalletTicketCard
                  key={ticket.ticketId}
                  ticket={ticket}
                  tenantSlug={
                    tenantSlugById[ticket.tenantId.toLowerCase()] ?? null
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </ConsumerPageShell>
  );
}
