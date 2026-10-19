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
  PUBLIC_EVENT_COPY,
  formatPublishedEventDate,
  heroCopyFromSections,
  loadPublishedEventDetail,
  visiblePublishedSections,
} from '../../../../../src/published';
import { SurfaceState } from '../../../../../src/ui/surface-state';
import { EventBanner } from '../../../../../src/ui/event-media';

type Props = { params: Promise<{ tenantSlug: string; eventSlug: string }> };

/** ISR from published projection — no fixture generateStaticParams. */
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenantSlug, eventSlug } = await params;
  const result = await loadPublishedEventDetail(tenantSlug, eventSlug);
  if (result.status !== 'ok') {
    return { title: 'Sự kiện' };
  }
  const { event } = result;
  return {
    title: `${event.name} — ${event.brand.organizationName}`,
    description:
      heroCopyFromSections(event.sections).intro ??
      `${event.name} · ${event.brand.organizationName}`,
  };
}

export default async function EventPage({ params }: Props) {
  const { tenantSlug, eventSlug } = await params;
  const result = await loadPublishedEventDetail(tenantSlug, eventSlug);

  if (result.status === 'not-found') notFound();

  if (result.status === 'unreachable') {
    return (
      <main id="main" className="container shell">
        <SurfaceState
          kind="error"
          title={PUBLIC_EVENT_COPY.detailUnreachable.title}
          detail={PUBLIC_EVENT_COPY.detailUnreachable.detail}
          testId="event-unreachable"
          action={
            <Link className="button" href="/">
              Về trang chủ
            </Link>
          }
        />
      </main>
    );
  }

  if (result.status === 'invalid') {
    return (
      <main id="main" className="container shell">
        <SurfaceState
          kind="error"
          title={PUBLIC_EVENT_COPY.detailInvalid.title}
          detail={PUBLIC_EVENT_COPY.detailInvalid.detail}
          testId="event-invalid"
          action={
            <Link className="button" href="/">
              Về trang chủ
            </Link>
          }
        />
      </main>
    );
  }

  const { event } = result;
  const branding = brandingFromEventBrand(event.brand, tenantSlug);
  const themeVars = {
    ...brandingToCssVars(branding),
    ['--brand' as string]: event.brand.primaryColor,
  } as CSSProperties;
  const sections = visiblePublishedSections(event);
  const whenLabel = formatPublishedEventDate(event.startsAt, event.timezone);
  const infoSections = sections.filter(
    (s) => s.kind === 'info' || s.kind === 'guide',
  );
  const redeemHref = `/redeem?tenantSlug=${encodeURIComponent(event.tenantSlug)}&eventSlug=${encodeURIComponent(event.slug)}`;
  const supportParts = [whenLabel, event.location?.trim()].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  const heroSupport =
    supportParts.length > 0
      ? supportParts.join(' · ')
      : PUBLIC_EVENT_COPY.noStartsAt;

  return (
    <ThemeProvider branding={branding} applyCssVars>
      <main
        id="main"
        className="event-page"
        style={themeVars}
        data-branding-source={branding.source}
        data-testid="event-published"
      >
        <div className="container event-chrome">
          <nav aria-label="Điều hướng sự kiện">
            <Wordmark />
            <span>{event.brand.organizationName}</span>
          </nav>
        </div>
        <section className="hero hero-atmosphere" aria-labelledby="event-title">
          <div
            className="poster poster-media event-hero-bleed"
            data-testid="event-hero-media"
          >
            <EventBanner
              eventId={event.id}
              tenantSlug={event.tenantSlug}
              bannerUrl={event.brand.bannerUrl}
              className="event-banner event-banner-hero"
              testId="event-hero-banner"
              alt={`Banner ${event.name}`}
            />
          </div>
          <div className="container hero-copy event-hero-copy">
            <h1 id="event-title">{event.name}</h1>
            <p className="hero-support" data-testid="event-hero-support">
              {heroSupport}
            </p>
            <div className="hero-cta">
              <Link className="button" href={redeemHref}>
                Đổi mã lấy vé
              </Link>
              <Link className="button-link button-link-secondary" href="/claim">
                Nhận lời mời
              </Link>
              <a className="button-link button-link-secondary" href="#event-details">
                Chi tiết <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </section>
        <div className="container">
          <section
            id="event-details"
            className="details"
            aria-labelledby="details-title"
          >
            <h2 id="details-title">Thông tin sự kiện</h2>
            <dl>
              <div>
                <dt>Khi nào</dt>
                <dd>
                  {whenLabel && event.startsAt ? (
                    <>
                      <time dateTime={event.startsAt}>{whenLabel}</time>
                      <small>{event.timezone}</small>
                    </>
                  ) : (
                    <span>{PUBLIC_EVENT_COPY.noStartsAt}</span>
                  )}
                </dd>
              </div>
              {event.location ? (
                <div>
                  <dt>Ở đâu</dt>
                  <dd>{event.location}</dd>
                </div>
              ) : null}
              <div>
                <dt>Tổ chức bởi</dt>
                <dd>{event.brand.organizationName}</dd>
              </div>
            </dl>
          </section>

          {infoSections.length > 0 ? (
            <section className="highlights" aria-labelledby="content-title">
              <h2 id="content-title">Chi tiết từ ban tổ chức</h2>
              <ul>
                {infoSections.map((section) => (
                  <li key={section.id}>
                    <strong>{section.title?.trim() || section.kind}</strong>
                    {section.bodyMarkdown ? (
                      <p>{section.bodyMarkdown}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {event.faq.length > 0 ? (
            <section className="faq" aria-labelledby="faq-title">
              <h2 id="faq-title">Câu hỏi thường gặp</h2>
              {event.faq.map((item, index) => (
                <details key={`faq-${index}`}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </section>
          ) : null}

          <Link className="back-link" href="/">
            ← Tất cả sự kiện
          </Link>
        </div>
      </main>
    </ThemeProvider>
  );
}
