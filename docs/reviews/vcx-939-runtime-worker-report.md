# Worker report — VCX-939 runtime UAT (Linh · web)

## Tóm tắt ba câu

Đã chạy runtime UAT ma trận attendee trên UI869 với `apps/web` tại SHA `d00a265cca1206b68601c75d445b633f7d590b57`: Orca browser (390/1024/1440), HTTP `pnpm uat:p4-oidc` 12/12 PASS, ảnh trong `apps/web/.uat-artifacts/vcx-939/`. Không tái hiện gap sản phẩm trong `apps/web` — chỉ cập nhật `docs/reviews/vcx-939-web-attendee-verify.md` (mục Runtime). PR docs Refs #939, không merge.

- Task / Dispatch: `task_c17695de40e1` / `ctx_0e4f837978c5`
- Base → head: `d00a265cca1206b68601c75d445b633f7d590b57`; working tree: thay đổi docs (chưa commit khi ghi báo cáo)
- Paths: `docs/reviews/vcx-939-web-attendee-verify.md`, `docs/reviews/vcx-939-runtime-worker-report.md`
- Trạng thái: không có thay đổi code; đã bàn giao evidence runtime một phần; acceptance complete Chưa (pending/rejected, unknown timeout và email lỗi → vé đã phát chưa có E2E); pilot ready Chưa đánh giá.

| Check | SHA / input | Kết quả | Evidence |
| --- | --- | --- | --- |
| `pnpm uat:p4-oidc` | `d00a265` + UI869 | PASS (12) | terminal session |
| `pnpm --filter @ticket/web test` | `d00a265` | PASS (293) | terminal session |
| Orca browser UAT | `d00a265`, tab `044827fd-…` | PASS (bảng runtime trong verify doc) | `apps/web/.uat-artifacts/vcx-939/*.png` |
| Public catalog | API :3498 | PASS 200 | curl |

- Findings: không gap mới; F-939-01 đóng runtime; UAT limitation — Keycloak form Orca (bootstrap curl PKCE + `goto` callback, không sửa app)
- Evidence packet: `docs/reviews/vcx-939-web-attendee-verify.md` § Runtime; PNG gitignored dưới `apps/web/.uat-artifacts/vcx-939/`
