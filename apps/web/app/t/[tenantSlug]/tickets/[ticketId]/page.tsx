import type { Metadata } from 'next';
import Link from 'next/link';
import { isTenantSlug } from '../../../../../src/branding';
import { isUuid } from '../../../../../src/bff/ids';
import { OWNER_TICKET_COPY } from '../../../../../src/owner-ticket/copy';
import { ownerTicketAuthHref } from '../../../../../src/owner-ticket/paths';
import { readAccessToken } from '../../../../../src/oidc/cookies';
import { SiteNav } from '../../../../../src/site-chrome';
import { SurfaceState } from '../../../../../src/ui/surface-state';
import { OwnerTicketPanel } from './ticket-panel';

type Props = {
  params: Promise<{ tenantSlug: string; ticketId: string }>;
  searchParams: Promise<{ tenantId?: string }>;
};

/** Owner session + BFF — never SSG a stale auth surface. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticketId } = await params;
  return {
    title: OWNER_TICKET_COPY.pageTitle,
    description: OWNER_TICKET_COPY.pageIntro,
    other: { 'ticket-id': ticketId },
  };
}

/**
 * Email deep-link landing: `/t/{tenantSlug}/tickets/{ticketId}`.
 * Guest → HTTP 200 + login CTA (documented). Authenticated → me/tickets panel.
 * Invalid slug/id → HTTP 200 + explicit invalid surface (avoid Next streaming 404 quirk).
 */
export default async function OwnerTicketPage({ params, searchParams }: Props) {
  const { tenantSlug: rawSlug, ticketId: rawId } = await params;
  const tenantSlug = rawSlug?.trim().toLowerCase() ?? '';
  const ticketId = rawId?.trim() ?? '';
  const paramsOk = isTenantSlug(tenantSlug) && isUuid(ticketId);

  const query = await searchParams;
  const explicitTenantId = query.tenantId?.trim() || null;
  const token = await readAccessToken();
  const authHref = paramsOk
    ? ownerTicketAuthHref(tenantSlug, ticketId)
    : '/auth';

  return (
    <main
      id="main"
      className="container shell redeem-page"
      data-testid="owner-ticket-page"
      data-tenant-slug={tenantSlug || undefined}
      data-ticket-id={ticketId || undefined}
    >
      <SiteNav />
      <h1>{OWNER_TICKET_COPY.pageTitle}</h1>
      <p className="intro">{OWNER_TICKET_COPY.pageIntro}</p>

      {!paramsOk ? (
        <SurfaceState
          kind="error"
          title="Liên kết vé không hợp lệ"
          detail="Đường dẫn cần slug tổ chức và mã vé dạng UUID — không mở credential từ URL."
          testId="owner-ticket-invalid-params"
          action={
            <Link className="button" href="/">
              Về trang chủ
            </Link>
          }
        />
      ) : !token ? (
        <SurfaceState
          kind="empty"
          title={OWNER_TICKET_COPY.authRequired.title}
          detail={OWNER_TICKET_COPY.authRequired.detail}
          testId="owner-ticket-auth-required"
          action={
            <Link className="button" href={authHref}>
              Đăng nhập
            </Link>
          }
        />
      ) : (
        <OwnerTicketPanel
          tenantSlug={tenantSlug}
          ticketId={ticketId}
          explicitTenantId={explicitTenantId}
        />
      )}

      <p>
        <Link href="/">← Trang chủ</Link>
        {' · '}
        <Link href="/redeem">Đổi mã lấy vé</Link>
        {' · '}
        <Link href={authHref}>Đăng nhập</Link>
      </p>
    </main>
  );
}
