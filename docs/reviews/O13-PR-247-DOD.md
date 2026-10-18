# DoD Review — PR #247 (O13 trang bán platform VI/EN + host-aware marketing)

**PR:** https://github.com/hangndat/ticket-solution/pull/247  
**Branch:** `hangndat/o13-web-platform-sales` → `main`  
**Ghi chú:** Artifact này cập nhật sau **gap-fix** (interest durable + headless tracked + whitelabel copy). Revalidation DoD độc lập trên tip mới vẫn khuyến nghị trước merge nếu tip đổi.

## Exact SHA

Tip trước gap-fix (DoD PASS with known gap): `84b5509c8efe78aa66733f555438d0514e3b6647`  
Tip gap-fix: **xem `git rev-parse` trên branch sau commit `fix(web): close O13 DoD known gaps`**.

## Known gaps — trạng thái sau fix

| # | Gap cũ | Fix |
| - | ------ | --- |
| 1 | Interest store in-memory | Durable JSONL qua `interest-store.ts` (`MARKETING_INTEREST_PATH`); optional `MARKETING_INTEREST_WEBHOOK_URL` notify; path gitignored |
| 2 | Thiếu headless tracked | `scripts/web-uat.mjs o13-sales` → `docs/reviews/o13-pr-247-uat/*.png` + `EVIDENCE.md` |
| 3 | Whitelabel copy trùng lead | `point1/2/3` + `.body` riêng trên sales page |

## Checks gap-fix (local)

```bash
pnpm exec tsx --test tests/interest-store.test.ts tests/marketing-copy.test.ts tests/marketing-host.test.ts
# 18 pass
pnpm exec turbo run lint typecheck build --filter=@ticket/web...
pnpm test:routes  # PASS
WEB_BASE_URL=http://127.0.0.1:3013 pnpm exec node scripts/web-uat.mjs o13-sales
# 4 PNGs 200
```

## Verdict (coordinator note)

Runtime/CI blockers đã đóng ở `84b5509…`. Gap-fix đóng known gap #1–#3. **Không tự merge** — chờ CI trên tip mới + (tuỳ chọn) DoD revalidation nhanh.
