# PR #771 — fix review FAIL (F01–F03) + DoD evidence

| Field | Value |
| --- | --- |
| Scope | Epic #770 slice 1a · PR #771 |
| Prior review SHA | `48fd1e8ae093a106c1ccbc74a5c06b84cdc433da` (FAIL) |
| Fix SHA | `7305b54e29a734faea580e16e11e647f4900cbd2` |

## Security fixes (blockers)

| ID | Fix |
| --- | --- |
| **F01** | `checkMarketingAnalyticsRequest`: bắt buộc `Origin` trong allowlist marketing (`MARKETING_ORIGIN` / `MARKETING_HOSTS`); `Host` phải là marketing host; từ chối 403; không dùng Referer; `Content-Type` chỉ `application/json` (hoặc omitted cho sendBeacon); body ≤ 4 KiB trước parse |
| **F02** | Schema chặt theo event (`cta_id`, `locale`, `role` enum); từ chối key thừa; chặn email/SĐT/URL trong giá trị chuỗi |
| **F03** | `trustedClientIpForRateLimit`: không tin `X-Forwarded-For` khi `TRUST_PROXY` tắt; khi bật dùng `X-Real-IP` / hop cuối XFF |

## Bundle JS (`scripts/measure-web-chunk-bytes.mjs`, post-`pnpm --filter @ticket/web build`)

| Ref | jsBytes | Δ vs review SHA |
| --- | ---: | ---: |
| Review SHA `48fd1e8` (artifact review) | 1_168_587 | — |
| Fix build (local, cùng worktree) | 1_171_968 | +3_381 |
| `origin/main` (pre-slice, không có analytics route) | _(không so trực tiếp chunk)_ | slice ~+7.5 KiB TS nguồn (review) |

## Marketing UI parity

`git diff 48fd1e8..HEAD -- apps/web/app/marketing apps/web/src/marketing/sales-page.tsx apps/web/src/marketing/chrome.tsx apps/web/app/globals.css` → **không đổi** (chỉ analytics/seo guard).

Playwright screenshot diff 1280/390: **chưa chạy** (browser cache thiếu trên runner); thay bằng static diff + HTTP 200 smoke:

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Host: vemoki.com" http://127.0.0.1:3000/      # 200
curl -s -o /dev/null -w "%{http_code}" -H "Host: vemoki.com" http://127.0.0.1:3000/en    # 200
```

## robots / sitemap (Host: vemoki.com, stack local `MARKETING_HOSTS=vemoki.com`)

- `robots.txt`: **không** liệt kê `/admin`, `/gate`, `/wallet`; vẫn `Disallow` product/API paths; `app` host → `Disallow: /` (unit tests).
- `sitemap.xml`: 6 URL public VI/EN (sales/privacy/support).

## Lighthouse SEO (local `next start`, path `/marketing`)

| Run | SEO score |
| --- | ---: |
| Desktop headless Chrome | **66** |

_(Localhost không phản ánh apex canonical đầy đủ; CI/review SEO metadata vẫn pass unit tests.)_

## Checks

```bash
pnpm --filter @ticket/web lint
pnpm --filter @ticket/web typecheck
pnpm --filter @ticket/web test
pnpm --filter @ticket/web test:routes
pnpm --filter @ticket/web build
node --import tsx --test apps/web/tests/marketing-*.test.ts  # 22 pass
```
