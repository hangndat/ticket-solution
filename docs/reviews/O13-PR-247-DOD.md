# DoD Review — PR #247 (O13 trang bán platform VI/EN + host-aware marketing)

**PR:** https://github.com/hangndat/ticket-solution/pull/247  
**Branch:** `hangndat/o13-web-platform-sales` → `main`  
**Reviewer / session:** Orca `reviewer-dod` (Cursor), terminal `term_716d2c93-e97b-45b4-a3a4-87f948c5cc62`, dispatch `ctx_ee0f33ad2aad` — độc lập ≠ implementer gap-fix  
**Loại:** Revalidation sau gap-fix (không merge trong phiên này)

## Exact SHA (đang duyệt)

`5898673dad43885d82e88c02104fd696f5adac88`  
(`git rev-parse` trên tip PR #247; subject: `fix(web): close O13 DoD known gaps on marketing sales`)

Tip trước gap-fix (DoD PASS with known gap): `84b5509c8efe78aa66733f555438d0514e3b6647`

## Known gaps — revalidation

| # | Gap cũ | Kết quả trên SHA `5898673…` |
| - | ------ | --------------------------- |
| 1 | Interest store in-memory | **Đóng.** `persistInterestSubmission` → `appendInterestRecord` (JSONL, `MARKETING_INTEREST_PATH`, default `apps/web/.data/` gitignored); optional `MARKETING_INTEREST_WEBHOOK_URL` (+ secret header). Route gọi durable persist; `recent[]` chỉ helper test. Có `apps/web/tests/interest-store.test.ts`. |
| 2 | Thiếu headless tracked | **Đóng.** `scripts/web-uat.mjs o13-sales` → `docs/reviews/o13-pr-247-uat/{o13-sales-vi,o13-sales-en,o13-privacy,o13-support}.png` + `EVIDENCE.md` — cả 5 file `git ls-files` tracked; PNG thật (1280×…). |
| 3 | Whitelabel copy trùng lead | **Đóng.** VI/EN có `whitelabel.point{1,2,3}.body` ≠ lead/title; `sales-page.tsx` render `.body` cho 3 điểm, `whitelabel.lead` chỉ ở lead section. |

## Checks

| Check | Kết quả |
| ----- | ------- |
| CI Actions run `39086103958` trên tip `5898673…` | **success** — `changes` pass, `web` pass (53s), `ci` pass, `turbo-persist` pass; backend/mobile/d5/database-isolation skipped (đúng path filter web) |
| Static verify interest + copy + tracked UAT | PASS (python assert trên tree SHA) |
| Unit tests local (`tsx --test …`) | Không chạy được trong worktree reviewer (thiếu `node_modules`/tsx); dựa CI `web` xanh + đọc test sources |

## Findings / limitations

- Không blocker mới.
- Webhook interest là optional notify (fail không rollback JSONL) — đúng thiết kế gap-fix.
- Artifact này cập nhật tại worktree reviewer; tip remote vẫn `5898673…` nếu chưa có commit docs follow-up.

## Verdict

**PASS**

Known gaps #1–#3 đã đóng trên exact SHA `5898673dad43885d82e88c02104fd696f5adac88`; CI xanh trên SHA đó. **Không merge** trong phiên reviewer này — coordinator merge khi được ủy quyền.
