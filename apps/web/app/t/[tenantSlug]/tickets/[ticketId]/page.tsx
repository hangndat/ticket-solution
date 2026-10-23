import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Button } from '@ticket/ui';
import Link from 'next/link';
import { isUuid } from '../../../../../src/bff/ids';
import { isTenantSlug } from '../../../../../src/branding';
import { hasDemoMediaForEventId } from '../../../../../src/demo-media';
import { loginHref } from '../../../../../src/oidc/login-href';
import {
  loadOwnerTicket,
  OWNER_TICKET_COPY,
  ticketStateLabel,
  ticketStateTagClass,
} from '../../../../../src/owner-ticket';
import { buildDisplayQrPayload } from '../../../../../src/owner-ticket/display-payload';
import { TicketQr } from '../../../../../src/owner-ticket/ticket-qr';
import {
  attendeeTicketBackLink,
  attendeeTicketBread,
  attendeeTicketCardBody,
  attendeeTicketCardHead,
  attendeeTicketDetailCard,
  attendeeTicketIntro,
  attendeeTicketMain,
  attendeeTicketMetaList,
  attendeeTicketNoticeError,
  attendeeTicketNoticeUnknown,
  attendeeTicketQrCaption,
  attendeeTicketQrPanel,
  attendeeTicketTitle,
} from '../../../../../src/attendee-detail-surface';
import { attendeeAuthButtons } from '../../../../../src/attendee-surface';
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

function TicketStateShell({
  testId,
  children,
}: {
  testId: string;
  children: ReactNode;
}) {
  return (
    <main id="main" className={attendeeTicketMain} data-testid={testId}>
      <SiteNav />
      <h1 className={attendeeTicketTitle}>{OWNER_TICKET_COPY.title}</h1>
      {children}
    </main>
  );
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
      <TicketStateShell testId="owner-ticket-invalid">
        <SurfaceState
          kind="error"
          title={OWNER_TICKET_COPY.invalid.title}
          detail={OWNER_TICKET_COPY.invalid.detail}
          testId="owner-ticket-invalid-state"
          action={
            <Button asChild variant="brand">
              <Link href="/">Về trang chủ</Link>
            </Button>
          }
        />
      </TicketStateShell>
    );
  }

  const result = await loadOwnerTicket({
    tenantSlug,
    ticketId,
    explicitTenantId,
  });

  if (result.status === 'unauthenticated') {
    return (
      <TicketStateShell testId="owner-ticket-need-login">
        <SurfaceState
          kind="empty"
          title={OWNER_TICKET_COPY.needLogin.title}
          detail={OWNER_TICKET_COPY.needLogin.detail}
          testId="owner-ticket-need-login-state"
          action={
            <div className={attendeeAuthButtons}>
              <Button asChild variant="brand">
                <a href={ticketLogin}>Đăng nhập</a>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/redeem">Đổi mã lấy vé</Link>
              </Button>
            </div>
          }
        />
      </TicketStateShell>
    );
  }

  if (result.status === 'unreachable') {
    return (
      <TicketStateShell testId="owner-ticket-unreachable">
        <SurfaceState
          kind="error"
          title={OWNER_TICKET_COPY.unreachable.title}
          detail={OWNER_TICKET_COPY.unreachable.detail}
          testId="owner-ticket-unreachable-state"
          action={
            <Button asChild variant="brand">
              <Link href={path}>Thử lại</Link>
            </Button>
          }
        />
      </TicketStateShell>
    );
  }

  if (result.status === 'tenant-unresolved') {
    return (
      <TicketStateShell testId="owner-ticket-tenant-unresolved">
        <SurfaceState
          kind="empty"
          title={OWNER_TICKET_COPY.tenantUnresolved.title}
          detail={OWNER_TICKET_COPY.tenantUnresolved.detail}
          testId="owner-ticket-tenant-unresolved-state"
          action={
            <Button asChild variant="brand">
              <Link href="/redeem">Đổi mã lấy vé</Link>
            </Button>
          }
        />
      </TicketStateShell>
    );
  }

  if (
    result.status === 'not-found' ||
    result.status === 'forbidden' ||
    result.status === 'invalid'
  ) {
    return (
      <TicketStateShell testId="owner-ticket-missing">
        <SurfaceState
          kind="empty"
          title={OWNER_TICKET_COPY.missing.title}
          detail={OWNER_TICKET_COPY.missing.detail}
          testId="owner-ticket-missing-state"
          action={
            <Button asChild variant="brand">
              <Link href="/">Về trang chủ</Link>
            </Button>
          }
        />
      </TicketStateShell>
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
      className={attendeeTicketMain}
      data-testid="owner-ticket-ready"
    >
      <SiteNav />
      <p className={attendeeTicketBread}>
        <Link className={attendeeTicketBackLink} href="/wallet">
          ‹ Vé của tôi
        </Link>
      </p>
      <h1 className={attendeeTicketTitle}>{OWNER_TICKET_COPY.title}</h1>
      <p className={attendeeTicketIntro}>
        Vé thuộc tổ chức{' '}
        <span data-testid="owner-ticket-tenant">{tenantSlug}</span>.
      </p>

      <article className={attendeeTicketDetailCard} data-testid="owner-ticket-card">
        <div className={attendeeTicketCardHead}>
          <span
            className={ticketStateTagClass(ticket.state)}
            data-testid="owner-ticket-state-tag"
          >
            {ticketStateLabel(ticket.state)}
          </span>
        </div>
        <div className={attendeeTicketCardBody}>
          {isDemo ? (
            <aside
              className={attendeeTicketNoticeUnknown}
              role="status"
              data-testid="owner-ticket-demo-label"
            >
              <strong>Không dùng vào cổng</strong>
              <p>Đây là vé demo / fixture — không quét tại cổng thật.</p>
            </aside>
          ) : null}

          {stateBlocked ? (
            <aside
              className={attendeeTicketNoticeError}
              role="status"
              data-testid="owner-ticket-state-notice"
            >
              <p>
                Vé đang ở trạng thái {ticket.state}. Không dùng mã này để vào cổng.
              </p>
            </aside>
          ) : null}

          <figure className={attendeeTicketQrPanel} data-testid="owner-ticket-qr-figure">
            <TicketQr value={qrPayload} label={qrLabel} />
            <figcaption className={attendeeTicketQrCaption}>{qrLabel}</figcaption>
          </figure>

          <dl className={attendeeTicketMetaList} data-testid="owner-ticket-detail">
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
        </div>
      </article>
      <p>
        <Link className={attendeeTicketBackLink} href="/wallet">
          ← Vé của tôi
        </Link>
        {' · '}
        <Link href="/redeem">Đổi mã lấy vé</Link>
      </p>
    </main>
  );
}
