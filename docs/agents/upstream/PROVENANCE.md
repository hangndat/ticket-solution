# Provenance — agency-agents (upstream)

## Nguồn

| Trường | Giá trị |
| ------ | ------- |
| Repository | https://github.com/msitarzewski/agency-agents |
| License | MIT — xem [LICENSE](./LICENSE) (Copyright (c) 2025 AgentLand Contributors) |
| Snapshot commit | `652b2692f8d8ec2b1f1a38e559073e287dfdc469` |
| Snapshot date (upstream committer) | 2026-10-15 |
| Copied into Vemoki | 2026-10-17 |

Chỉ **một tập con** agent được copy vào thư mục này. Không cài toàn bộ roster thành Cursor `alwaysApply` rules.

## Files đã chọn

| Upstream path | Dùng cho vai trò Vemoki |
| ------------- | ------------------------ |
| `product/product-manager.md` | Product / BA |
| `design/design-ux-architect.md` | Product Design / UX (nền tảng + handoff) |
| `design/design-ui-designer.md` | Product Design / UX (visual + component) |
| `engineering/engineering-software-architect.md` | Architect (kiến trúc hệ thống/contract/ADR, bổ sung ngày 2026-10-18; cùng snapshot commit phía trên) |
| `engineering/engineering-backend-architect.md` | Backend |
| `engineering/engineering-frontend-developer.md` | Web |
| `engineering/engineering-mobile-app-builder.md` | iOS |
| `engineering/engineering-code-reviewer.md` | Reviewer DoD / QA |
| `testing/testing-reality-checker.md` | Reviewer DoD / QA (evidence) |
| `testing/testing-accessibility-auditor.md` | PD a11y criteria + reviewer a11y khi cần |
| `security/security-appsec-engineer.md` | Reviewer Security |

`README-EXCERPT.md` chỉ giữ phần đầu README upstream để định hướng catalog — không phải agent.

## Cách dùng trong repo này

- File trong `upstream/` là **tham chiếu nguồn** (giữ nguyên nội dung upstream + license).
- Hướng dẫn vận hành Orca nằm ở `../roles/` — đã cắt bỏ phần không khớp stack/ownership Vemoki và **không** được ưu tiên hơn `AGENTS.md` / `.cursor/rules/orca-*.mdc`.
- Cập nhật upstream: ghi lại SHA mới trong bảng trên; diff role Vemoki thủ công (không auto-merge personality/workflow xung đột với Orca).
- Bản copy trong repo có thể đã chuẩn hóa trailing whitespace để pass git whitespace check; nội dung chuyên môn giữ nguyên.
