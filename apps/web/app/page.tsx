import Link from 'next/link';
import type { PublishedEventSummary } from '@ticket/contracts';
import { HeroWordmark } from '../src/branding/hero-wordmark';
import { SiteNav } from '../src/site-chrome';
import {
  PUBLIC_EVENT_COPY,
  homeTenantSlugs,
  isExplicitDemoLabel,
  loadPublishedEventList,
  publishedEventHref,
} from '../src/published';
import { SurfaceState } from '../src/ui/surface-state';
import { EventBanner, EventLogo } from '../src/ui/event-media';

/**
 * Request-time published catalog (ADR-19).
 * Avoid build-time SSG empty/unreachable snapshots when API is down during `next build`
 * (CI builds before test:routes mock). Never fall back to client fixtures.
 */
export const dynamic = 'force-dynamic';

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

export default async function Home() {
  const catalog = await loadHomeCatalog();

  return (
    <main id="main" className="container home">
      <SiteNav variant="guest" />
      <section className="home-hero" aria-labelledby="home-title">
        <HeroWordmark />
        <h1 id="home-title">Điều tốt đẹp đưa chúng ta lại gần.</h1>
        <p className="intro">
          Đổi mã lấy vé, nhận lời mời, hoặc xem sự kiện đã xuất bản — một thương
          hiệu, không chrome thử nghiệm trên đường khách.
        </p>
        <p className="home-cta">
          <Link className="button" href="/redeem">
            Đổi mã lấy vé
          </Link>
        </p>
      </section>

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
        />
      ) : null}

      {catalog.status === 'invalid' ? (
        <SurfaceState
          kind="error"
          title={PUBLIC_EVENT_COPY.homeInvalid.title}
          detail={PUBLIC_EVENT_COPY.homeInvalid.detail}
          testId="home-events-invalid"
        />
      ) : null}

      {catalog.status === 'ok' ? (
        <div className="event-list" role="list">
          {catalog.items.map((event) => {
            const demo = isExplicitDemoLabel(
              event.name,
              event.brand.organizationName,
            );
            return (
              <Link
                className="event-row"
                href={publishedEventHref(event)}
                key={event.id}
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
                <span className="eyebrow">
                  {event.brand.organizationName}
                  {demo ? ' · Demo' : ''}
                </span>
                <h2>{event.name}</h2>
                <p>{event.location ?? event.timezone}</p>
                <span className="card-action">
                  Xem sự kiện <span aria-hidden="true">↗</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <aside className="notice" role="note">
        <strong>Danh sách từ máy chủ.</strong> Chỉ sự kiện đã xuất bản công khai.
        Đổi mã thật tại <Link href="/redeem">Đổi mã lấy vé</Link>
        {' · '}
        <Link href="/auth">Đăng nhập</Link>.
      </aside>
    </main>
  );
}
