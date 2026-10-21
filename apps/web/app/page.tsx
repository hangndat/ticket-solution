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
} from '../src/published';
import { SurfaceState } from '../src/ui/surface-state';
import { HomeCatalogGrid } from '../src/ui/event-media';

/** Soft-redirect landing notices from staff routes (O02) + auth stub. */
export const dynamic = 'force-dynamic';

const HOME_CATALOG_STYLES = `
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.home.home--catalog .home-hero {
  max-width: none;
  margin-top: var(--space-6);
}
.home.home--catalog .home-hero h1 {
  font-size: clamp(1.85rem, 4.5vw, 2.4rem);
  letter-spacing: -0.04em;
  line-height: 1.15;
  margin-bottom: var(--space-3);
}
.home.home--catalog .home-hero .intro {
  max-width: 36rem;
  font-size: 1.05rem;
  color: var(--muted);
}
.wordmark-hero--catalog {
  margin-bottom: var(--space-3);
  font-size: clamp(1.1rem, 2.5vw, 1.35rem);
}
.home-catalog-tools {
  display: flex;
  gap: 10px;
  margin: var(--space-6) 0 var(--space-5);
  align-items: stretch;
}
.home-catalog-search {
  flex: 1;
  display: block;
}
.home-catalog-search input,
.home-catalog-filter select {
  width: 100%;
  min-height: 46px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: #fff;
  font: inherit;
  color: var(--ink);
}
.home-catalog-filter select {
  min-width: 11rem;
  cursor: pointer;
}
.home-catalog-grid {
  display: grid;
  gap: 22px;
  margin: 0 0 var(--space-7);
}
.home-catalog-card {
  border-bottom: 1px solid var(--line);
  padding-bottom: var(--space-4);
}
.home-catalog-card__link {
  display: block;
  text-decoration: none;
  color: inherit;
}
.home-catalog-card__link:focus-visible {
  outline-offset: 4px;
}
.home-catalog-card__art {
  position: relative;
  height: 175px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #182941;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.home-catalog-card__art::after {
  content: '';
  width: 180px;
  height: 180px;
  border: 32px solid #f26583;
  position: absolute;
  right: -65px;
  top: -10px;
  border-radius: 50%;
  opacity: 0.65;
  pointer-events: none;
}
.home-catalog-card__art--green {
  background: #13504b;
}
.home-catalog-card__art--green::after {
  border-color: #82d6b3;
}
.home-catalog-card__art--gold {
  background: #6e451d;
}
.home-catalog-card__art--gold::after {
  border-color: #eac786;
}
.home-catalog-card__banner {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.home-catalog-card__art-fallback {
  font-family: var(--font-display), Sora, ui-sans-serif, sans-serif;
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  z-index: 1;
}
.home-catalog-card__info {
  padding-top: var(--space-4);
  display: grid;
  gap: var(--space-2);
}
.home-catalog-card__title {
  font-size: 1.125rem;
  margin: 0;
  font-family: var(--font-display), Sora, ui-sans-serif, sans-serif;
  letter-spacing: -0.02em;
}
.home-catalog-card__meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.5;
}
.home-catalog-card__action {
  margin-top: var(--space-2);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--signal);
}
.home-catalog-empty {
  margin: var(--space-5) 0 var(--space-7);
  padding: var(--space-6);
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: var(--radius-md);
  color: var(--muted);
}
@media (min-width: 768px) {
  .home-catalog-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .home-catalog-tools {
    flex-wrap: wrap;
  }
  .home-catalog-search {
    flex-basis: 100%;
  }
  .home-catalog-filter {
    flex: 1;
  }
}
`;

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

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const catalog = await loadHomeCatalog();
  const denied = staffDeniedCopy(params.notice?.trim());
  const authNotice = authNoticeFromParam(params.notice?.trim(), {
    retryHref: loginHref('/'),
  });

  return (
    <main id="main" className="container home home--catalog">
      <style>{HOME_CATALOG_STYLES}</style>
      <SiteNav />
      <section className="home-hero" aria-labelledby="home-title">
        <HeroWordmark presentation="catalog" />
        <h1 id="home-title">Hẹn bạn ở trải nghiệm tiếp theo.</h1>
        <p className="intro">
          Khám phá sự kiện từ những nhà tổ chức trên khắp nền tảng. Đổi mã lấy
          vé qua mục Đổi mã trên thanh điều hướng.
        </p>
      </section>

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
        <HomeCatalogGrid items={catalog.items} />
      ) : null}
    </main>
  );
}
