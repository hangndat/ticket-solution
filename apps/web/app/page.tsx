import Link from 'next/link';
import type { PublishedEventSummary } from '@ticket/contracts';
import { HeroWordmark } from '../src/branding/hero-wordmark';
import { loginHref } from '../src/oidc/login-href';
import { authNoticeFromParam } from '../src/oidc/auth-notice';
import { SiteNav } from '../src/site-chrome';
import {
  PUBLIC_EVENT_COPY,
  homeTenantSlugs,
  loadPublishedEventList,
  publishedEventHref,
} from '../src/published';
import { SurfaceState } from '../src/ui/surface-state';
import { EventBanner, EventLogo } from '../src/ui/event-media';

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

function staffDeniedCopy(notice: string | undefined): {
  title: string;
  detail: string;
} | null {
  if (notice === 'admin_denied') {
    return {
      title: 'Không đủ quyền quản trị',
      detail:
        'Tài khoản hiện tại không có quyền mở không gian quản trị sự kiện. Liên hệ chủ tổ chức nếu bạn cần quyền này.',
    };
  }
  if (notice === 'gate_denied') {
    return {
      title: 'Không đủ quyền cổng',
      detail:
        'Tài khoản hiện tại không được gán quyền check-in. Liên hệ chủ tổ chức nếu bạn cần vào cổng.',
    };
  }
  return null;
}

function EventCard({ event }: { event: PublishedEventSummary }) {
  return (
    <Link
      className="event-row"
      href={publishedEventHref(event)}
      role="listitem"
      data-testid={`home-event-${event.id}`}
    >
      <EventBanner
        eventId={event.id}
        tenantSlug={event.tenantSlug}
        bannerUrl={event.brand.bannerUrl}
        className="event-banner event-banner-card"
        testId={`home-banner-${event.id}`}
        alt=""
      />
      <EventLogo
        eventId={event.id}
        tenantSlug={event.tenantSlug}
        logoUrl={event.brand.logoUrl}
        className="event-logo event-logo-card"
        testId={`home-logo-${event.id}`}
        alt=""
      />
      <span className="eyebrow">{event.brand.organizationName}</span>
      <h2>{event.name}</h2>
      <p>{event.location ?? event.timezone}</p>
      <span className="card-action">
        Xem sự kiện <span aria-hidden="true">↗</span>
      </span>
    </Link>
  );
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const catalog = await loadHomeCatalog();
  const denied = staffDeniedCopy(params.notice?.trim());
  const authNotice = authNoticeFromParam(params.notice?.trim(), {
    retryHref: loginHref('/'),
  });
  const featured =
    catalog.status === 'ok' && catalog.items.length > 0
      ? catalog.items[0]
      : null;
  const catalogRest =
    catalog.status === 'ok' && featured
      ? catalog.items.slice(1)
      : catalog.status === 'ok'
        ? catalog.items
        : [];
  const homeLogin = loginHref('/');

  return (
    <main id="main" className="container home">
      <SiteNav />
      <section className="home-hero" aria-labelledby="home-title">
        <HeroWordmark />
        <h1 id="home-title">Điều tốt đẹp đưa chúng ta lại gần.</h1>
        <p className="intro">
          Đổi mã lấy vé, nhận lời mời, hoặc xem sự kiện đã xuất bản.
        </p>
        <p className="home-cta auth-buttons">
          <Link className="button" href="/redeem">
            Đổi mã lấy vé
          </Link>
          <a className="button-link button-link-secondary" href={homeLogin}>
            Đăng nhập
          </a>
        </p>
      </section>

      {featured ? (
        <Link
          className="home-featured"
          href={publishedEventHref(featured)}
          data-testid={`home-featured-${featured.id}`}
          aria-label={`Xem sự kiện ${featured.name}`}
        >
          <EventBanner
            eventId={featured.id}
            tenantSlug={featured.tenantSlug}
            bannerUrl={featured.brand.bannerUrl}
            className="event-banner home-featured-banner"
            testId={`home-featured-banner-${featured.id}`}
            alt=""
          />
          <span className="home-featured-meta">
            <span className="eyebrow">{featured.brand.organizationName}</span>
            <span className="home-featured-name">{featured.name}</span>
          </span>
        </Link>
      ) : null}

      {authNotice ? (
        <aside
          className="notice state-error"
          role="alert"
          data-testid="home-auth-notice"
        >
          <h2>{authNotice.title}</h2>
          <p>{authNotice.detail}</p>
          <p className="home-cta auth-buttons">
            <a className="button" href={authNotice.retryHref}>
              Thử lại
            </a>
            <Link className="button-link button-link-secondary" href="/">
              Ở lại trang chủ
            </Link>
          </p>
        </aside>
      ) : null}

      {denied ? (
        <aside
          className="notice state-error"
          role="status"
          data-testid="staff-denied-notice"
        >
          <h2>{denied.title}</h2>
          <p>{denied.detail}</p>
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
            <Link className="button" href="/">
              Thử lại
            </Link>
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
            <Link className="button" href="/">
              Thử lại
            </Link>
          }
        />
      ) : null}

      {catalog.status === 'ok' ? (
        <div className="event-list" role="list">
          {featured ? (
            <EventCard event={featured} key={featured.id} />
          ) : null}
          {catalogRest.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
