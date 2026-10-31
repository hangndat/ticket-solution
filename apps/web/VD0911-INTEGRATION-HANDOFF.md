# Bàn giao Web VD09–VD11

Base: `774933ecc6949f8185d3b20bcf6ae2523e19cc63`. Dependency do coordinator tích hợp: `01a9eccfe087d76e7a38654dbf70fef77ac5ad5c` (shared Logo Kit và primary token).

## Mapping nguồn

- `hangndat/vd09-marketing-neon` (`ab3c1b0b` đến `757a7813`): đưa artwork có provenance, icon/OG/demo và copy VI/EN; dựng hero, event cards, product và final CTA bằng Tailwind, giữ form lead thật của main. Đây là bản chuyển một phần, chưa tương đương thiết kế nguồn: ribbon, modal tư vấn, chrome và các chi tiết responsive còn thiếu; các section main cũ vẫn tồn tại để giữ anchor và chức năng.
- VD10 (`e24905da`, `b2dc359b`, `757a7813`, `6a4b6d55`): chuyển một phần consumer sang primary và cập nhật default wordmark/icon. Chưa kiểm kê từng component so với nguồn; màu primary thực tế phụ thuộc shared commit trên.
- `hangndat/vd11-perf-recovery` (`816c4ff4`/`d5a08a4e`): đặt SiteNav tại consumer layout để giữ instance qua điều hướng. Không đưa SSR discovery/snapshot cũ; chưa đo CLS, INP hay latency trên build tích hợp.
- `hangndat/vd11-auth-recovery`, `hangndat/vd11-integration` (`6cad8664`, `1cd4650f`, `5c66678c`, `41da7c62`): không phục hồi boundary cũ. Main `4102a91f` (AUTH-07) đã thay thế các nhánh private wallet/ticket bằng actor epoch, client gate và response binding; main `829af744` giữ staff bounce, `e9fa49c2` bỏ WebGate. Chưa chứng minh mọi invariant của boundary cũ đã được AUTH-07 bao phủ; cần reviewer đối chiếu revalidation, bfcache và identity change.
- Cinematic PR1091 (`64914715`, các sửa `3db21029`, `79096851`, `fde87749`): chưa port. LCP mobile chưa đo và vẫn là gate mở; không tăng baseline UI hoặc giấu CSS.

## Evidence và giới hạn

- `pnpm --filter '@ticket/web^...' build`, `pnpm --filter @ticket/web typecheck`, `lint`, `test`, `build`: pass sau khi cài frozen lockfile. Build cảnh báo tracing dynamic filesystem tại `src/marketing/lead/idempotency.ts`.
- `node scripts/ui-budget.mjs --scope web`: pass, CSS 0 → 0, TSX hex 6 → 5. Detector impeccable trên hai section mới: `[]`.
- Orca browser local dev, base `http://localhost:3000`, page `f4e3038f-0747-4c15-a77d-be4b96684925`: marketing VI desktop 1440 và mobile 390; EN desktop 1440 và mobile 390, không overflow ở mobile; form hiện diện. Consumer `/` → `/redeem` giữ cùng header DOM, desktop 1440 header cao 73px. Đây là smoke, chưa gửi lead hoặc kiểm tra session thật, chưa phải UAT đầy đủ, và chạy trước commit nên cần revalidate exact SHA sau ghép shared.
- Chưa có review độc lập, CI, đo performance, kiểm thử xác thực thật hoặc desktop/mobile toàn bộ journeys. Không deploy; không coi slice này là hoàn tất VD09/VD11.
