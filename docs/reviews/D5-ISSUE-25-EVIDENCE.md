# Evidence — Issue #25 Observability / restore / load

Ngày đo: 2026-10-17 · Branch: `hangndat/d5-issue25-obs-load` · Base: `8b200c2`  
Ownership: root tooling / CI / infra / scripts / docs. **Không** sửa `apps/*` / lockfile.

## Gap matrix (trung thực)

| Hạng mục | Trạng thái | Evidence / lệnh | Chưa đạt |
| --- | --- | --- | --- |
| Fixture backup drill | PASS | `./scripts/d5-backup-drill.sh` → `D5_BACKUP_DRILL_PASS` | Không phải backup prod / SLO |
| Business + key restore | PASS | `./scripts/d5-business-restore-drill.sh` → `D5_BUSINESS_RESTORE_PASS` | RPO continuous chưa đo |
| Observability overlay | PASS smoke | `./scripts/d5-observability-smoke.sh` | API `/metrics` Prometheus text — BE task |
| TD §16 app metrics | GAP | Chỉ `/v1/health` JSON | p50/p95, pool wait, issue/confirm, queue age |
| Load API+OIDC+k6 | PASS local (caveat) | `./scripts/d5-load-baseline.sh` + [D5-ISSUE-25-LOAD-SUMMARY.json](./D5-ISSUE-25-LOAD-SUMMARY.json) | Admission edge vắng; không SLO prod |
| Admission ADR-15 | GAP | `infra/admission/Caddyfile.example` | S4 opening-shock không đo |
| O06 retention/region/SLA | OPTIONS only | `docs/ops/O06-OPTIONS.md` | Chưa chốt số |
| Runbook / release | DONE docs | `docs/ops/RUNBOOK.md`, `RELEASE-CHECKLIST.md` | Store states → #26 |
| Docs reconcile #51/#33/#42 | REPORT | `docs/reviews/D5-DOCS-RECONCILE.md` | Không merge/close #33/#42 |

## Restore (business)

```
D5_BUSINESS_RESTORE_PASS tenants=2 events=4 kid=drill-local-v1 checkins=1
dump_bytes=69545 dump_s=0 restore_s=1 rto_wall_s=1
```

- RTO wall-clock dump+restore ≈ **1 s** trên máy này (không phải RTO production).
- RPO: **không claim** (không có continuous backup/PITR trong drill).

## Load / admission (lần đo `6ddf19e1`)

Harness: Postgres task-specific (`ticket.task=d5-load`) + Nest API `:13101` + Keycloak `http://192.168.86.8:8080/realms/ticket` + k6.

Phần cứng: **14** CPU · **36** GB RAM.

| Metric | Giá trị |
| --- | --- |
| Events | 2 |
| Tickets / event (volume SQL + HTTP fill event0) | target 20000; event0 ends 19905 after 100 HTTP + 100 gate USED path; event1 = 20000 |
| HTTP issue (100 codes, 100 OIDC attendees) | **100/100** ok · **71.02 rps** · p50 **85 ms** · p95 **156 ms** · p99 **190 ms** |
| Gate scanners | **50** sessions · k6 100 confirm ok · confirm avg **250 ms** / p95 ≈ **407 ms** · error rate **0%** |
| Health burst | 200 rps × 15s · checks 100% |
| Invariants | tickets == allocated; every ticket has `kid` |
| Admission edge | **absent** — S4 không đo |

Chi tiết: `docs/reviews/D5-ISSUE-25-LOAD-SUMMARY.json`.

Volume ACTIVE tickets được SQL seed (ghi rõ trong summary `volumeSeedNote`); HTTP issue path đo riêng với user Keycloak tạm (xóa sau chạy).

## CI

Job `d5-hardening-smoke` trong `.github/workflows/ci.yml`: observability smoke + cả hai restore drill. Full 2×20k load **không** chạy trên CI.

## Graph

`code-review-graph-ticket` stale vs HEAD; semantic search observability/load → 0 nodes. Source/scripts là nguồn sự thật.

## Giới hạn

- Không SaaS runtime; không secrets thật; không đụng DB worker khác.
- Không Expo/EAS Cloud Build.
- Không claim “đạt pilot capacity production” khi admission/metric/RPO prod còn gap.
- `meetsPrdPilotWithoutCaveat: false` trong summary.
