import type { Metadata } from 'next';
import { Button } from '@ticket/ui';
import Link from 'next/link';
import { isUuid } from '../../../src/bff/ids';
import { loginHref } from '../../../src/oidc/login-href';
import { readRefreshToken } from '../../../src/oidc/cookies';
import {
  redirectOwnerDiscovery401,
  renewOwnerSessionIfPossible,
} from '../../../src/oidc/owner-session-guard';
import {
  attendeeWalletGrid,
  attendeeWalletHeading,
  attendeeWalletHeadingCta,
  attendeeWalletIntro,
  attendeeWalletPage,
} from '../../../src/attendee-detail-surface';
import { attendeeAuthButtons } from '../../../src/attendee-surface';
import { loadOwnerWallet, WALLET_COPY } from '../../../src/owner-ticket';
import {
  buildWalletEventFilters,
  WalletEventFilters,
} from '../../../src/owner-ticket/wallet-event-filters';
import { WalletTicketCard } from '../../../src/owner-ticket/wallet-ticket-card';
import { ConsumerPageShell } from '../../../src/consumer-page-shell';
import { SurfaceState } from '../../../src/ui/surface-state';

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
        <header className={attendeeWalletHeading}>
          <h1>{WALLET_COPY.title}</h1>
          <p className={attendeeWalletIntro}>{WALLET_COPY.intro}</p>
        </header>
        <SurfaceState
          kind="empty"
          title={WALLET_COPY.needLogin.title}
          detail={WALLET_COPY.needLogin.detail}
          testId="wallet-need-login-state"
          action={
            <div className={attendeeAuthButtons}>
              <Button asChild variant="attendeePrimary">
                <a href={walletLogin}>Đăng nhập</a>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/redeem">Đổi mã lấy vé</Link>
              </Button>
            </div>
          }
        />
      </ConsumerPageShell>
    );
  }

  if (result.status === 'unreachable') {
    return (
      <ConsumerPageShell
        mainClassName={attendeeWalletPage}
        mainTestId="wallet-unreachable"
      >
        <header className={attendeeWalletHeading}>
          <h1>{WALLET_COPY.title}</h1>
        </header>
        <SurfaceState
          kind="error"
          title={WALLET_COPY.unreachable.title}
          detail={WALLET_COPY.unreachable.detail}
          testId="wallet-unreachable-state"
          action={
            <Button asChild variant="attendeePrimary">
              <Link href="/wallet">Thử lại</Link>
            </Button>
          }
        />
      </ConsumerPageShell>
    );
  }

  if (result.status === 'invalid') {
    return (
      <ConsumerPageShell
        mainClassName={attendeeWalletPage}
        mainTestId="wallet-invalid"
      >
        <header className={attendeeWalletHeading}>
          <h1>{WALLET_COPY.title}</h1>
        </header>
        <SurfaceState
          kind="error"
          title={WALLET_COPY.invalid.title}
          detail={WALLET_COPY.invalid.detail}
          testId="wallet-invalid-state"
          action={
            <Button asChild variant="attendeePrimary">
              <Link href="/wallet">Thử lại</Link>
            </Button>
          }
        />
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
      <header className={attendeeWalletHeading}>
        <div>
          <h1>{WALLET_COPY.title}</h1>
          <p className={attendeeWalletIntro}>{WALLET_COPY.intro}</p>
        </div>
        <Button asChild variant="attendeePrimary" className={attendeeWalletHeadingCta}>
          <Link href="/redeem">Đổi mã lấy vé</Link>
        </Button>
      </header>

      {tickets.length === 0 ? (
        <SurfaceState
          kind="empty"
          title={WALLET_COPY.empty.title}
          detail={WALLET_COPY.empty.detail}
          testId="wallet-empty"
          action={
            <Button asChild variant="attendeePrimary">
              <Link href="/redeem">Đổi mã lấy vé</Link>
            </Button>
          }
        />
      ) : (
        <>
          <WalletEventFilters
            filters={filters}
            activeEventId={eventFilter}
            totalCount={tickets.length}
          />
          {visible.length === 0 ? (
            <SurfaceState
              kind="empty"
              title="Không có vé cho bộ lọc này"
              detail="Chọn «Tất cả» hoặc sự kiện khác để xem vé của bạn."
              testId="wallet-filter-empty"
              action={
                <Button asChild variant="attendeePrimary">
                  <Link href="/wallet">Xem tất cả vé</Link>
                </Button>
              }
            />
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
