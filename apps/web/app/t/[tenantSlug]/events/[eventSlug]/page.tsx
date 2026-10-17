import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ThemeProvider,
  brandingFromEventBrand,
  brandingToCssVars,
} from '../../../../../src/branding';
import { Wordmark } from '../../../../../src/site-chrome';
import {
  demoEventRoutes,
  findDemoEvent,
  formatEventDate,
} from '../../../../../src/events';
import { demoMediaForEventId } from '../../../../../src/demo-media';
import { EventBanner, EventLogo } from '../../../../../src/ui/event-media';

type Props = { params: Promise<{ tenantSlug: string; eventSlug: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return demoEventRoutes();
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenantSlug, eventSlug } = await params;
  const event = findDemoEvent(tenantSlug, eventSlug);
  if (!event) notFound();
  return {
    title: `${event.name} — ${event.brand.organizationName}`,
    description: `Sự kiện demo hư cấu của ${event.brand.organizationName}. ${event.description}`,
  };
}
export default async function EventPage({ params }: Props) {
  const { tenantSlug, eventSlug } = await params;
  const event = findDemoEvent(tenantSlug, eventSlug);
  if (!event) notFound();
  const demoMedia = demoMediaForEventId(event.id);
  const branding = brandingFromEventBrand(event.brand, tenantSlug);
  const themeVars = {
    ...brandingToCssVars(branding),
    ['--brand' as string]: event.brand.primaryColor,
  } as CSSProperties;

  return (
    <ThemeProvider branding={branding} applyCssVars>
      <main
        id="main"
        className={`event-page ${event.theme}`}
        style={themeVars}
        data-branding-source={branding.source}
      >
        <div className="container">
          <nav aria-label="Điều hướng sự kiện">
            <Wordmark />
            <span>{event.brand.organizationName}</span>
          </nav>
          <p className="demo-label">Sự kiện demo · Fixture hư cấu</p>
          <section className="hero" aria-labelledby="event-title">
            <div>
              <EventLogo
                eventId={event.id}
                tenantSlug={event.tenantSlug}
                className="event-logo event-logo-hero"
                testId="event-hero-logo"
                alt={`Logo ${event.brand.organizationName}`}
              />
              <p className="eyebrow">{event.category}</p>
              <h1 id="event-title">{event.name}</h1>
              <p className="intro">{event.description}</p>
              <a className="button" href="#event-details">
                Xem chi tiết ngày <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="poster poster-media" data-testid="event-hero-media">
              {demoMedia ? (
                <EventBanner
                  eventId={event.id}
                  tenantSlug={event.tenantSlug}
                  className="event-banner event-banner-hero"
                  testId="event-hero-banner"
                  alt={`Banner ${event.name}`}
                />
              ) : (
                <>
                  <span className="poster-orbit" aria-hidden="true" />
                  <span className="poster-word" aria-hidden="true">
                    {event.theme === 'festival'
                      ? 'CẢM NHẬN VUI.'
                      : 'GÓC NHÌN MỚI.'}
                  </span>
                  <span className="poster-caption" aria-hidden="true">
                    {event.brand.organizationName} / 2026
                  </span>
                </>
              )}
            </div>
          </section>
          <section
            id="event-details"
            className="details"
            aria-labelledby="details-title"
          >
            <h2 id="details-title">Lên kế hoạch cho ngày.</h2>
            <dl>
              <div>
                <dt>Khi nào</dt>
                <dd>
                  <time dateTime={event.startsAt}>
                    {formatEventDate(event)}
                  </time>
                  <small>{event.timezone}</small>
                </dd>
              </div>
              <div>
                <dt>Ở đâu</dt>
                <dd>{event.location}</dd>
              </div>
              <div>
                <dt>Tổ chức bởi</dt>
                <dd>{event.brand.organizationName}</dd>
              </div>
            </dl>
          </section>
          <section className="highlights" aria-labelledby="highlights-title">
            <p className="eyebrow">Gợi ý trước khi đến</p>
            <h2 id="highlights-title">Đến với sự tò mò.</h2>
            <ul>
              {event.highlights.map((highlight, index) => (
                <li key={highlight}>
                  <span aria-hidden="true">0{index + 1}</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </section>
          <aside className="notice">
            <h2>Chỉ là bản xem trước demo</h2>
            <p>
              Nội dung fixture hư cấu, không phải listing live. Đổi mã thật
              (tenant/event UUID + mã) tại <Link href="/redeem">Đổi mã</Link>{' '}
              sau khi đăng nhập Keycloak.
            </p>
          </aside>
          <section className="faq" aria-labelledby="faq-title">
            <h2 id="faq-title">Trước khi đi</h2>
            <details>
              <summary>Tôi lấy vé ở đây được không?</summary>
              <p>
                Không trên trang fixture này. Dùng{' '}
                <Link href="/redeem">form đổi mã</Link> với UUID tenant/event và
                mã đổi qua Nest API (Keycloak BFF).
              </p>
            </details>
            <details>
              <summary>Ngày và địa điểm đã chốt chưa?</summary>
              <p>Chưa. Mọi chi tiết trên trang này là fixture demo hư cấu.</p>
            </details>
          </section>
          <Link className="back-link" href="/">
            ← Tất cả sự kiện demo
          </Link>
        </div>
      </main>
    </ThemeProvider>
  );
}
