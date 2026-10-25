import Link from 'next/link';
import type { PublishedEventSummary } from '@ticket/contracts';
import { Button, CatalogHeroBand } from '@ticket/ui';
import { loginHref } from '../../src/oidc/login-href';
import { authNoticeFromParam } from '../../src/oidc/auth-notice';
import { loadOwnerWallet, ownedTicketCountByEventId } from '../../src/owner-ticket';
import { staffDeniedNotice } from '../../src/nav/staff-denied-copy';
import { ATTENDEE_COPY } from '../../src/attendee-copy';
import { ConsumerPageShell } from '../../src/consumer-page-shell';
import {
  attendeeAuthButtons,
  attendeeHomeMain,
  attendeeNoticeError,
} from '../../src/attendee-surface';
import {
  PUBLIC_EVENT_COPY,
  homeTenantSlugs,
  loadPublishedEventList,
} from '../../src/published';
import { SurfaceState } from '../../src/ui/surface-state';
import { HomeCatalogGrid } from '../../src/ui/event-media';

/** Soft-redirect landing notices from staff routes (O02) + auth stub. */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ notice?: string }>;
};

type HomeCatalog =
  | { status: 'ok'; items: PublishedEventSummary[] }
  | { status: 'empty' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

async function loadHomeCatalog(): Promise<HomeCatalog> {
  const slugs = homeTenantSlugs();
  const items: PublishedEventSummary[] = [];
  let sawUnreachable = false;
  let sawInvalid = false;

  for (const slug of slugs) {
    const result = await loadPublishedEventList(slug, { limit: 50 });
    if (result.status === 'ok') {
      items.push(...result.body.items);
      continue;
    }
    if (result.status === 'unreachable') sawUnreachable = true;
    else sawInvalid = true;
  }

  if (items.length > 0) return { status: 'ok', items };
  if (sawUnreachable) return { status: 'unreachable' };
  if (sawInvalid) return { status: 'invalid' };
  return { status: 'empty' };
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const catalog = await loadHomeCatalog();
  const wallet = await loadOwnerWallet();
  const ownedByEventId =
    wallet.status === 'ok'
      ? ownedTicketCountByEventId(wallet.tickets)
      : undefined;
  const denied = staffDeniedNotice(params.notice?.trim());
  const authNotice = authNoticeFromParam(params.notice?.trim(), {
    retryHref: loginHref('/'),
  });

  return (
    <ConsumerPageShell
      mainClassName={attendeeHomeMain}
    >
      <div data-testid="attendee-home">
      <CatalogHeroBand
        titleId="home-title"
        title={ATTENDEE_COPY.browseEvents}
        intro="Tìm sự kiện và xem thông tin tham dự."
      >
        <p className="m-0 mt-3 max-w-[36rem] text-[0.95rem] text-muted">
          <Link href="/redeem" className="font-semibold text-signal hover:underline">
            Có mã mời? Đổi mã lấy vé
          </Link>
        </p>
      </CatalogHeroBand>

      {authNotice ? (
        <aside
          className={attendeeNoticeError}
          role="alert"
          data-testid="home-auth-notice"
        >
          <h2>{authNotice.title}</h2>
          <p>{authNotice.detail}</p>
          <p className={attendeeAuthButtons}>
            <Button asChild variant="attendeePrimary">
              <a href={authNotice.retryHref}>Thử lại</a>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Ở lại trang chủ</Link>
            </Button>
          </p>
        </aside>
      ) : null}

      {denied ? (
        <aside
          className={attendeeNoticeError}
          role="status"
          data-testid="staff-denied-notice"
        >
          <h2>{denied.title}</h2>
          <p>{denied.detail}</p>
          <p className={attendeeAuthButtons}>
            {denied.portalAdminHref ? (
              <Button asChild variant="attendeePrimary">
                <a href={denied.portalAdminHref} data-testid="staff-denied-portal-cta">
                  Mở portal quản trị
                </a>
              </Button>
            ) : null}
            {params.notice?.trim() === 'gate_denied' ? (
              <Button asChild variant="secondary">
                <Link href="/wallet">Vé của tôi</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href="/">Ở lại trang chủ</Link>
            </Button>
          </p>
        </aside>
      ) : null}

      {catalog.status === 'empty' ? (
        <SurfaceState
          kind="empty"
          title={PUBLIC_EVENT_COPY.homeEmpty.title}
          detail={PUBLIC_EVENT_COPY.homeEmpty.detail}
          testId="home-events-empty"
        />
      ) : null}

      {catalog.status === 'unreachable' ? (
        <SurfaceState
          kind="error"
          title={PUBLIC_EVENT_COPY.homeUnreachable.title}
          detail={PUBLIC_EVENT_COPY.homeUnreachable.detail}
          testId="home-events-unreachable"
          action={
            <Button asChild variant="attendeePrimary">
              <Link href="/">Thử lại</Link>
            </Button>
          }
        />
      ) : null}

      {catalog.status === 'invalid' ? (
        <SurfaceState
          kind="error"
          title={PUBLIC_EVENT_COPY.homeInvalid.title}
          detail={PUBLIC_EVENT_COPY.homeInvalid.detail}
          testId="home-events-invalid"
          action={
            <Button asChild variant="attendeePrimary">
              <Link href="/">Thử lại</Link>
            </Button>
          }
        />
      ) : null}

      {catalog.status === 'ok' ? (
        <HomeCatalogGrid items={catalog.items} ownedByEventId={ownedByEventId} />
      ) : null}
      </div>
    </ConsumerPageShell>
  );
}
