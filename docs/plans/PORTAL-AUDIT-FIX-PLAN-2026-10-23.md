# Kế hoạch sửa portal sau audit — 23/10/2026

User **duyệt** sau báo cáo [audit #832](../reviews/PORTAL-AUDIT-2026-10-23.md). Triển khai PA-01–PA-06 theo wave; giữ O18/O22, AntD/ProComponents, API và auth hiện tại. Architecture impact: **Không**. Visual budget: **Không** — dùng token staff hiện hành. Không production/store từ approval này.

| Task | Ownership | Phụ thuộc thật | Đầu ra |
| --- | --- | --- | --- |
| PD — Liv | `docs/design/portal-audit-fix-2026-10-23/` | Không | Handoff header + prototype/ảnh 390/1024/1440, copy chuẩn, states/a11y/AC |
| Web A — Higo | `apps/portal` copy/formatter/filter/export/motion | Không, làm song song PD | PA-02–06, checks và commit local |
| Web B — Higo | `apps/portal` header | PD + Web A (cùng slice/path locale) | PA-01 theo mẫu, không regression PA-02–06 |
| Integration — coordinator | Docs, root branch/PR/CI | Hai commit coding và PD | PR vào main, evidence/checkpoint |
| DoD+UX — James | Review only exact SHA | Code tích hợp/PD/evidence | Verdict riêng DoD/UI, batch findings nếu còn |

Không tạo chuỗi giả theo Story: PD và Web A chạy ngay khi sẵn. Web B đợi mẫu header và kết thúc Web A vì một feature coder/slice và cùng file locale. Reviewer khác implementer; tối đa hai lượt sửa tự động theo `orca-review-convergence.mdc`.

## Acceptance

- Header: 390/430/768/1024/1440, VI+EN/tên dài, tenant/event/account có label và keyboard; không clipping/overlap/text dọc/page overflow.
- Guests: filter nguồn/loại vé chỉ trong tab Import; tab/filter/deep-link/back có hành vi rõ, không đổi API.
- Copy: diễn đạt công việc và trạng thái chính xác; loại wave/protocol jargon trên luồng chính, VI/EN đúng nghĩa, labels/empty/error rõ. Không cấm Email/CSV/ID máy móc.
- Thời gian: locale đúng, UTC giữ rõ, invalid date không crash; test hành vi thay vì regex khóa implementation.
- Export accessible name theo công việc; CSS loading không animation khi reduced-motion.
- Portal test/lint/typecheck/build, browser evidence/probe đúng SHA; ghi phần chưa kiểm theo role/journey. CI xanh trên SHA cuối và tích hợp trước acceptance complete.

## Phạm vi không mở

Token/palette staff, đổi Table/ProTable hàng loạt, RSC/bundle refactor chưa đo, lookup mới, backend/auth/RBAC, nghi vấn menu/context chưa tái hiện, production/store.

## Checkpoint ban đầu

- Audit baseline: `b34187919ade8ab5e07efcab59ac0284097c663d`.
- Base implementation: `origin/main` `b6ad2b0de3268511e3df04417589d919de34100c`; lấy lại main trước khi bắt đầu. Evidence audit vẫn gắn SHA cũ, không gọi là đã chạy trên SHA mới.
- Independent-review fix: **0/2**; ngoại lệ chưa dùng; chưa chẩn đoán.
- Status: **Đang làm** sau approval, chưa code complete / acceptance complete / pilot ready.
