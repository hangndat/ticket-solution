# Runbook R-INT — stack local + headless e2e

Ngày: 2026-10-17  
Mục tiêu: tái lập stack self-host và chạy kiểm chứng root **không** GUI mouse, **không** deploy prod/cloud/store.

## 1. Stack local tái lập

```bash
cp .env.example .env   # chỉ local; không commit
pnpm infra:up          # postgres redis keycloak minio mailpit
./scripts/rint-stack-smoke.sh
RINT_STACK_UP=1 ./scripts/rint-stack-smoke.sh   # optional health
```

Ports mặc định (loopback): Postgres `55432`, Redis `56379`, Keycloak `8080`, MinIO `9000/9001`, Mailpit `1025/8025`.

Env đầy đủ tên biến: [`ENV-MANIFEST.md`](./ENV-MANIFEST.md). Queue MVP: [`ADR-17-OUTBOX-PG-DIRECT.md`](./ADR-17-OUTBOX-PG-DIRECT.md).

## 2. Recovery / concurrency drills

```bash
./scripts/rint-outbox-recovery.sh
```

Kỳ vọng dòng: `RINT_OUTBOX_RECOVERY_PASS`.  
Chứng minh: Redis mất dữ liệu / restart không xoá outbox PG; lease hold; reclaim sau “crash”.

Ngân sách poll/lease/attempts: bảng trong ADR-17. Bounded retry channel thuộc N-BE — root không sửa behavior BE.

## 3. Tenant host / cache / cookie

```bash
node --test scripts/lib/tenant-host.test.mjs
# hoặc: pnpm test:rint-host
```

Canonical: `{tenant}.vemoki.com` allowlist; apex không phải tenant; cache key gồm host+tenant+event+version+schema+locale; cookie **host-only**.

## 4. Headless UAT (khi apps sẵn)

| Kênh | Lệnh | Cấm |
| --- | --- | --- |
| Web | `./scripts/web-uat.sh` hoặc `pnpm uat:web` | cliclick / headed trừ khi user yêu cầu |
| OIDC P4 | `pnpm uat:p4-oidc` | mock auth production |
| iOS sim | `./scripts/sim-uat.sh …` | EAS Cloud Build; mouse vào Simulator |

Artifacts: `apps/web/.uat-artifacts/`, `apps/mobile/.uat-artifacts/` (gitignored).

## 5. Ma trận trạng thái

Cập nhật Pass/Unknown trong [`R-INT-MATRIX.md`](./R-INT-MATRIX.md). Live multi-tenant A/B và SMTP/APNs device là **integration/D5 riêng** — không Pass từ fixture.

## 6. Dependency / lockfile

Không thêm BullMQ hay MIME package trên R-INT trừ khi coordinator duyệt **exact version** và BE không edit lockfile đồng thời. Hiện ADR-17 không yêu cầu dependency mới.
