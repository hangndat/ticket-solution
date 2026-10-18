# D6 UX/UI — curated headless UAT screenshots

Evidence for parent Issue [#81](https://github.com/hangndat/ticket-solution/issues/81) (D6 UX/UI).  
Tracked copies of gitignored `.uat-artifacts` from web/iOS worktrees. **Not** device/TestFlight UAT; **not** pilot ready.

## Capture SHAs

| Surface | PR | Tip SHA (feature branch) | Merge commit on `main` |
| --- | --- | --- | --- |
| Web | [#92](https://github.com/hangndat/ticket-solution/pull/92) | `613518a631ff5f477f48359b6dbd143477d454e1` (`hangndat/d6-web` tip when UX landed; final tip `ec8eac6180c150d96bcc02d0a0242b0c1bd13501`) | `eb0d0784f300571dc7a557c0db3ecd865c4e9cfe` |
| iOS | [#93](https://github.com/hangndat/ticket-solution/pull/93) | `a3eabf248a4187026df59c4d5725de018ab4b565` | `b93124b58eb1740d263fc5191ddd9a9aad4506f6` |

Screenshots regenerated 2026-10-17 (headless) against local worktrees that include the merged D6 UX + gap-fix commits:

- Web worktree `d6-web` HEAD: `0e5842c3b194e97fa37912d2b982fd00f0d771af`
- iOS worktree `d6-ios` HEAD: `31490627df2bafbd6ba654b808afd4484f1900fa`

## Commands used

```bash
# Web (Playwright headless — scripts/web-uat.sh)
scripts/web-uat.sh screenshot  # → apps/web/.uat-artifacts/d6-*.png

# iOS Simulator (AXe HID + simctl — scripts/sim-uat.sh; no cliclick)
scripts/sim-uat.sh screenshot  # → apps/mobile/.uat-artifacts/d6-*.png
```

## Layout

- `web/` — home, redeem, gate, admin, account, event
- `ios/` — events, my-tickets, ticket-detail, redeem, staff-scan

See also:

- [d6-web-uat-notes.md](../d6-web-uat-notes.md)
- [d6-ios-uat-notes.md](../d6-ios-uat-notes.md)
