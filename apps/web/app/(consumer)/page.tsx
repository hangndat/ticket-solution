import Link from 'next/link';
import type { PublishedEventSummary } from '@ticket/contracts';
import { Button } from '@ticket/ui';
import { loginHref } from '../../src/oidc/login-href';
import { authNoticeFromParam } from '../../src/oidc/auth-notice';
import { ConsumerPageShell } from '../../src/consumer-page-shell';
import { HomeHero } from '../../src/i18n';
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
import { RateLimitState } from '../../src/published/rate-limit-state';

/** Attendee home + auth stub notices (staff lives on portal — ADR-20). */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ notice?: string }>;
};

type HomeCatalog =
  | { status: 'ok'; items: PublishedEventSummary[]; rateLimited: boolean }
  | { status: 'empty' }
  | { status: 'rate-limited' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

async function loadHomeCatalog(): Promise<HomeCatalog> {
  const slugs = homeTenantSlugs();
  const items: PublishedEventSummary[] = [];
  let sawRateLimited = false;
  let sawUnreachable = false;
  let sawInvalid = false;

  for (const slug of slugs) {
    const result = await loadPublishedEventList(slug, {
      limit: 50,
      revalidateSeconds: 0,
    });
    if (result.status === 'ok') {
      items.push(...result.body.items);
      continue;
    }
    if (result.status === 'rate-limited') sawRateLimited = true;
    else if (result.status === 'unreachable') sawUnreachable = true;
    else sawInvalid = true;
  }

  if (items.length > 0) return { status: 'ok', items, rateLimited: sawRateLimited };
  if (sawRateLimited) return { status: 'rate-limited' };
  if (sawUnreachable) return { status: 'unreachable' };
  if (sawInvalid) return { status: 'invalid' };
  return { status: 'empty' };
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const catalog = await loadHomeCatalog();
  const authNotice = authNoticeFromParam(params.notice?.trim(), {
    retryHref: loginHref('/'),
  });

  return (
    <ConsumerPageShell
      mainClassName={attendeeHomeMain}
    >
      <div data-testid="attendee-home">
      <HomeHero />

      {authNotice ? (
        <aside
          className={attendeeNoticeError}
          role="alert"
          data-testid="home-auth-notice"
        >
          <h2>{authNotice.title}</h2>
          <p>{authNotice.detail}</p>
          <p className={attendeeAuthButtons}>
            <Button asChild variant="brand">
              <a href={authNotice.retryHref}>Thử lại</a>
            </Button>
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

      {catalog.status === 'ok' && catalog.rateLimited ? (
        <RateLimitState kind="homePartialRateLimited" retryHref="/" />
      ) : null}

      {catalog.status === 'rate-limited' ? (
        <RateLimitState kind="homeRateLimited" retryHref="/" />
      ) : null}

      {catalog.status === 'unreachable' ? (
        <SurfaceState
          kind="error"
          title={PUBLIC_EVENT_COPY.homeUnreachable.title}
          detail={PUBLIC_EVENT_COPY.homeUnreachable.detail}
          testId="home-events-unreachable"
          action={
            <Button asChild variant="brand">
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
            <Button asChild variant="brand">
              <Link href="/">Thử lại</Link>
            </Button>
          }
        />
      ) : null}

      {catalog.status === 'ok' ? (
        <HomeCatalogGrid items={catalog.items} />
      ) : null}
      </div>
    </ConsumerPageShell>
  );
}
