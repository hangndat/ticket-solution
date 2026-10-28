import { redirect } from 'next/navigation';

/** Legacy URL — same product as P2 Analytics (`report.read`). */
export default async function TenantReportsAliasPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/t/${encodeURIComponent(tenantId)}/analytics`);
}
