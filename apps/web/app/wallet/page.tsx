import type { Metadata } from 'next';
import { Button } from '@ticket/ui';
import Link from 'next/link';
import { isUuid } from '../../src/bff/ids';
import { loginHref } from '../../src/oidc/login-href';
import { readRefreshToken } from '../../src/oidc/cookies';
import {
  redirectOwnerDiscovery401,
  renewOwnerSessionIfPossible,
} from '../../src/oidc/owner-session-guard';
import { loadOwnerWallet, WALLET_COPY } from '../../src/owner-ticket';
import {
  buildWalletEventFilters,
  WalletEventFilters,
} from '../../src/owner-ticket/wallet-event-filters';
import { WalletTicketCard } from '../../src/owner-ticket/wallet-ticket-card';
import { SiteNav } from '../../src/site-chrome';
import { SurfaceState } from '../../src/ui/surface-state';
import walletStyles from './wallet-page.module.css';

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
      <main
        id="main"
        className={`lp-container shell wallet-page ${walletStyles.page}`}
        data-testid="wallet-need-login"
      >
        <SiteNav />
        <header className={walletStyles.heading}>
          <h1>{WALLET_COPY.title}</h1>
          <p className="intro">{WALLET_COPY.intro}</p>
        </header>
        <SurfaceState
          kind="empty"
          title={WALLET_COPY.needLogin.title}
          detail={WALLET_COPY.needLogin.detail}
          testId="wallet-need-login-state"
          action={
            <div className="auth-buttons">
              <Button asChild variant="brand">
                <a href={walletLogin}>Đăng nhập</a>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/redeem">Đổi mã lấy vé</Link>
              </Button>
            </div>
          }
        />
      </main>
    );
  }

  if (result.status === 'unreachable') {
    return (
      <main
        id="main"
        className={`lp-container shell wallet-page ${walletStyles.page}`}
        data-testid="wallet-unreachable"
      >
        <SiteNav />
        <header className={walletStyles.heading}>
          <h1>{WALLET_COPY.title}</h1>
        </header>
        <SurfaceState
          kind="error"
          title={WALLET_COPY.unreachable.title}
          detail={WALLET_COPY.unreachable.detail}
          testId="wallet-unreachable-state"
          action={
            <Button asChild variant="brand">
              <Link href="/wallet">Thử lại</Link>
            </Button>
          }
        />
      </main>
    );
  }

  if (result.status === 'invalid') {
    return (
      <main
        id="main"
        className={`lp-container shell wallet-page ${walletStyles.page}`}
        data-testid="wallet-invalid"
      >
        <SiteNav />
        <header className={walletStyles.heading}>
          <h1>{WALLET_COPY.title}</h1>
        </header>
        <SurfaceState
          kind="error"
          title={WALLET_COPY.invalid.title}
          detail={WALLET_COPY.invalid.detail}
          testId="wallet-invalid-state"
          action={
            <Button asChild variant="brand">
              <Link href="/wallet">Thử lại</Link>
            </Button>
          }
        />
      </main>
    );
  }

  const { tickets, tenantSlugById } = result;
  const filters = buildWalletEventFilters(tickets);
  const visible = eventFilter
    ? tickets.filter((ticket) => ticket.eventId === eventFilter)
    : tickets;

  return (
    <main
      id="main"
      className={`lp-container shell wallet-page ${walletStyles.page}`}
      data-testid="wallet-ready"
    >
      <SiteNav />
      <header className={walletStyles.heading}>
        <div>
          <h1>{WALLET_COPY.title}</h1>
          <p className="intro">{WALLET_COPY.intro}</p>
        </div>
        <Button asChild variant="brand" className={walletStyles.headingCta}>
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
            <Button asChild variant="brand">
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
                <Button asChild variant="brand">
                  <Link href="/wallet">Xem tất cả vé</Link>
                </Button>
              }
            />
          ) : (
            <div className={walletStyles.grid} role="list" data-testid="wallet-ticket-grid">
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
    </main>
  );
}
