import {
  backfillManualEntryCodes,
  createDatabase,
  readCredentialKeyEnvironment,
  readGateManualCodePepper,
  withPlatformRole,
  withTenant,
  type CodeHmacConfig,
  type PrismaClient,
} from '@ticket/backend';

type BackfillState = { cursor_ticket_id: string | null; status: string };
type TenantRow = { id: string };

export type GateManualCodeBackfillReport = {
  tenants: number;
  processed: number;
  minted: number;
  skipped: number;
  completedTenantIds: string[];
  unfinishedTenantIds: string[];
};

async function backfillTenant(
  db: PrismaClient,
  input: { tenantId: string; manualCodePepper: CodeHmacConfig; credentialKeyMaterial: string },
  batchSize: number,
  report: GateManualCodeBackfillReport,
): Promise<void> {
  let cursor: string | null = null;
  while (true) {
    const batch = await withTenant(db, input.tenantId, async (tx) => {
      const stateRows = await tx.$queryRaw<BackfillState[]>`
        SELECT cursor_ticket_id, status
        FROM gate_manual_code_backfill_runs
        WHERE tenant_id = ${input.tenantId}::uuid
        FOR UPDATE
      `;
      const state = stateRows[0];
      if (state?.status === 'COMPLETED') {
        return { done: true as const, result: null };
      }
      cursor = state?.cursor_ticket_id ?? null;
      const result = await backfillManualEntryCodes(tx, {
        tenantId: input.tenantId,
        manualCodePepper: input.manualCodePepper,
        credentialKeyMaterial: input.credentialKeyMaterial,
        afterTicketId: cursor,
        batchSize,
      });
      const nextCursor = result.resweepRequired ? null : result.nextCursor;
      const nextStatus = result.complete
        ? 'COMPLETED'
        : result.resweepRequired && result.processed === 0
          ? 'UNFINISHED'
          : 'RUNNING';
      await tx.$executeRaw`
        INSERT INTO gate_manual_code_backfill_runs (tenant_id, cursor_ticket_id, status, updated_at)
        VALUES (
          ${input.tenantId}::uuid,
          ${nextCursor}::uuid,
          ${nextStatus},
          clock_timestamp()
        )
        ON CONFLICT (tenant_id) DO UPDATE
        SET cursor_ticket_id = EXCLUDED.cursor_ticket_id,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
      `;
      return { done: false as const, result };
    });

    if (batch.done) {
      report.completedTenantIds.push(input.tenantId);
      return;
    }
    const result = batch.result!;
    report.processed += result.processed;
    report.minted += result.minted;
    report.skipped += result.skipped;
    if (result.complete) {
      report.completedTenantIds.push(input.tenantId);
      return;
    }
    if (result.resweepRequired && result.processed === 0) {
      report.unfinishedTenantIds.push(input.tenantId);
      return;
    }
    cursor = result.resweepRequired ? null : result.nextCursor;
  }
}

export async function backfillAllGateManualCodes(
  db: PrismaClient,
  input: { manualCodePepper: CodeHmacConfig; credentialKeyMaterial: string; batchSize?: number },
): Promise<GateManualCodeBackfillReport> {
  const tenants = await withPlatformRole(db, (tx) =>
    tx.$queryRaw<TenantRow[]>`SELECT id FROM tenants ORDER BY id`,
  );
  const report: GateManualCodeBackfillReport = {
    tenants: tenants.length,
    processed: 0,
    minted: 0,
    skipped: 0,
    completedTenantIds: [],
    unfinishedTenantIds: [],
  };
  for (const tenant of tenants) {
    await backfillTenant(
      db,
      { tenantId: tenant.id, ...input },
      input.batchSize ?? 100,
      report,
    );
  }
  return report;
}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const db = createDatabase(databaseUrl);
  try {
    const report = await backfillAllGateManualCodes(db, {
      manualCodePepper: readGateManualCodePepper(process.env),
      credentialKeyMaterial: readCredentialKeyEnvironment(process.env),
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (report.unfinishedTenantIds.length) process.exitCode = 2;
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'backfill failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
