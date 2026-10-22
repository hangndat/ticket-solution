# PR #824 / #825 — Lighthouse mobile (390×844)

- **Tool:** Lighthouse `13.5.0`, `next start`, cùng máy reviewer.
- **Runs:** 3 lần/route, lấy **median** (script `apps/web/scripts/pr824-lighthouse-benchmark.mjs`).
- **Apex `/`:** header `x-forwarded-host: vemoki.com` (marketing host split).

## Median scores

| Route | Main `a64dcbfe` perf | Main a11y | PR tip perf | PR a11y | Δ perf | Δ a11y |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` (VI apex) | 77 | 94 | 70* | 100 | −7* | +6 |
| `/marketing` (VI) | 77 | 94 | 79 | 97 | +2 | +3 |
| `/marketing/en` (EN) | 78 | 97 | 79 | 100 | +1 | +3 |

\* `/` perf trên PR dao động mạnh giữa các lần chạy (69–88 trong cùng phiên); median batch đầu 70. **Luồng wave 1** so sánh chính trên `/marketing` và `/marketing/en` — không regression >3 perf, a11y tăng.

Raw JSON: `main-a64dcbfe-*.json`, `pr-tip-*.json`, `*-summary.json`.
