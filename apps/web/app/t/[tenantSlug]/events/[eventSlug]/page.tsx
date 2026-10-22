import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ThemeProvider,
  brandingFromEventBrand,
  brandingToCssVars,
} from '../../../../../src/branding';
import { SiteNav } from '../../../../../src/site-chrome';
import {
  PUBLIC_EVENT_COPY,
  formatPublishedEventDate,
  heroCopyFromSections,
  loadPublishedEventDetail,
  visiblePublishedSections,
} from '../../../../../src/published';
import { publishedSectionKindLabel } from '../../../../../src/published/section-label';
import { SurfaceState } from '../../../../../src/ui/surface-state';
import { eventArtTone } from '../../../../../src/ui/event-art-tone';
import sideboxStyles from './event-detail-sidebox.module.css';

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

function EventErrorShell({
  testId,
  title,
  detail,
}: {
  testId: string;
  title: string;
  detail: string;
}) {
  return (
    <main id="main" className="container shell event-page">
      <SiteNav />
      <SurfaceState
        kind="error"
        title={title}
        detail={detail}
        testId={testId}
        action={
          <Link className="button" href="/">
            Về trang chủ
          </Link>
        }
      />
    </main>
  );
}

export default async function EventPage({ params }: Props) {
  const { tenantSlug, eventSlug } = await params;
  const result = await loadPublishedEventDetail(tenantSlug, eventSlug);

  if (result.status === 'not-found') notFound();

  if (result.status === 'unreachable') {
    return (
      <EventErrorShell
        testId="event-unreachable"
        title={PUBLIC_EVENT_COPY.detailUnreachable.title}
        detail={PUBLIC_EVENT_COPY.detailUnreachable.detail}
      />
    );
  }

  if (result.status === 'invalid') {
    return (
      <EventErrorShell
        testId="event-invalid"
        title={PUBLIC_EVENT_COPY.detailInvalid.title}
        detail={PUBLIC_EVENT_COPY.detailInvalid.detail}
      />
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
  const heroCopy = heroCopyFromSections(event.sections);
  const infoSections = sections.filter(
    (s) => s.kind === 'info' || s.kind === 'guide',
  );
  const redeemHref = `/redeem?tenantSlug=${encodeURIComponent(event.tenantSlug)}&eventSlug=${encodeURIComponent(event.slug)}`;
  const locationLabel = event.location?.trim() || null;
  const heroTone = eventArtTone(event.id);

  return (
    <ThemeProvider branding={branding} applyCssVars>
      <main
        id="main"
        className="event-page"
        style={themeVars}
        data-branding-source={branding.source}
        data-testid="event-published"
      >
        <SiteNav />
        <div className="container event-detail-body">
          <Link className="event-detail-back" href="/">
            <span aria-hidden="true">‹</span> Tất cả sự kiện
          </Link>

          <div
            className={`event-detail-hero event-detail-hero-art event-detail-hero-art--${heroTone}`}
            data-testid="event-hero-media"
          >
            <div className="event-detail-hero-art__inner">
              <h1 id="event-title" className="event-detail-hero-art__title">
                {event.name}
              </h1>
              <p className="event-detail-hero-art__meta">
                {whenLabel && event.startsAt ? (
                  <time dateTime={event.startsAt}>{whenLabel}</time>
                ) : (
                  <span>{PUBLIC_EVENT_COPY.noStartsAt}</span>
                )}
                {locationLabel ? (
                  <>
                    <span className="event-detail-hero-art__sep" aria-hidden="true">
                      ·
                    </span>
                    <span>{locationLabel}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="event-detail-cols">
            <div className="event-detail-main">
              {heroCopy.eyebrow ? (
                <p className="eyebrow">{heroCopy.eyebrow}</p>
              ) : null}
              <p className="event-detail-org" data-testid="event-hero-support">
                {event.brand.organizationName}
              </p>

              <div
                className="event-facts"
                aria-label="Thông tin nhanh"
                data-testid="event-facts"
              >
                <div>
                  <small>Thời gian</small>
                  <p>
                    {whenLabel && event.startsAt ? (
                      <>
                        <time dateTime={event.startsAt}>{whenLabel}</time>
                        <span className="event-facts__tz">{event.timezone}</span>
                      </>
                    ) : (
                      <span>{PUBLIC_EVENT_COPY.noStartsAt}</span>
                    )}
                  </p>
                </div>
                <div>
                  <small>Địa điểm</small>
                  <p>
                    {locationLabel ?? (
                      <span className="muted">
                        {PUBLIC_EVENT_COPY.detailLocationUnknown}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="event-prose" id="event-details">
                <h2>Về sự kiện</h2>
                <p>{heroCopy.intro ?? PUBLIC_EVENT_COPY.detailAboutFallback}</p>
                <h3>{PUBLIC_EVENT_COPY.detailAttendTitle}</h3>
                <p>{PUBLIC_EVENT_COPY.detailAttendBody}</p>
                {infoSections.length > 0 ? (
                  <>
                    <h3>Chi tiết từ ban tổ chức</h3>
                    {infoSections.map((section) => (
                      <section key={section.id} aria-labelledby={`sec-${section.id}`}>
                        <h4 id={`sec-${section.id}`}>
                          {section.title?.trim() ||
                            publishedSectionKindLabel(section.kind)}
                        </h4>
                        {section.bodyMarkdown ? (
                          <p>{section.bodyMarkdown}</p>
                        ) : null}
                      </section>
                    ))}
                  </>
                ) : null}
              </div>
            </div>

            <aside
              className={`event-sidebox ${sideboxStyles.sidebox}`}
              aria-labelledby="event-sidebox-title"
              data-testid="event-sidebox"
            >
              <h2 id="event-sidebox-title">Vé tham dự của bạn</h2>
              <p className={sideboxStyles.lead}>
                Bạn có mã nhận vé từ nhà tổ chức?
              </p>
              <Link className={`button event-sidebox-cta ${sideboxStyles.cta}`} href={redeemHref}>
                Đổi mã lấy vé
              </Link>
              <p className={sideboxStyles.help}>
                Mã sẽ tự xác định đúng sự kiện và đơn vị tổ chức.
              </p>
            </aside>
          </div>

          {event.faq.length > 0 ? (
            <section className="event-faq" aria-labelledby="faq-title">
              <h2 id="faq-title">Câu hỏi thường gặp</h2>
              {event.faq.map((item, index) => (
                <details key={`faq-${index}`}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </section>
          ) : null}
        </div>
      </main>
    </ThemeProvider>
  );
}
