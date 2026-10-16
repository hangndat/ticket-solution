# W0 Foundation — delivery report

Ngày: 2026-10-16. Repo private: https://github.com/hangndat/ticket-solution

## Kết quả

Đã tạo baseline Git/monorepo, chạy ba worker Orca song song trong worktree riêng và tích hợp vào main. Đây là foundation để triển khai nghiệp vụ, chưa phải platform phát vé production.

| Phần        | Đã có                                                                                        | Evidence                                                                        |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Tooling     | pnpm workspace, Turborepo, lockfile, Node 24 CI, formatter, agent ownership                  | `pnpm check`, GitHub Actions                                                    |
| Local infra | PostgreSQL 18, Redis, localhost ports, volume và healthcheck                                 | `pnpm infra:up`, Compose healthy                                                |
| API         | NestJS/Fastify, `/v1/health`, env validation, shutdown, OpenAPI                              | 3 API tests, deterministic OpenAPI regeneration                                 |
| Worker      | Bootstrap riêng, idle rõ ràng, shutdown                                                      | 2 lifecycle tests; chưa có job processor                                        |
| Database    | Prisma schema/migration tenants/events, composite key, FORCE RLS, transaction-local context  | Real PostgreSQL test bằng role non-owner/non-BYPASSRLS; pooled connection reuse |
| Web         | Next.js public shell, hai tenant demo, brand/routing riêng, admin placeholder                | 4 tests và production HTTP routing scenario                                     |
| iOS         | Expo Router, native shell, demo events, ví vé trống, staff placeholder, SecureStore boundary | 8 tests, Doctor 20/20, Hermes export, local unsigned simulator build            |

Public web và iOS dùng fixture được ghi rõ là demo, chưa tích hợp event API thật. Không có mock login hoặc staff authorization được coi là production.

## Thực thi song song

Orca Run: `run_0cf97c970de0`. Runtime IDs chỉ là lịch sử thực thi, không dùng làm authority cho task mới.

| Task             | Worker commit gốc | Kết quả                |
| ---------------- | ----------------- | ---------------------- |
| Backend/Data W0  | `bc75565`         | Succeeded, đã tích hợp |
| Web W0           | `7a3ff7d`         | Succeeded, đã tích hợp |
| iOS W0           | `95e7e3f`         | Succeeded, đã tích hợp |
| Sửa DB readiness | `0ab4c40`         | Succeeded, đã tích hợp |

Coordinator quản lý root config, shared contracts, lockfile và CI; các worker không sửa chéo phần ứng dụng. Các dispatch đã settled; runtime giữ một resource với lý do user_takeover, các resource còn lại đã release. Worktree/commit được bảo toàn.

## Kiểm chứng

- `pnpm check`: PASS trên workspace tích hợp, gồm lint, typecheck, 18 tests và builds (API/worker/contracts/backend/web/iOS JS).
- `pnpm --filter @ticket/backend test:db`: PASS độc lập sau bản sửa startup, không skip Docker/RLS. Worker đã chạy sáu lượt fresh-container sau fix.
- `pnpm --filter @ticket/web test:routes`: PASS, production HTTP kiểm tra đúng tenant và 404 cho sai cặp tenant/event.
- `pnpm --filter @ticket/api openapi` và `git diff --exit-code -- apps/api/openapi.json`: PASS.
- `CI=1 npx --yes expo-doctor@latest` trong app tích hợp: PASS 20/20.
- iOS worker: local Xcode unsigned simulator compilation PASS, log có `BUILD SUCCEEDED`; xem [mobile report](../apps/mobile/W0-REPORT.md) cho lệnh và giới hạn.
- CI có job check và database-isolation, chạy Node 24/Linux. Trạng thái theo từng commit xem [GitHub Actions](https://github.com/hangndat/ticket-solution/actions).

Một lần test RLS độc lập ban đầu lỗi kết nối trước setup. Harness cũ có thể nhận nhầm temporary Unix-socket server lúc Docker init. Đã chuyển probe sang final TCP listener và kiểm tra connection/query có deadline trước chạy scenario. Không retry hoặc che lỗi các assertion RLS.

## Chính sách build iOS

Yêu cầu bắt buộc của người dùng: **không bao giờ dùng Expo/EAS Cloud Build**. Native binary/archive build bằng local Expo prebuild + Xcode/xcodebuild/fastlane trên Mac hoặc runner macOS tự quản lý; không cloud fallback. Quy tắc được ghi ở root/mobile AGENTS.md, README, PRD và technical design.

W0 không dùng Expo cloud để build. Simulator binary được build local; CI Linux chỉ export JavaScript. Chưa build bản ký số cho thiết bị/TestFlight/App Store, chưa interactive/physical-device UAT.

## Phần tiếp theo

1. Chốt managed OIDC provider và chứng minh identity/membership/revocation trước mở tenant business endpoints.
2. W1: mã/quota/issue transaction + outbox/email, web redemption, iOS ví vé với API thật.
3. W2: Gate reserve/confirm/recovery, hai thiết bị, race tests và quy trình phát vòng tay.
4. Capacity/50k, production authz, full schema, worker delivery, venue networking và restore drill chưa được chứng minh ở W0.

Không deploy production hoặc submit App Store trong milestone này.
