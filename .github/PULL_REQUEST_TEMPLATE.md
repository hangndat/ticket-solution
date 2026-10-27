## Tóm tắt

<!-- 1–3 bullet tiếng Việt: vì sao thay đổi; giữ thuật ngữ kỹ thuật / Issue / SHA nguyên văn -->

-

## Phạm vi

- Ownership slice: <!-- backend | web | iOS | coordinator/process -->
- Issue liên quan: <!-- #N hoặc N/A -->
- **SHA tip branch:** <!-- `git rev-parse HEAD` — bắt buộc cho DoD -->

## Checklist DoD (trước khi nhờ duyệt)

- [ ] Một ownership slice (không trộn BE+web+iOS trên cùng PR trừ khi coordinator contract)
- [ ] Không secrets / `.env` / credential thật
- [ ] CI kỳ vọng xanh trên SHA tip (hoặc ghi rõ docs-only / không chạy runtime)
- [ ] Nhánh B (product rủi ro): spawn reviewer độc lập với exact SHA. Nhánh A (docs/tooling): coordinator tự kiểm + SHA, không reviewer
- [ ] Security-sensitive (RLS/authz/race): có gate review riêng nếu áp dụng

## Checklist UI (khi đụng `apps/web`, `packages/ui`, `apps/mobile`)

Quy tắc: `docs/reviews/FE-UI-FRAMEWORK-AUDIT-2026-10-22.md` mục 5. Bỏ qua nếu PR không đụng UI.

- [ ] `node scripts/ui-budget.mjs` pass; chỉ số giảm thì đã chạy `--update` trong PR này
- [ ] Không thêm selector vào `live-pulse-legacy.css` / `marketing-uplift.css` / `attendee-uplift.css`, không tạo `*.module.css` mới
- [ ] Tương tác dùng shadcn/Radix (web) hoặc `@expo/ui` (mobile) — không tự viết focus trap / roving tabindex
- [ ] Không hex / số px tùy ý trong tsx; chỉ token. Nút dùng `Button` dùng chung
- [ ] Chạm route nào thì xóa legacy của route đó; ghi số dòng đã xóa
- [ ] Screenshot trước/sau (web 1280 + 390, iOS), vi + en, đủ trạng thái control bị đụng; `data-testid` giữ nguyên

## Evidence nghiệm thu (điền khi chuyển Chờ duyệt)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | <!-- Cursor DoD / Orca worktree — khác implementer --> |
| Scope | <!-- paths / Issue / PR --> |
| Commit SHA đã duyệt | <!-- exact SHA --> |
| Checks | <!-- `./scripts/gh-dod-evidence.sh <pr>` hoặc docs-only; tránh lặp `gh pr checks` --> |
| Findings / limitations | <!-- PASS \| FAIL \| PASS with known gap --> |
| Revalidation | <!-- N/A hoặc SHA mới cần duyệt lại --> |

**Lưu ý:** Thiếu GitHub Review approve **không** chứng minh thiếu Orca/Cursor DoD — ghi artifact + SHA ở đây hoặc trên Issue / `docs/reviews/*`.

## Kế hoạch kiểm thử

- [ ]
