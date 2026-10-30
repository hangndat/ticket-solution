/** Giao diện fixture đã chốt trước wave; không chứa auth mock hoặc secrets. */
export const ACTOR_NAMES = [
  'attendee',
  'otherAttendee',
  'unverified',
  'owner',
  'manager',
  'cs',
  'scanner',
  'supervisor',
  'operator',
] as const;

export type ActorName = (typeof ACTOR_NAMES)[number];
export type Surface = 'web' | 'portal' | 'platform';

export interface TestAccount {
  username: string;
  password: string;
  userId?: string;
  totpSecret?: string;
}

export interface CaseFixture {
  /** Tất cả ID dưới đây là fixture riêng của case, không phụ thuộc ca chạy trước. */
  tenantId: string;
  tenantSlug: string;
  eventId: string;
  eventSlug: string;
  ticketTypeId?: string;
  sourceId?: string;
  code?: string;
  secondCode?: string;
  ticketId?: string;
  invitationId?: string;
  requestId?: string;
  csvPath?: string;
  accounts?: Partial<Record<ActorName, TestAccount>>;
  data?: Record<string, unknown>;
}

export interface E2EManifest {
  schemaVersion: 1;
  runId: string;
  origins: {
    web: string;
    portal: string;
    marketing: string;
    api: string;
    auth: string;
    mailpit: string;
    faultPortal?: string;
    shortWeb?: string;
  };
  accounts: Record<ActorName, TestAccount>;
  /** Synthetic actor from the optional second Keycloak realm. */
  secondaryActor?: TestAccount;
  cases: Record<string, CaseFixture>;
  /** Chỉ runtime harness sử dụng; không ghi nguyên manifest vào report. */
  runtime?: Record<string, unknown>;
}

export interface CoverageEntry {
  caseId: string;
  tests: string[];
  layers: string[];
  status: 'implemented' | 'covered' | 'blocked' | 'out';
  reason?: string;
}
