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
