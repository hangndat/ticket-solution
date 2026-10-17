# Ma trận nghiệm thu R-INT (headless) — chính xác trạng thái

Ngày: 2026-10-17 · SHA tích hợp tham chiếu: ghi trên PR  
Phạm vi root: infra / scripts / CI / docs / shared helpers. **Không** claim MVP Done từ fixture.

Ký hiệu: **Pass script** = lệnh root xanh trên throwaway/local. **Pass live** = cần BE+web+iOS + Keycloak thật. **Unknown** = chưa có bằng chứng. **N/A** = ngoài MVP / O06 mở.

| # | Tiêu chí | Lệnh / bằng chứng | Trạng thái hiện tại | Ghi chú |
| --- | --- | --- | --- | --- |
| R1 | ADR-17 ghi PG leased outbox vs ADR-04 BullMQ | `docs/ops/ADR-17-OUTBOX-PG-DIRECT.md` + DECISION-LOG | Pass docs (sau merge PR) | Không tuyên bố BullMQ đã làm |
| R2 | Redis flush/restart không mất outbox | `./scripts/rint-outbox-recovery.sh` → `RINT_REDIS_*` | Pass script | Throwaway Docker |
| R3 | Worker crash → lease reclaim | cùng script → `RINT_WORKER_CRASH_LEASE_RECLAIM` | Pass script | Lease ≥5s SQL |
| R4 | Không double-claim khi lease còn | cùng script | Pass script | |
| R5 | Env SMTP/MinIO/APNs documented, no secrets | `docs/ops/ENV-MANIFEST.md`, `.env.example` | Pass docs | APNs `.p8` không commit |
| R6 | Compose self-host reproducible | `./scripts/rint-stack-smoke.sh`; `RINT_STACK_UP=1` optional | Pass manifest; live optional | Không prod deploy |
| R7 | Canonical host→tenant allowlist | `node --test scripts/lib/tenant-host.test.mjs` | Pass unit | Web/edge phải consume sau |
| R8 | Cache key tách tenant/version/locale/host | cùng unit test | Pass unit | Không dùng cookie trong key |
| R9 | Cookie host-only (không `Domain=.vemoki.com`) | cùng unit test | Pass unit | Web cookie opts cần khớp |
| R10 | Path tenant khớp host | cùng unit test | Pass unit | |
| R11 | CI check + database-isolation | `.github/workflows/ci.yml` | Pass khi CI xanh trên PR | |
| R12 | Headless web UAT | `./scripts/web-uat.sh` / `pnpm uat:web` | Phụ thuộc stack + auth | Không GUI mouse |
| R13 | Headless iOS sim UAT | `./scripts/sim-uat.sh` | Phụ thuộc sim local | Không EAS Cloud |
| R14 | Multi-tenant A/B live brand/terms/import | Integration task riêng | **Chưa** full live | Fixtures ≠ acceptance |
| R15 | SMTP outbound internet | — | **Unknown** | Mailpit ≠ delivery |
| R16 | APNs physical device | — | **Unknown** | D5 / device UAT |
| R17 | Lockfile / MIME deps | Chỉ khi coordinator duyệt exact version | **Không đổi** trong R-INT này | Coordinate BE |
| R18 | Prod / cloud / store | — | **N/A / cấm** | ADR-11 |

## Headless runbook ngắn

Xem [`R-INT-RUNBOOK.md`](./R-INT-RUNBOOK.md).

```bash
node --test scripts/lib/tenant-host.test.mjs
./scripts/rint-stack-smoke.sh
./scripts/rint-outbox-recovery.sh
# Live (cần infra up + apps):
pnpm infra:up
pnpm uat:p4-oidc   # khi Keycloak sẵn
pnpm uat:web       # Playwright headless
```
