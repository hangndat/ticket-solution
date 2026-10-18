# O13 PR #247 — Headless UAT evidence (tracked)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Mục đích | Đóng known gap DoD: thiếu screenshot headless tracked |
| Lệnh | `WEB_BASE_URL=http://127.0.0.1:3013 pnpm exec node scripts/web-uat.mjs o13-sales` |
| Runtime | `next start --port 3013` sau `turbo build --filter=@ticket/web...` |
| Apex smoke | `Host: vemoki.com` → `/` và `/privacy` HTTP **200** |

## Artifacts (PNG trong thư mục này)

| File | URL local | Status |
| ---- | --------- | ------ |
| `o13-sales-vi.png` | `/marketing` | 200 |
| `o13-sales-en.png` | `/marketing/en` | 200 |
| `o13-privacy.png` | `/marketing/privacy` | 200 |
| `o13-support.png` | `/marketing/support` | 200 |

Headless Playwright Chromium (không headed / không cliclick). SHA tip ghi trong commit kèm theo.
