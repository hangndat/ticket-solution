# UAT — Issue #813 (WP-2b shadcn Sheet mobile nav)

| Trường | Giá trị |
| --- | --- |
| **SHA** | `f71f9a5c8e2f1b0e9a4d6c7b8a1e2f3d4c5b6a7` _(replace with `git rev-parse HEAD` on branch tip)_ |
| **Server** | `pnpm --filter @ticket/web build && pnpm --filter @ticket/web start --port 3013` |
| **Browser** | Orca embedded `orca tab create` + `orca exec --page …` |
| **Artifacts** | `docs/reviews/assets/PR813/*.png` |

## Viewports / routes

| File | Route | Viewport | State |
| --- | --- | --- | --- |
| `marketing-vi-mobile-390-menu-closed.png` | `/marketing` | 390×844 | menu đóng |
| `marketing-vi-mobile-390-menu-open.png` | `/marketing` | 390×844 | menu mở (Sheet) |
| `marketing-en-mobile-390-menu-closed.png` | `/marketing/en` | 390×844 | menu đóng |
| `marketing-en-mobile-390-menu-open.png` | `/marketing/en` | 390×844 | menu mở |
| `marketing-vi-desktop-1280-menu-closed.png` | `/marketing` | 1280×900 | desktop chrome |
| `attendee-vi-mobile-390-menu-closed.png` | `/` | 390×844 | menu đóng |
| `attendee-vi-mobile-390-menu-open.png` | `/` | 390×844 | menu mở |
| `attendee-vi-desktop-1280-menu-closed.png` | `/` | 1280×900 | desktop chrome |

## Lệnh Orca (mẫu)

```text
orca tab create --url http://127.0.0.1:3013/marketing --worktree path:<worktree> --json
orca exec --page <id> --command "set viewport 390 844"
orca exec --page <id> --command 'click [data-testid="mkt-nav-menu-toggle"]'
orca exec --page <id> --command "screenshot docs/reviews/assets/PR813/marketing-vi-mobile-390-menu-open.png"
```
