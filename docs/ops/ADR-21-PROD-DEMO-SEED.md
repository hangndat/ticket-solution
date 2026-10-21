# ADR-21 — Seed fixture demo lên production (Epic #686)

Ngày: 2026-10-21  
Trạng thái: **Đề xuất** (chờ coordinator chốt ID + owner phê duyệt chạy prod)  
Epic: [#686](https://github.com/hangndat/ticket-solution/issues/686)  
Runbook vận hành: [`PROD-SEED-RUNBOOK.md`](./PROD-SEED-RUNBOOK.md)  
Base SHA thiết kế: `c76657c35bd876e425b247234e5fde57fa80e322` (worktree `seed-arch`)

## Bối cảnh

Cần đưa dataset fixture (4 org / 6 event theo Epic #686, membership staff, event assignment, mã redeem, marketing config ADR-19, media MinIO) lên **PostgreSQL + MinIO production** trên VPS (`infra/deploy`, `.cursor/skills/deploy-prod/SKILL.md`) để pilot GTM / UAT thật, **không** làm bẩn tenant/event do khách vận hành.

Hiện trạng code (D9): `packages/backend/src/demo-seed.ts` + `packages/backend/scripts/demo-seed.cjs` — idempotent theo **UUID cố định**, fail-closed khi slug/id trùng dữ liệu không thuộc fixture. Epic #686 mở rộng dataset (4 tenant, 6 event) — BE wave sẽ mở rộng cùng namespace UUID `d9d9f001-…` (BA dataset).

## Quyết định

1. **Chạy seed chỉ trong container `api`** (hoặc one-shot `vemoki-runtime:local` cùng network Compose, cùng env `/opt/vemoki/.env`), **không** từ laptop trực tiếp vào Postgres prod.
2. **Staff prod: gắn membership trực tiếp trong DB** (pattern `seedD9DemoDataset` — `usersByEmail` + `ensureStaffAccess`), **sau khi** người vận hành đã có hàng `users` từ đăng nhập Keycloak thật (plus-address owner). **Không** bulk `MembershipInvite` trong lần seed đầu. **Không** import user/password vào `realm-ticket.json` cho staff prod.
3. **Mã redeem:** dùng **`CODE_HMAC_PEPPER` production** đã có trong `/opt/vemoki/.env` (≥16 byte, không đổi pepper trong window seed). Plaintext chỉ lưu trong runbook/evidence nội bộ owner, DB chỉ HMAC.
4. **Media:** `node scripts/d9-seed-media.mjs` từ runtime trong network Docker, `MINIO_ENDPOINT` nội bộ (bucket private, không publish cổng MinIO), theo [`MEDIA-ASSET-CHECKLIST.md`](./MEDIA-ASSET-CHECKLIST.md) và `brand/demo/manifest.json` (mở rộng theo PD Epic #686).
5. **Trước mutate:** snapshot DB + ghi nhận SHA image/git; **dry-run** = preflight SQL + chạy full seed trên **bản restore** hoặc staging (không có flag dry-run trong CLI hiện tại — BE có thể thêm `PROD_SEED_DRY_RUN` sau).
6. **Email:** seed DB **không** enqueue `MembershipInvite` / `TicketIssued`; vẫn **tạm dừng worker** trong window seed để tránh xử lý outbox cũ / lỗi vận hành. Khi bật SMTP prod (ADR-13), **cấm** gọi API invite hàng loạt trong cùng phiên seed.

## So sánh phương án staff / Keycloak

| Phương án | Mô tả | Lợi | Hại |
| --- | --- | --- | --- |
| **A — Realm import user** | Thêm user + password vào `realm-ticket.json`, `force-recreate keycloak` | Login ngay với password cố định | Mật khẩu trong file realm; không khớp email owner thật; recreate Keycloak rủi ro; vi phạm “không mock auth production path” |
| **B — MembershipInvite + SMTP** | `createMembershipInvite` → outbox → worker gửi mail | Flow sản phẩm chuẩn | N email khi SMTP prod; re-run / retry spam; phụ thuộc worker + SMTP trong lúc seed; không idempotent delivery |
| **C — Membership DB sau OIDC login (chọn)** | Owner đăng nhập `app.vemoki.com` trước; seed grant membership theo email | Không secret trong realm; không email seed; khớp subject Keycloak thật; tái dùng code idempotent hiện có | Staff phải login một lần trước seed; cần env email staff (plus-address) trong BE mở rộng |

**Chọn C.** Dùng **MembershipInvite + SMTP** chỉ cho **staff bổ sung sau pilot**, qua portal/admin, không trong job seed hàng loạt.

## Invariants & ranh giới

- Fixture UUID/slug trong allowlist Epic (#686 / `docs/demo/` sau BA) — seed **throw** nếu slug đã thuộc tenant khác UUID.
- Marker `· Demo` chỉ trên `event.name` (giữ D9).
- Tenant/event **production thật** (không UUID fixture) — **không** UPDATE/DELETE qua seed.
- MinIO: chỉ key trong manifest; không public bucket.
- RLS: script dùng connection app (runtime role), không bypass bằng superuser trừ bước backup/restore do operator.

## Rollback (tóm tắt)

- **Ưu tiên:** restore Postgres từ snapshot nếu seed sai phạm vi.
- **Surgical:** xóa theo allowlist UUID fixture (tenant/event/membership/assignment/code) — chi tiết SQL trong runbook; **không** `DELETE` rộng.
- MinIO: xóa object key theo manifest (PutObject idempotent; rollback = delete có kiểm soát).

## Handoff

| Hạng mục | Owner | Ghi chú |
| --- | --- | --- |
| Mở rộng `demo-seed.ts` → 4 org / 6 event | Backend | Epic #686, dataset BA |
| `PROD_SEED_STAFF_EMAIL`, bỏ hardcode `staff@example.com` prod | Backend | Env-only prod |
| `PROD_SEED_DRY_RUN` / preflight CLI | Backend | Tùy chọn, không chặn ADR |
| Manifest media 6 event | Web/PD + `d9-seed-media.mjs` | Checklist kích thước |
| Chạy prod sau dod+sec | Owner + coordinator | Gate Epic |

## Xác minh

- Local/staging: `./scripts/d9-demo-seed.sh` hai lần (idempotent) + `d9-seed-media.sh --smoke-only`.
- Prod (sau owner OK): JSON report `demo-seed.cjs`, smoke `d9-demo-seed-smoke.sh` (điều chỉnh issuer prod), health `api.vemoki.com`, không mail invite ngoài ý muốn.

## Kết luận

**Đề xuất** — đủ để BE/ops triển khai trong Epic #686 với runbook; **chặn** chạy prod cho đến review PASS + xác nhận owner (runbook § Owner gates).
