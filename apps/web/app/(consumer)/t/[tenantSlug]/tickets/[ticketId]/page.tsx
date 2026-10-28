import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { isUuid } from '../../../../../../src/bff/ids';
import { isTenantSlug } from '../../../../../../src/branding';
import { hasDemoMediaForEventId } from '../../../../../../src/demo-media';
import { loginHref } from '../../../../../../src/oidc/login-href';
import {
  loadOwnerTicket,
  OWNER_TICKET_COPY,
} from '../../../../../../src/owner-ticket';
import {
  OwnerTicketForbidden,
  OwnerTicketHeading,
  OwnerTicketInvalid,
  OwnerTicketMissing,
  OwnerTicketNeedLogin,
  OwnerTicketReady,
  OwnerTicketTenantUnresolved,
  OwnerTicketUnreachable,
} from '../../../../../../src/owner-ticket/owner-ticket-chrome';
import { attendeeTicketMain } from '../../../../../../src/attendee-detail-surface';
import { ConsumerPageShell } from '../../../../../../src/consumer-page-shell';

type Props = {
  params: Promise<{ tenantSlug: string; ticketId: string }>;
  searchParams: Promise<{ tenantId?: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: OWNER_TICKET_COPY.title,
    description: OWNER_TICKET_COPY.metaDescription,
    robots: { index: false, follow: false },
  };
}

function ownerTicketPath(tenantSlug: string, ticketId: string): string {
  return `/t/${encodeURIComponent(tenantSlug)}/tickets/${encodeURIComponent(ticketId)}`;
}

function TicketStateShell({
  testId,
  children,
}: {
  testId: string;
  children: ReactNode;
}) {
  return (
    <ConsumerPageShell
      mainClassName={attendeeTicketMain}
      mainTestId={testId}
    >
      <OwnerTicketHeading />
      {children}
    </ConsumerPageShell>
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
        <OwnerTicketInvalid />
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
        <OwnerTicketNeedLogin loginHref={ticketLogin} />
      </TicketStateShell>
    );
  }

  if (result.status === 'unreachable') {
    return (
      <TicketStateShell testId="owner-ticket-unreachable">
        <OwnerTicketUnreachable path={path} />
      </TicketStateShell>
    );
  }

  if (result.status === 'tenant-unresolved') {
    return (
      <TicketStateShell testId="owner-ticket-tenant-unresolved">
        <OwnerTicketTenantUnresolved />
      </TicketStateShell>
    );
  }

  if (result.status === 'forbidden') {
    return (
      <TicketStateShell testId="owner-ticket-forbidden">
        <OwnerTicketForbidden />
      </TicketStateShell>
    );
  }

  if (result.status === 'not-found' || result.status === 'invalid') {
    return (
      <TicketStateShell testId="owner-ticket-missing">
        <OwnerTicketMissing />
      </TicketStateShell>
    );
  }

  const { ticket } = result;
  const isDemo =
    hasDemoMediaForEventId(ticket.eventId) ||
    tenantSlug.includes('demo') ||
    tenantSlug.includes('fixture');

  return (
    <ConsumerPageShell
      mainClassName={attendeeTicketMain}
      mainTestId="owner-ticket-ready"
    >
      <OwnerTicketReady
        ticket={ticket}
        tenantSlug={tenantSlug}
        isDemo={isDemo}
      />
    </ConsumerPageShell>
  );
}
