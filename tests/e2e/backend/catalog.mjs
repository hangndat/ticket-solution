// Each selector names a real assertion-bearing test. U is unit/app.inject without
// live Keycloak; D uses a fresh PostgreSQL container; R requires a worker process.
const b = (file, name, layer = 'D') => ({
  file: `packages/backend/test/${file}.test.cjs`,
  name,
  layer,
});
const a = (file, name, layer = 'U') => ({
  file: `apps/api/test/${file}.test.cjs`,
  name,
  layer,
});
const w = (file, name, layer = 'U') => ({
  file: `apps/worker/test/${file}.test.cjs`,
  name,
  layer,
});

export const catalog = {
  'DB-01': [
    b('rls', 'PostgreSQL RLS through Prisma'),
    b('rls-catalog', 'every tenant table'),
    b('me-tickets-aggregate', 'W1: owner aggregate'),
    b('db01-rls-worker-export-scope', 'DB-01: ticket_platform_runtime'),
  ],
  'DB-02': [
    b('membership', 'membership deny-by-default'),
    b('platform', 'O02 MeEvents'),
    b('membership-unit', 'isMembershipActive', 'U'),
    b('db02-identity-issuer-subject', 'DB-02: identity keyed'),
  ],
  'DB-03': [
    b('issue', 'issue: last-seat'),
    b('approval', 'F01: mixed auto/manual'),
  ],
  'DB-04': [
    b('issue', 'issue: last-seat'),
    b('approval', 'manual redeem does not allocate'),
  ],
  'DB-05': [
    b('issue', 'issue: last-seat'),
    b('approval', 'F01: mixed auto/manual'),
  ],
  'DB-06': [b('event-lifecycle', 'C-E event lifecycle')],
  'DB-07': [
    b('approval', 'manual redeem does not allocate'),
    b('approval', 'manual approval is audited'),
    b('form-consent', 'F-BE: form/consent'),
  ],
  'DB-08': [
    b('issue', 'issue: last-seat'),
    b('issue', 'issue: terminal QUOTA_EXHAUSTED'),
  ],
  'DB-09': [
    b('gate', 'gate: one confirm wins'),
    b('ticket-reissue-grants', 'reissue grant migration', 'D'),
    b('db09-ticket-security-invariants', 'DB-09: revoke never reuses a redemption code'),
    { file: 'tests/e2e/backend/reissue-worker-mailpit.test.cjs',
      name: 'R reissue worker Mailpit', layer: 'R' },
    b('event-lifecycle', 'C-E event lifecycle'),
  ],
  'DB-10': [b('import-invitations', 'H-I1/H-I2/H-I3 import jobs')],
  'DB-11': [b('import-invitations', 'H-I1/H-I2/H-I3 import jobs')],
  'DB-12': [
    b('config-publish', 'config publish is versioned'),
    b('published-events', 'public published events'),
  ],
  'DB-13': [b('event-lifecycle', 'C-E event lifecycle')],
  'DB-14': [
    b('form-consent', 'F-BE: form/consent'),
    b('config-publish', 'config publish is versioned'),
  ],
  'DB-15': [
    b('reporting', 'event report counts'),
    b('gate', 'gate: one confirm wins'),
  ],
  'DB-16': [b('reporting', 'portfolio report filters')],
  'DB-17': [
    b('role-presets', 'P2-ROLES-PRESET'),
    b('tenant-registration', 'P2 self-serve PENDING registration'),
  ],
  'DB-18': [
    b('account-idp-erasure', 'SEC-2 T4/T14'),
    b('account-idp-erasure', 'SEC-2 T9/T11/T12/T13'),
    b('account-session-revoke', 'session'),
  ],
  'DB-19': [
    b('account-idp-erasure', 'SEC-2 B1:'),
    b('issue-unit', 'CODE_HMAC_PEPPER', 'U'),
  ],
  'GATE-01': [b('gates', 'O31 gates:')],
  'GATE-02': [b('gate', 'gate: one confirm wins')],
  'GATE-03': [b('gate', 'gate: one confirm wins')],
  'GATE-04': [b('gate', 'gate: one confirm wins')],
  'GATE-05': [b('gate', 'gate: one confirm wins')],
  'GATE-06': [
    b('offline-sync-apply', 'offline sync: apply'),
    b('offline-sync-unit', 'validateOfflineSyncRequest', 'U'),
  ],
  'GATE-07': [b('offline-sync-apply', 'offline sync: apply')],
  'GATE-08': [b('offline-sync-receipt', 'offline receipt lookup: matrix')],
  'GATE-09': [
    b('offline-sync-receipt', 'offline receipt lookup: matrix'),
    b('offline-sync-receipt', 'offline receipt PG evidence'),
    a(
      'gate-offline-sync-receipt',
      'GET offline-sync receipt rejects invalid UUIDs',
    ),
  ],
  'JOB-01': [
    b('issue', 'issue: last-seat'),
    b('outbox-fence', 'TicketIssued: email outside tx'),
  ],
  'JOB-02': [b('outbox-fence', 'outbox fence: MembershipInvite')],
  'JOB-03': [
    b('issue', 'issue: last-seat'),
    b('worker-provider-deadline', 'stalled SMTP transport', 'U'),
  ],
  'JOB-04': [
    b('csv-guard', 'providerStatus maps', 'U'),
    b('reporting', 'event report counts'),
    b('outbox-fence', 'TicketIssued: email outside tx'),
  ],
  'JOB-05': [b('notification-unit', 'template allowlist', 'U')],
  'JOB-06': [
    b('worker-db-cancel', 'PG lock cancels reconcile'),
    w('worker-budget-fault', 'slow SMTP/APNs'),
    w('worker-relay-tick-timeout', 'hung tick step'),
  ],
  'JOB-07': [
    b('cs-export', 'CS lookup/export/events'),
    b('minio-real', 'MinIO'),
  ],
  'JOB-08': [],
  'SEC-01': [
    b('rls', 'PostgreSQL RLS through Prisma'),
    b('cs-export', 'CS lookup/export/events'),
    b('role-presets', 'P2-ROLES-PRESET'),
  ],
  'SEC-02': [
    'H:tests/e2e/http/live.test.mjs#[SEC-02]',
    'B:tests/e2e/harness/security.spec.ts#[SEC-02]',
  ],
  'SEC-03': [],
  'SEC-04': [
    a('redemptions-resolve-rls', 'resolve rate limit', 'D'),
    a('import-list', 'G-09 API limits'),
    a('tenant-limits', 'G-10 API limiter'),
  ],
  'SEC-05': [
    b('csv-guard', 'csv guard prefixes', 'U'),
    b('config-publish', 'asset quarantine finalize'),
    b('notification-unit', 'template allowlist', 'U'),
  ],
  'SEC-06': [
    b('cs-export', 'CS lookup/export/events'),
    b('portal-audit-codes', 'H-A1/H-C1/H-P-AUDIT'),
    w('worker-budget-fault', 'queue alert emits only aggregate'),
  ],
  'POL-01': [
    b('account-idp-erasure', 'SEC-2 T4/T14'),
    b('account-idp-erasure', 'SEC-2 T6/T7/T8'),
    b('account-idp-erasure', 'SEC-2 T9/T11/T12/T13'),
    {
      file: 'tests/e2e/backend/retention-db.test.cjs',
      name: '[POL-01]',
      layer: 'D',
    },
  ],
  'POL-02': [
    b('portal-audit-codes', 'H-A1/H-C1/H-P-AUDIT'),
    b('o06-retention-db', 'O06 POL-02/03'),
    b('o06-retention-db', 'O06 PII writer'),
  ],
  'POL-03': [
    b('minio-real', 'MinIO'),
    b('o06-retention-db', 'O06 POL-02/03'),
    b('o06-retention-db', 'O06 export claim'),
    b('o06-retention-db', 'O06 delete failure'),
  ],
  'POL-04': [b('account-idp-erasure', 'SEC-2 T4/T14')],
};

