'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TicketSummary } from '@ticket/contracts';
import { OWNER_TICKET_COPY } from '../../../../../src/owner-ticket/copy';
import {
  loadOwnerTicket,
  type OwnerTicketLoadResult,
} from '../../../../../src/owner-ticket/load';
import { ownerTicketAuthHref } from '../../../../../src/owner-ticket/paths';
import { SurfaceState } from '../../../../../src/ui/surface-state';

type Props = {
  tenantSlug: string;
  ticketId: string;
  explicitTenantId?: string | null;
};

export function OwnerTicketPanel({
  tenantSlug,
  ticketId,
  explicitTenantId = null,
}: Props) {
  const [result, setResult] = useState<OwnerTicketLoadResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void loadOwnerTicket({ tenantSlug, ticketId, explicitTenantId }).then(
      (next) => {
        if (!cancelled) setResult(next);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, ticketId, explicitTenantId]);

  if (!result) {
    return (
      <SurfaceState
        kind="loading"
        title={OWNER_TICKET_COPY.loading.title}
        detail={OWNER_TICKET_COPY.loading.detail}
        testId="owner-ticket-loading"
      />
    );
  }

  if (result.status === 'unauthorized') {
    return (
      <SurfaceState
        kind="error"
        title={OWNER_TICKET_COPY.unauthorized.title}
        detail={OWNER_TICKET_COPY.unauthorized.detail}
        testId="owner-ticket-unauthorized"
        action={
          <Link
            className="button"
            href={ownerTicketAuthHref(tenantSlug, ticketId)}
          >
            Đăng nhập
          </Link>
        }
      />
    );
  }

  if (result.status === 'tenant-unresolved') {
    return (
      <SurfaceState
        kind="empty"
        title={OWNER_TICKET_COPY.tenantUnresolved.title}
        detail={OWNER_TICKET_COPY.tenantUnresolved.detail}
        testId="owner-ticket-tenant-unresolved"
        action={
          <Link className="button" href="/redeem">
            Đổi mã lấy vé
          </Link>
        }
      />
    );
  }

  if (result.status === 'unreachable') {
    return (
      <SurfaceState
        kind="error"
        title={OWNER_TICKET_COPY.unreachable.title}
        detail={OWNER_TICKET_COPY.unreachable.detail}
        testId="owner-ticket-unreachable"
      />
    );
  }

  if (result.status === 'invalid') {
    return (
      <SurfaceState
        kind="unknown"
        title={OWNER_TICKET_COPY.invalid.title}
        detail={OWNER_TICKET_COPY.invalid.detail}
        testId="owner-ticket-invalid"
      />
    );
  }

  if (result.status === 'not-found') {
    return (
      <SurfaceState
        kind="empty"
        title={OWNER_TICKET_COPY.notFound.title}
        detail={OWNER_TICKET_COPY.notFound.detail}
        testId="owner-ticket-not-found"
      />
    );
  }

  return <OwnerTicketCard ticket={result.ticket} tenantSlug={tenantSlug} />;
}

function OwnerTicketCard({
  ticket,
  tenantSlug,
}: {
  ticket: TicketSummary;
  tenantSlug: string;
}) {
  return (
    <section
      className="redeem-ticket"
      aria-labelledby="owner-ticket-title"
      data-testid="owner-ticket-card"
      data-tenant-slug={tenantSlug}
    >
      <h2 id="owner-ticket-title">Chi tiết vé</h2>
      <dl>
        <div>
          <dt>Mã vé</dt>
          <dd>
            <code>{ticket.ticketId}</code>
          </dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>{ticket.state}</dd>
        </div>
        <div>
          <dt>Sự kiện</dt>
          <dd>
            <code>{ticket.eventId}</code>
          </dd>
        </div>
        <div>
          <dt>Phiên bản chứng chỉ</dt>
          <dd>{ticket.credentialVersion}</dd>
        </div>
        <div>
          <dt>Cấp lúc</dt>
          <dd>
            <time dateTime={ticket.createdAt}>{ticket.createdAt}</time>
          </dd>
        </div>
      </dl>
      <p className="intro">
        Mã QR check-in nằm trong email / app — trang web không nhúng credential
        vào URL.
      </p>
    </section>
  );
}
