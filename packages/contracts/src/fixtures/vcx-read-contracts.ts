/** Compile-time consumer checks for the additive #924 read contracts. */
import type {
  ImportJobSummary, ImportJobListPage, ImportJobListQuery,
  InvitationListQuery, InvitationListPage, TenantLimitsUsageReadDto,
} from '../index';

const imports: ImportJobListQuery = { kind: 'GUESTS', status: 'COMPLETED', limit: 20 };
const importPage: ImportJobListPage = { items: [], nextCursor: null };
const legacy: InvitationListQuery = { cursor: 'opaque-legacy-uuid', state: 'PENDING' };
const lookup: InvitationListQuery = { q: 'exact-invitation-uuid', state: 'CLAIMED' };
const invitations: InvitationListPage = { items: [], nextCursor: null };
const limits: TenantLimitsUsageReadDto = {
  tenantId: 'fixture-tenant',
  limits: { maxEvents: null, maxStaff: 10, emailPerDay: 100, importRowsPerJob: 50 },
  usage: { events: 1, staffActive: 2, staffPendingInvites: 0, emailToday: 3 },
  asOf: '2026-10-26T00:00:00.000Z', emailUsageDate: '2026-10-26',
};

// @ts-expect-error Exact ID lookup cannot be combined with pagination.
const invalidLookup: InvitationListQuery = { q: 'id', cursor: 'cursor' };
// @ts-expect-error Import status is the closed ImportJobStatus vocabulary.
const invalidStatus: ImportJobListQuery = { status: 'ISSUED' };
// @ts-expect-error Summary must not expose the file hash from detail.
type HiddenHash = ImportJobSummary['fileHash'];
// @ts-expect-error Summary must not expose operation replay metadata.
type HiddenReplay = ImportJobSummary['replayed'];
// @ts-expect-error Tenant snapshot must not expose Platform suspension state.
type HiddenStatus = TenantLimitsUsageReadDto['status'];

void [imports, importPage, legacy, lookup, invitations, limits, invalidLookup, invalidStatus];