export const notes = {
  'DB-01':
    'D RLS/pool/owner/rollback-exception đủ; H worker/export cross-tenant đã mở (live.test.mjs#[DB-01]).',
  'DB-02':
    'D membership/revoke/identity đủ; H claim cũ đã mở, issuer+subject qua Keycloak thật vẫn blocked (cần realm thứ hai).',
  'DB-03':
    'D quota/idempotency đủ; H cùng request retry, multi-actor race và audit/outbox matrix đã mở (live.test.mjs#[DB-03]).',
  'DB-04': 'D unverified; thiếu canonicalization IdP và tranh per-email limit.',
  'DB-05':
    'D last-seat; thiếu quota nullable và fault rollback ở cả type/source.',
  'DB-06':
    'D event lifecycle; thiếu race config/quota/suspend và bounded transient retry.',
  'DB-07': 'D pending/approve; thiếu H expiry/reject race và TTL cấu hình.',
  'DB-08':
    'Thiếu fault injection trước commit và lost-response sau commit theo command scope.',
  'DB-09': 'D revoke, owner invariant, allocation policy và reissue credential/version/grant; R worker/Mailpit PNG v2 + revoke-before-relay DEAD. Thiếu generic PATCH refusal H; GATE-03 vẫn thiếu QR credential validation tại Gate.',
  'DB-10': 'D import; thiếu H preview/commit race và file ownership.',
  'DB-11': 'D import/invite; thiếu H 48h/claim host và wrong-owner matrix.',
  'DB-12':
    'D publish/projection; thiếu H cache version/locale/no-store và rollback.',
  'DB-13':
    'D lifecycle; thiếu UTC/IANA/deadline sau lock và archived ticket policy.',
  'DB-14':
    'D form snapshot; thiếu H allowlist rich content và entitlement matrix.',
  'DB-15':
    'D report; thiếu full undo/cancel/final notification reconciliation.',
  'DB-16':
    'D assignment filter; thiếu H cursor/watermark và owner/manager boundaries.',
  'DB-17':
    'D presets/onboarding; thiếu H usage/mutation limit và arbitrary permissions matrix.',
  'DB-18':
    'D deletion/tombstone; thiếu H session/IdP end-to-end và audit retention.',
  'DB-19': 'Keyring tombstone tests không chứng minh code/QR rotation.',
  'GATE-01': 'D gate FK/list/open; thiếu H permission và response contract.',
  'GATE-02': 'D reserve conflict; thiếu H retry/cancel/expiry matrix.',
  'GATE-03':
    'Thiếu H QR audience/kid/version/hash/manual rejection và reject-audit.',
  'GATE-04':
    'D concurrent confirm; thiếu wrong holder/token, revoke/session race và H retry.',
  'GATE-05':
    'D undo; thiếu H permission/idempotency và concurrent scan/revoke.',
  'GATE-06':
    'D replay và U validation; thiếu H batch boundary, skew ±300s và mixed items.',
  'GATE-07':
    'D duplicate/conflict; thiếu H authz-on-retry và mixed batch audit.',
  'GATE-08': 'D read-only receipt; thiếu H live authz và closed gate.',
  'GATE-09':
    'D receipt matrix và H validation; thiếu H real authz/ownership/rate matrix.',
  'JOB-01':
    'D ticket/outbox atomic; thiếu R worker stop/restart + Mailpit và Redis restart.',
  'JOB-02': 'D fence; thiếu R kill worker/lease reclaim.',
  'JOB-03':
    'D retry và U deadline; thiếu R SMTP timeout/accept-before-ack crash.',
  'JOB-04':
    'D/U provider mapping; thiếu resend caps/cooldown/final failure full matrix.',
  'JOB-05': 'U template; thiếu D/H preview/publish/reminder schedule.',
  'JOB-06': 'D/U bounded timeout; thiếu R process kill/overlap and tenant cap.',
  'JOB-07': 'D object access; thiếu H signed URL authz/expiry across tenants.',
  'JOB-08':
    'OUT: không có HTTP callback/transport nhận provider event trong API hiện hành.',
  'SEC-01':
    'D isolation; thiếu H URL/body/query/job/file read+mutate+list/export/operation matrix.',
  'SEC-02':
    'H real attendee/staff session, host-cookie, Origin/CSRF deny + positive controls; Platform anonymous boundary PASS. Platform authenticated branch BLOCKED do Keycloak OTP synthetic, chưa phủ mọi BFF mutate/session revoke.',
  'SEC-03':
    'Thiếu HTTP integration với host/forwarded headers và redirect; chưa có test được chọn.',
  'SEC-04':
    'U/H validation/rate subset; thiếu live bucket scopes và full 429 branch matrix.',
  'SEC-05': 'D/U CSV/asset/template; thiếu H upload caps, rich text/XSS/CSP.',
  'SEC-06':
    'D/U masking/log subset + H live (tests/e2e/http/live.test.mjs#[SEC-06], mvsik1si-bee5e5 trên 97c15301): audit/codes projection, cursor opaque, limit cap100, deny body; report/me-tickets/gate-session/audit/codes assert Cache-Control private, no-store trên success và deny/error. Thiếu H cho CS lookup/export, process logs, platform audit và các endpoint nhạy cảm khác.',
  'POL-01':
    'D scrub/retry/tombstone đạt; metric slaOverdue fail 0 vs admin count 1 do runtime RLS; chưa đủ kết luận toàn bộ SLA.',
  'POL-02':
    'D clock ends_at NULL, CANCELLED dùng cancelled_at, PII writer/sweep row lock hai thứ tự, tenant isolation và replay. Cần ops đo event lớn và restore re-sweep. Audit TTL 730 ngày là gap policy riêng, chưa có deletion job.',
  'POL-03':
    'D clock ends_at + 90 ngày kể cả CANCELLED, event fence, lease/reclaim, delete 404 và token cũ không finalize. F01 còn mở: stale PUT sau purge có thể tái tạo bytes; thiếu MinIO barrier/object-store write fence, signed URL expiry và ops restore.',
  'POL-04': 'Privacy copy và restore/RPO/RTO cần bằng chứng browser/ops riêng.',
};
