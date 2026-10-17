# Evidence — Issue #25 Observability / restore / load

Ngày đo: 2026-10-17 · Branch: `hangndat/d5-issue25-obs-load` · Base: `8b200c2`  
Ownership: root tooling / CI / infra / scripts / docs. **Không** sửa `apps/*` / lockfile / `packages/backend` contracts.

## Gap matrix M01–M12 + release gates

| Module / gate | Trạng thái | Evidence / nguồn | Owner tiếp theo | Internal / External |
| --- | --- | --- | --- | --- |
| M01 Tenant + RLS | PASS (D1/D4) | Issue #12/#24; `test:db` | — | Internal done |
| M02 Identity OIDC | PASS local | Keycloak P4; realm Vemoki dual scheme | — | Internal done; prod realm sync external |
| M03 Event lifecycle | PASS skeleton→D4 | Admin publish PRs | — | Internal done |
| M04 Branding | PARTIAL | `brand/vemoki/**` port từ #42; web/iOS assets workers | Web/iOS | Internal ready |
| M05 Loại vé / quota | PASS D2 | Issue path + quota scopes trong load invariants | — | Internal done |
| M06 Import mã | PASS D4 | Admin import | — | Internal done |
| M07 Redemption | PASS đo local | S3 HTTP redeem thật + OIDC | — | Internal done (scale prod external) |
| M08 Ticket / ví / credential | PASS drill crypto | AES-GCM seal/open sau restore | — | Internal done; key custody prod external |
| M09 Email / push | PARTIAL | Outbox rows counted; SMTP Mailpit; APNs thật → #26 | Worker/#26 | External (APNs/TestFlight) |
| M10 Gate check-in | PASS local | 50 scanner/event × 2; confirm S3 | — | Internal done (device UAT external) |
| M11 CS / báo cáo | PARTIAL | Report API trong harness; CS API thiếu | BE | Internal ready backlog |
| M12 Platform ops | PARTIAL | Backup/restore/obs/admission scripts; `/metrics` BE follow-up | BE metrics + ops | Internal + external VPS |
| Release: CI check + db-isolation | PENDING merge | PR #53 checks | Coordinator | Internal |
| Release: RPO≤15m / RTO≤2h prod | GAP | Dump-point RPO method only; continuous PITR chưa | Ops | **External** |
| Release: Store / TestFlight | GAP | #26 | iOS | **External** |
| Release: O06 retention/region/SLA | OPTIONS | `O06-OPTIONS.md` | Product | **External** (chặn data thật) |

## Gap matrix ops (Issue #25)

| Hạng mục | Trạng thái | Evidence / lệnh | Chưa đạt |
| --- | --- | --- | --- |
| Fixture backup drill | PASS | `./scripts/d5-backup-drill.sh` | Không phải backup prod / SLO |
| Business + key restore | PASS local | `./scripts/d5-business-restore-drill.sh` — AES-GCM decrypt + API reconnect + post-backup mutation absent | Continuous RPO≤15m / RTO prod **external** |
| Observability overlay | PASS smoke | `./scripts/d5-observability-smoke.sh`; scrape `/metrics` + Bearer file sẵn | BE `/metrics` series đầy đủ §16 — BE follow-up |
| Load S3 sustained | PASS local (xem summary) | `./scripts/d5-load-baseline.sh` | Không claim SLO prod |
| Admission ADR-15 S4 isolated | PASS | `./scripts/d5-admission-s4.sh` — 429+Retry-After; Gate bypass | Opening-shock 50k không claim |
| O06 | OPTIONS | `docs/ops/O06-OPTIONS.md` | Chưa chốt số |
| Runbook / release docs | DONE docs | `docs/ops/*` | Store → #26 |
| Docs reconcile #51/#33/#42 | REPORT | `D5-DOCS-RECONCILE.md`, `D5-DOCS-RECONCILE-PR42.md` | Không merge/close #33/#42 |

## Restore (business)

```
D5_BUSINESS_RESTORE_PASS tenants=2 events=4 kid=local-v1 crypto=1 api_reconnect=1
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
