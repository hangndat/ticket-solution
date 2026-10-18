import type { Metadata } from 'next';
import Link from 'next/link';
import { isUuid } from '../../../../../src/bff/ids';
import { isTenantSlug } from '../../../../../src/branding';
import { hasDemoMediaForEventId } from '../../../../../src/demo-media';
import { loginHref } from '../../../../../src/oidc/login-href';
import {
  loadOwnerTicket,
  OWNER_TICKET_COPY,
} from '../../../../../src/owner-ticket';
import { buildDisplayQrPayload } from '../../../../../src/owner-ticket/display-payload';
import { TicketQr } from '../../../../../src/owner-ticket/ticket-qr';
import { SiteNav } from '../../../../../src/site-chrome';
import { SurfaceState } from '../../../../../src/ui/surface-state';

type Props = {
  params: Promise<{ tenantSlug: string; ticketId: string }>;
  searchParams: Promise<{ tenantId?: string }>;
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

function shortTicketId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export default async function OwnerTicketPage({ params, searchParams }: Props) {
  const { tenantSlug: rawSlug, ticketId: rawId } = await params;
  const tenantSlug = rawSlug?.trim().toLowerCase() ?? '';
  const ticketId = rawId?.trim() ?? '';
  const path = ownerTicketPath(tenantSlug || 'x', ticketId || 'x');
  const query = await searchParams;
  const explicitTenantId = query.tenantId?.trim() || null;
  const ticketLogin = loginHref(path);

  if (!tenantSlug || !isTenantSlug(tenantSlug) || !isUuid(ticketId)) {
    return (
      <main
        id="main"
        className="container shell"
        data-testid="owner-ticket-invalid"
      >
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

  const result = await loadOwnerTicket({
    tenantSlug,
    ticketId,
    explicitTenantId,
  });

  if (result.status === 'unauthenticated') {
    return (
      <main
        id="main"
        className="container shell"
        data-testid="owner-ticket-need-login"
      >
        <SiteNav />
        <h1>{OWNER_TICKET_COPY.title}</h1>
        <SurfaceState
          kind="empty"
          title={OWNER_TICKET_COPY.needLogin.title}
          detail={OWNER_TICKET_COPY.needLogin.detail}
          testId="owner-ticket-need-login-state"
          action={
            <div className="auth-buttons">
              <a className="button" href={ticketLogin}>
                Đăng nhập
              </a>
              <Link className="button-link button-link-secondary" href="/redeem">
                Đổi mã lấy vé
              </Link>
            </div>
          }
        />
      </main>
    );
  }

  if (result.status === 'unreachable') {
    return (
      <main
        id="main"
        className="container shell"
        data-testid="owner-ticket-unreachable"
      >
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

  if (result.status === 'tenant-unresolved') {
    return (
      <main
        id="main"
        className="container shell"
        data-testid="owner-ticket-tenant-unresolved"
      >
        <SiteNav />
        <h1>{OWNER_TICKET_COPY.title}</h1>
        <SurfaceState
          kind="empty"
          title={OWNER_TICKET_COPY.tenantUnresolved.title}
          detail={OWNER_TICKET_COPY.tenantUnresolved.detail}
          testId="owner-ticket-tenant-unresolved-state"
          action={
            <Link className="button" href="/redeem">
              Đổi mã lấy vé
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
    return (
      <main
        id="main"
        className="container shell"
        data-testid="owner-ticket-missing"
      >
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
  const isDemo =
    hasDemoMediaForEventId(ticket.eventId) ||
    tenantSlug.includes('demo') ||
    tenantSlug.includes('fixture');
  const qrLabel = `Mã QR vé ${shortTicketId(ticket.ticketId)}`;
  const qrPayload = buildDisplayQrPayload(ticket);
  const stateBlocked =
    ticket.state === 'REVOKED' ||
    ticket.state === 'EXPIRED' ||
    ticket.state === 'USED' ||
    ticket.state === 'CHECKED_IN';

  return (
    <main
      id="main"
      className="container shell ticket-detail"
      data-testid="owner-ticket-ready"
    >
      <SiteNav />
      <h1>{OWNER_TICKET_COPY.title}</h1>
      <p className="intro">
        Vé thuộc tổ chức{' '}
        <span data-testid="owner-ticket-tenant">{tenantSlug}</span>.
      </p>

      {isDemo ? (
        <aside
          className="notice state-unknown"
          role="status"
          data-testid="owner-ticket-demo-label"
        >
          <strong>Không dùng vào cổng</strong>
          <p>Đây là vé demo / fixture — không quét tại cổng thật.</p>
        </aside>
      ) : null}

      {stateBlocked ? (
        <aside
          className="notice state-error"
          role="status"
          data-testid="owner-ticket-state-notice"
        >
          <p>
            Vé đang ở trạng thái {ticket.state}. Không dùng mã này để vào cổng.
          </p>
        </aside>
      ) : null}

      <figure className="ticket-qr-figure" data-testid="owner-ticket-qr-figure">
        <TicketQr value={qrPayload} label={qrLabel} />
        <figcaption className="ticket-qr-caption">{qrLabel}</figcaption>
      </figure>

      <dl data-testid="owner-ticket-detail">
        <div>
          <dt>Mã vé</dt>
          <dd>
            <code data-testid="owner-ticket-id" title={ticket.ticketId}>
              {shortTicketId(ticket.ticketId)}
            </code>
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
        {' · '}
        <Link href="/redeem">Đổi mã lấy vé</Link>
      </p>
    </main>
  );
}
