import type { Metadata } from 'next';
import { isUuid } from '../../../../../../src/bff/ids';
import { isTenantSlug } from '../../../../../../src/branding';
import { loginHref } from '../../../../../../src/oidc/login-href';
import { OwnerTicketClient } from '../../../../../../src/owner-ticket/owner-ticket-client';
import { OWNER_TICKET_COPY } from '../../../../../../src/owner-ticket/types';

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

export default async function OwnerTicketPage({ params, searchParams }: Props) {
  const { tenantSlug: rawSlug, ticketId: rawId } = await params;
  const tenantSlug = rawSlug?.trim().toLowerCase() ?? '';
  const ticketId = rawId?.trim() ?? '';
  const path = `/t/${encodeURIComponent(tenantSlug || 'x')}/tickets/${encodeURIComponent(ticketId || 'x')}`;
  const explicitTenantId = (await searchParams).tenantId?.trim() || null;
  return (
    <OwnerTicketClient
      tenantSlug={tenantSlug}
      ticketId={ticketId}
      explicitTenantId={explicitTenantId}
      path={path}
      loginHref={loginHref(path)}
      valid={Boolean(tenantSlug && isTenantSlug(tenantSlug) && isUuid(ticketId))}
    />
  );
}
