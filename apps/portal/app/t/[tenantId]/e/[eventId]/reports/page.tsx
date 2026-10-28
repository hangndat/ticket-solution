import { redirect } from 'next/navigation';

/** Legacy URL — same product as event Gate report (`report.read`). */
export default async function EventReportsAliasPage({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  redirect(
    `/t/${encodeURIComponent(tenantId)}/e/${encodeURIComponent(eventId)}/gate`,
  );
}
