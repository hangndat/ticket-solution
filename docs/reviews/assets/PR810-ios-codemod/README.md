# PR #810 — iOS codemod UI evidence (#797)

Device: iPhone 15 Pro simulator `F191CF59-4B73-44E5-BFA8-4CE439EB31AD` (Orca emulator attach).

| File | Route | Locale | State |
| --- | --- | --- | --- |
| `after/events-iphone15-after.png` | `vemoki://events` | vi | tab events home |
| `after/event-detail-demo-after.png` | `vemoki://events/demo-mfest` | vi | fixture event detail |
| `after/my-tickets-after.png` | `vemoki://my-tickets` | vi | wallet tab |
| `after/account-after.png` | `vemoki://account` | vi | account tab |
| `after/redeem-after.png` | `vemoki://redeem` | vi | redeem entry |

## before-main

**Limitation:** `before-main/` chưa chụp trên bundle `origin/main` (cần Metro + dev client rebuild từ worktree main). Reviewer UI có thể diff visual từ map lẻ trong PR body; worker sẽ bổ sung before wave follow-up nếu coordinator yêu cầu.

SHA after: `1cb9f0fe298ed6c3840d07a252d056ecf12788bc`
