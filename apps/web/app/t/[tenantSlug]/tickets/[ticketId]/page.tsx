import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isUuid } from '../../../../../src/bff/ids';
import { isTenantSlug } from '../../../../../src/branding';
import {
  loadOwnerTicket,
  OWNER_TICKET_COPY,
} from '../../../../../src/owner-ticket';
import { SiteNav, Wordmark } from '../../../../../src/site-chrome';
import { SurfaceState } from '../../../../../src/ui/surface-state';

type Props = {
  params: Promise<{ tenantSlug: string; ticketId: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: OWNER_TICKET_COPY.title,
    description: 'Chi tiết vé dành cho chủ sở hữu đã đăng nhập.',
    robots: { index: false, follow: false },
  };
}

function ownerTicketPath(tenantSlug: string, ticketId: string): string {
  return `/t/${encodeURIComponent(tenantSlug)}/tickets/${encodeURIComponent(ticketId)}`;
}

export default async function OwnerTicketPage({ params }: Props) {
  const { tenantSlug: rawSlug, ticketId: rawId } = await params;
  const tenantSlug = rawSlug?.trim().toLowerCase() ?? '';
  const ticketId = rawId?.trim() ?? '';
  const path = ownerTicketPath(tenantSlug || 'x', ticketId || 'x');

  if (!tenantSlug || !isTenantSlug(tenantSlug) || !isUuid(ticketId)) {
    return (
      <main id="main" className="container shell" data-testid="owner-ticket-invalid">
        <SiteNav />
        <h1>{OWNER_TICKET_COPY.title}</h1>
        <SurfaceState
          kind="error"
          title={OWNER_TICKET_COPY.invalid.title}
          detail={OWNER_TICKET_COPY.invalid.detail}
          testId="owner-ticket-invalid-state"
          action={
            <Link className="button" href="/">
              Về trang chủ
            </Link>
          }
        />
      </main>
    );
  }

  const result = await loadOwnerTicket({ tenantSlug, ticketId });

  if (result.status === 'unauthenticated') {
    redirect(`/auth?next=${encodeURIComponent(path)}`);
  }

  if (result.status === 'unreachable') {
    return (
      <main id="main" className="container shell" data-testid="owner-ticket-unreachable">
        <SiteNav />
        <h1>{OWNER_TICKET_COPY.title}</h1>
        <SurfaceState
          kind="error"
          title={OWNER_TICKET_COPY.unreachable.title}
          detail={OWNER_TICKET_COPY.unreachable.detail}
          testId="owner-ticket-unreachable-state"
          action={
            <Link className="button" href={path}>
              Thử lại
            </Link>
          }
        />
      </main>
    );
  }

  if (
    result.status === 'not-found' ||
    result.status === 'forbidden' ||
    result.status === 'invalid'
  ) {
    // Same empty UX for miss / forbidden — no PII, not the public event 404 copy.
    return (
      <main id="main" className="container shell" data-testid="owner-ticket-missing">
        <SiteNav />
        <h1>{OWNER_TICKET_COPY.title}</h1>
        <SurfaceState
          kind="empty"
          title={OWNER_TICKET_COPY.missing.title}
          detail={OWNER_TICKET_COPY.missing.detail}
          testId="owner-ticket-missing-state"
          action={
            <Link className="button" href="/">
              Về trang chủ
            </Link>
          }
        />
      </main>
    );
  }

  const { ticket } = result;

  return (
    <main id="main" className="container shell" data-testid="owner-ticket-ready">
      <SiteNav />
      <nav aria-label="Điều hướng vé">
        <Wordmark />
      </nav>
      <h1>{OWNER_TICKET_COPY.title}</h1>
      <p className="intro">
        Vé thuộc tổ chức <code data-testid="owner-ticket-tenant">{tenantSlug}</code>.
        Chi tiết dưới đây chỉ dành cho chủ vé đã đăng nhập.
      </p>
      <dl data-testid="owner-ticket-detail">
        <div>
          <dt>Mã vé</dt>
          <dd>
            <code data-testid="owner-ticket-id">{ticket.ticketId}</code>
          </dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd data-testid="owner-ticket-state">{ticket.state}</dd>
        </div>
        <div>
          <dt>Phiên bản chứng thực</dt>
          <dd>{ticket.credentialVersion}</dd>
        </div>
        <div>
          <dt>Ngày cấp</dt>
          <dd>
            <time dateTime={ticket.createdAt}>{ticket.createdAt}</time>
          </dd>
        </div>
      </dl>
      <p>
        <Link className="back-link" href="/">
          ← Trang chủ
        </Link>
      </p>
    </main>
  );
}
