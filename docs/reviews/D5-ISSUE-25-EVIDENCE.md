# Evidence — Issue #25 Observability / restore / load

Ngày đo: 2026-10-17 · Branch: `hangndat/d5-issue25-obs-load` · Base: `8b200c2`  
Ownership: root tooling / CI / infra / scripts / docs. **Không** sửa `apps/*` / lockfile / `packages/backend` contracts.

## Gap matrix M01–M12 + release gates

Nguồn: `/tmp/vemoki-platform-plan.md` + source verify trên branch này. **Không** map Issue closed / skeleton → PASS module.

| Module | Nội bộ (subcriteria) | Evidence trên PR #53 | Gap còn lại | Ghi chú |
| --- | --- | --- | --- | --- |
| M01 Tenant + RLS | **PARTIAL** | RLS/`test:db` D1–D4 còn; **thiếu** tenant status/limits/provision operator flow (plan §4–5) | Platform BE + contracts | Không claim module Done |
| M02 Identity OIDC | **PARTIAL** | Keycloak realm dual callback local; **thiếu** invite/accept/MFA assurance platform + membership activation (plan §3/6) | Platform root+BE wave | Prod realm sync external |
| M03 Event lifecycle | **PARTIAL** | Admin publish path skeleton/D4 | Full platform event ops | Không checkbox Done |
| M04 Branding | **PARTIAL** | `brand/vemoki/**` port #42; web/iOS assets ngoài scope | Web/iOS workers | Internal assets ready |
| M05 Loại vé / quota | **PARTIAL** | Quota scopes trong load invariants | Scale/prod external | Harness ≠ module Done |
| M06 Import mã | **PARTIAL** | Admin import D4 path | Cap/flag limits platform | Skeleton ≠ Done |
| M07 Redemption | **PARTIAL** | S3 HTTP redeem local + OIDC | Opening-shock/prod SLO | Đo local ≠ Done |
| M08 Ticket / ví / credential | **PARTIAL** | AES-GCM seal/open toàn volume + restore decrypt | Key custody prod | Crypto drill OK; module chưa Done |
| M09 Email / push | **PARTIAL** | Outbox đếm + ngưỡng vs issue; SMTP Mailpit | APNs/TestFlight #26; handler types | External + internal |
| M10 Gate check-in | **PARTIAL** | 50 scanner/event ×2 + confirm S3 local | Device UAT external | Không claim prod |
| M11 CS / báo cáo | **PARTIAL** | Report API harness; CS/export trên BE khác PR | BE CS follow-up | |
| M12 Platform ops | **PARTIAL** | Backup/restore/obs/admission scripts; `/metrics` scrape E2E isolate `1f5fc31` | Bootstrap/Keycloak MFA platform PR; VPS | O06 retention/region/SLA **UNRESOLVED** |
| O06 Retention/region/SLA | **CHƯA KIỂM / mở** | Không chốt trong PR này | Policy product | Fail-closed khi thiếu config prod |
| Release checklist ops | **PARTIAL** | Drill scripts + evidence JSON `productionClaim: false` | Continuous RPO≤15m PITR external | |


## Gap matrix ops (Issue #25)

| Hạng mục | Trạng thái | Evidence / lệnh | Chưa đạt |
| --- | --- | --- | --- |
| Fixture backup drill | PASS | `./scripts/d5-backup-drill.sh` | Không phải backup prod / SLO |
| Business + key restore | PASS local (sau fix) | `./scripts/d5-business-restore-drill.sh` — AES-GCM + authenticated `GET /v1/me/tickets` + post-backup mutation absent | Continuous RPO≤15m / RTO prod **external** |
| Observability overlay | PASS smoke + E2E | config grep + `d5-metrics-scrape-e2e.sh` HTTP `/metrics` 401/200 Bearer (isolate BE ref nếu thiếu `metrics.ts`) | Series đầy đủ §16 vẫn BE |
| Load S3 sustained | PASS local (xem summary) | `./scripts/d5-load-baseline.sh` | Không claim SLO prod |
| Admission ADR-15 S4 isolated | PASS | `./scripts/d5-admission-s4.sh` — 429+Retry-After; Gate bypass | Opening-shock 50k không claim |
| O06 | OPTIONS | `docs/ops/O06-OPTIONS.md` | Chưa chốt số |
| Runbook / release docs | DONE docs | `docs/ops/*` | Store → #26 |
| Docs reconcile #51/#33/#42 | REPORT | `D5-DOCS-RECONCILE.md`, `D5-DOCS-RECONCILE-PR42.md` | Không merge/close #33/#42 |

## Restore (business)

```
D5_BUSINESS_RESTORE_PASS … crypto=1 api_reconnect=1 api_business_read=1 (sau fix; SHA cập nhật khi push)
rpo_post_mutation_absent=1 dump_s≈0 restore_s≈1 rto_wall_s≈1
```

- Crypto: AES-256-GCM (iv‖tag‖ciphertext base64url) khớp backend `sealCredentialToken`; decrypt sau restore.
- API reconnect: Nest health trên DB restore (port task-specific).
- RPO method: mutation **sau** `pg_dump` **vắng** sau restore (dump-point). **Không** claim continuous RPO≤15 phút.

## Load / admission

Harness: Postgres `ticket.task=d5-load` + Nest API + Keycloak + k6 S3 concurrent.

| Metric | Mục tiêu | Kết quả (run `44419fd8`, 14 CPU / 36 GB) |
| --- | --- | --- |
| Events × tickets | 2 × 20k | volume SQL seed (không đếm HTTP RPS) |
| Scanners | 50/event = 100 | **100** (50+50) |
| Issue sustained | 50/s × ≥60s | **50.02 rps** · 3001 ok · 60.7s |
| Confirm sustained | 20/s × ≥60s concurrent | **20.02 rps** · 1201 ok · cùng cửa sổ |
| p95 | ≤1s | issue **33 ms** · confirm **19 ms** |
| Error rate | ≪0.5 (ngưỡng 0.05) | **0%** |
| Invariants | quota scopes, checkin↔USED, decrypt sample, outbox/audit | **ok** |
| Admission | S4 isolated | `d5-admission-s4` PASS (Gate bypass + 429 Retry-After) |
| `meetsPrdPilotWithoutCaveat` | honest gate | **true** (local Mac; không claim prod SLO) |

Chi tiết: [D5-ISSUE-25-LOAD-SUMMARY.json](./D5-ISSUE-25-LOAD-SUMMARY.json).

**Sửa inconsistency cũ:** bỏ số “19905”; dùng `reportSample.ticketsByState` từ summary (`ACTIVE`+`USED`).

## Observability scrape contract (phối hợp BE)

- Path: **`/metrics`** (không `/v1` prefix)
- Auth: `Authorization: Bearer` từ `infra/observability/secrets/metrics_bearer.example` (prod: file gitignored)
- Không scrape JSON `/v1/health` như Prometheus text

## CI

Job `d5-hardening-smoke`: obs smoke + backup + business restore + **admission S4**. Full 2×20k load **không** chạy trên CI.

## Giới hạn (mỗi metric)

- Không SaaS runtime; không secrets thật; không đụng DB worker khác; không EAS Cloud; không claim production recovery/SLO.
- Volume 2×20k = SQL seed + HTTP issue pool riêng — không gắn nhãn HTTP RPS cho volume.
- `meetsPrdPilotWithoutCaveat` chỉ true khi rate/p95/error/invariants đạt trên máy đo; vẫn không phải cam kết capacity production.
- ROADMAP D5 Load/Obs/Business-restore giữ **`[ ]`** tới khi acceptance pilot + external gates đủ.
