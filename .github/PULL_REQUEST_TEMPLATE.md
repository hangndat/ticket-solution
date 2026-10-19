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
- [ ] Đã hoặc sẽ spawn **Cursor DoD reviewer độc lập** (≠ session implementer) với exact SHA trên
- [ ] Security-sensitive (RLS/authz/race): có gate review riêng nếu áp dụng

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
