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
    b('db04-db05-acceptance', 'DB-04:'),
  ],
  'DB-05': [
    b('issue', 'issue: last-seat'),
    b('approval', 'F01: mixed auto/manual'),
    b('db04-db05-acceptance', 'DB-05:'),
  ],
  'DB-06': [
    b('event-lifecycle', 'C-E event lifecycle'),
    b('db06-race', 'DB-06:'),
  ],
  'DB-07': [
    b('approval', 'manual redeem does not allocate'),
    b('approval', 'manual approval is audited'),
    b('form-consent', 'F-BE: form/consent'),
    b('db07-manual-race', 'DB-07:'),
  ],
  'DB-08': [
    b('issue', 'issue: last-seat'),
    b('issue', 'issue: terminal QUOTA_EXHAUSTED'),
    b('db08-fault-rollback', 'DB-08:'),
  ],
  'DB-09': [
    b('gate', 'gate: one confirm wins'),
    b('ticket-reissue-grants', 'reissue grant migration', 'D'),
    b('db09-ticket-security-invariants', 'DB-09: revoke never reuses a redemption code'),
    { file: 'tests/e2e/http/live.test.mjs', name: '[DB-09] live HTTP', layer: 'H' },
    { file: 'tests/e2e/backend/reissue-worker-mailpit.test.cjs',
      name: 'R reissue worker Mailpit', layer: 'R' },
    b('event-lifecycle', 'C-E event lifecycle'),
  ],
  'DB-10': [
    b('import-invitations', 'H-I1/H-I2/H-I3 import jobs'),
    { file: 'tests/e2e/http/live.test.mjs', name: '[DB-10] live HTTP', layer: 'H' },
  ],
  'DB-11': [
    b('import-invitations', 'H-I1/H-I2/H-I3 import jobs'),
    b(
      'db11-invite-ttl-claim',
      'DB-11: staff invite TTL/one-use/email + attendee claim host separation/expired/replay/wrong-owner',
    ),
    { file: 'tests/e2e/http/live.test.mjs', name: '[DB-11] live HTTP', layer: 'H' },
  ],
  'DB-12': [
    b('config-publish', 'config publish is versioned'),
    b('published-events', 'public published events'),
    { file: 'tests/e2e/http/live.test.mjs', name: '[DB-12] live HTTP', layer: 'H' },
  ],
  'DB-13': [b('event-lifecycle', 'C-E event lifecycle')],
  'DB-14': [
    b('form-consent', 'F-BE: form/consent'),
    b('config-publish', 'config publish is versioned'),
    b(
      'db14-form-entitlement',
      'DB-14: form/terms version, allowlist rejection, immutable entitlement snapshot',
    ),
    { file: 'tests/e2e/http/live.test.mjs', name: '[DB-14] live HTTP', layer: 'H' },
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
    {
      file: 'tests/e2e/backend/job-01-durable-outbox.test.cjs',
      name: '[JOB-01] R durable outbox',
      layer: 'R',
    },
  ],
  'JOB-02': [
    b('outbox-fence', 'outbox fence: MembershipInvite'),
    {
      file: 'tests/e2e/backend/job-02-lease-fence.test.cjs',
      name: '[JOB-02] R lease fence',
      layer: 'R',
    },
  ],
  'JOB-03': [
    b('issue', 'issue: last-seat'),
    b('worker-provider-deadline', 'stalled SMTP transport', 'U'),
    {
      file: 'tests/e2e/backend/job-03-smtp-failures.test.cjs',
      name: '[JOB-03] R SMTP failure and timeout: bounded retry, truthful PG state, ticket stays committed',
      layer: 'R',
    },
    {
      file: 'tests/e2e/backend/job-03-smtp-failures.test.cjs',
      name: '[JOB-03] R crash after SMTP accept before PG ack: ticket not rolled back, recovery may duplicate SMTP',
      layer: 'R',
    },
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
    'D membership/revoke/identity đủ; H claim cũ và token realm thứ hai bị từ chối 401, không tạo identity/session/business mutation.',
  'DB-03':
    'D quota/idempotency đủ; H cùng request retry, multi-actor race và audit/outbox matrix đã mở (live.test.mjs#[DB-03]).',
  'DB-04': 'D IdP dot/plus, guest/unverified zero mutation và multi-code owner limit; H Keycloak guest/unverified deny, dot/plus, multi-code race đối soát business state. Chờ reviewer độc lập trên SHA cuối.',
  'DB-05':
    'D event/type/source last-seat, các scope còn lại nullable, allocated invariant và fault sau cả ba quota mutation rollback toàn bộ. Chờ reviewer độc lập trên SHA cuối.',
  'DB-06':
    'D barrier PostgreSQL chứng minh issue vs close/config theo hai thứ tự, issue trước suspend, state ticket/code/quota/operation/outbox và lock timeout + same-key retry. SQL quota reduction chỉ là diagnostic cho CHECK/serialization, không thay AC runtime. BLOCKED: chưa có runtime quota-reduction command; contract bounded transient retry chưa chốt (hiện có lock_timeout 2s và client retry cùng key, không auto-retry).',
  'DB-07': 'D PostgreSQL barrier + H Keycloak/HTTP qua pnpm test:e2e:http --case=DB-07: TTL nguồn, approve/deny/expiry nhiều actor, replay và quota recheck. Chờ evidence SHA sạch và reviewer độc lập.',
  'DB-08':
    'Thiếu fault injection trước commit và lost-response sau commit theo command scope.',
  'DB-09': 'D revoke, owner invariant, allocation policy và reissue credential/version/grant; R worker/Mailpit PNG v2 + revoke-before-relay DEAD. H partial: generic PATCH owner transfer refused trên CS/me/gate ticket paths + DB snapshot; GATE-03 vẫn thiếu QR credential validation tại Gate.',
  'DB-10': 'D PostgreSQL PASS; H Keycloak/API/MinIO PASS run mvulfv4t-605b10 trên SHA sạch 5f2234bb: hai request cùng importId/key/body chờ event lock khi commit đầu còn in-flight, một original + một replay, một operation và một mã mới; mã CONSUMED giữ nguyên. Actor inventory.import đọc/preview/commit job do actor khác tạo; actor thiếu quyền/revoked và sai tenant/event bị từ chối không mutation. Chờ DoD độc lập trên SHA cuối.',
  'DB-11':
    'D PostgreSQL PASS trên SHA sạch: staff invite TTL 48h đúng cấu hình, hết hạn thật không tạo membership, email không khớp bị chặn, một lần dùng (actor khác token cũ bị INVITE_ALREADY_USED). Attendee claim: token staff/attendee tách biệt hoàn toàn (cross-use bị chặn, không mutate quota/membership), expired/revoked không mint code/ticket, wrong-owner (actor khác cùng email) replay invitation đã CLAIMED không tạo vé thứ hai — đúng một ticket/owner cho invitation. Thiếu H Keycloak/HTTP: cần seed fixture + live.test.mjs case mới, đề xuất Dispatch riêng để không rủi ro harness dùng chung cho các ID khác.',
  'DB-12':
    'D publish/projection/rollback optimistic concurrency PASS; H publish/rollback/draft-non-leak qua Keycloak/HTTP thật PASS run mvuphcyf-88857a. BLOCKED thật (không phải thiếu test): public cache key host+tenant+event+published version+locale và Cache-Control no-store trên preview không có ở runtime (apps/api/src/published-events.ts, apps/api/src/config.ts ~L374) — đã báo coordinator, chờ review sản phẩm riêng trước khi mở Task runtime.',
  'DB-13':
    'D lifecycle; thiếu UTC/IANA/deadline sau lock và archived ticket policy.',
  'DB-14':
    'D PostgreSQL PASS: form/terms version + consent hashes on request, structural allowlist rejects script/unknown keys/non-allowlisted field types, entitlement_snapshot on ticket immutable after publish/rebrand and ticket_type mutation; stale terms rejected. H Keycloak/HTTP PASS qua redeem + config-versions/publish + public projection và control DB snapshot. Chờ DoD độc lập trên SHA cuối.',
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
    'D ticket/outbox atomic; R worker stop + Redis restart + Mailpit once (ADR-17 PG SoT, không assert exactly-once SMTP/inbox).',
  'JOB-02':
    'D fence + R process kill sau claim, lease PG hết hạn/reclaim, stale ack fenced; một logical email (ADR-17 at-least-once SMTP).',
  'JOB-03':
    'D issue relay fail/retry; U SMTP deadline; R worker + reject/stall/Mailpit bounded retry và exit-after-smtp recovery (ADR-17, không assert exactly-once SMTP).',
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
