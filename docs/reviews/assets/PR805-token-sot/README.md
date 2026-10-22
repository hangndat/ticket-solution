# PR #805 — token SoT visual evidence (fix lượt 1/2)

**SHA (after):** tip branch sau commit fix F01 (xem `css-var-probe.json`).  
**Before:** `origin/main` — worktree `main` @ port 3001 hoặc file `before-*` trong thư mục này.  
**After:** branch `hangndat/uif-795-token-sot`, `pnpm exec next start -p 3000` trên worktree PR.

| File | Route | Viewport | State |
| --- | --- | --- | --- |
| `before-marketing-home-1280.png` | `/marketing` | 1280×900 | main |
| `before-marketing-home-390.png` | `/marketing` | 390×844 | main |
| `after-marketing-home-1280.png` | `/marketing` | 1280×900 | PR |
| `after-marketing-home-390.png` | `/marketing` | 390×844 | PR |
| `before-catalog-1280.png` | `/` | 1280×900 | main (catalog) |
| `after-catalog-1280.png` | `/` | 1280×900 | PR |
| `before-wallet-1280.png` | `/wallet` | 1280×900 | main |
| `after-wallet-1280.png` | `/wallet` | 1280×900 | PR |

**Probe:** `css-var-probe.json` — `:root --line` / `--color-line` = `#D7DFE9`, `--space-4` = `16px` sau fix legacy contract.

Chụp lại after: `WEB_BASE_URL=http://127.0.0.1:3000 EVIDENCE_SHA=$(git rev-parse HEAD) node capture-after.mjs`  
Kiểm tra: `bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR805-token-sot`
