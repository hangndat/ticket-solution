# D7-S4 — Local iOS build evidence (#117)

**Ngày:** 2026-10-17  
**Story:** [#115](https://github.com/hangndat/ticket-solution/issues/115) · **Task:** [#117](https://github.com/hangndat/ticket-solution/issues/117)  
**Epic:** [#103](https://github.com/hangndat/ticket-solution/issues/103)

## Policy

- **Local only:** Expo prebuild + Xcode/`xcodebuild` (no EAS Cloud Build, no store submit).
- **Team:** `BLUA62D52G` (Hang Nguyen Dat — personal Developer Program).
- **Bundle ID:** `com.hangndat.ticket` (Vemoki).

## Command run

```bash
cd /Users/admin/orca/workspaces/ticket-solution/d6-ios/apps/mobile/ios

xcodebuild \
  -workspace Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=F191CF59-4B73-44E5-BFA8-4CE439EB31AD' \
  -derivedDataPath /tmp/d7-s4-DerivedData \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
```

Full log (host): `/tmp/d7-s4-xcodebuild.log`  
Excerpt: [`d7-s4/xcodebuild-excerpt.md`](./d7-s4/xcodebuild-excerpt.md)

## Result

| Field | Value |
| --- | --- |
| Verdict | **BUILD SUCCEEDED** |
| `DEVELOPMENT_TEAM` (pbxproj + env) | `BLUA62D52G` |
| Signing (sim Debug) | Sign to Run Locally |
| Product | `/tmp/d7-s4-DerivedData/Build/Products/Debug-iphonesimulator/Vemoki.app` |
| EAS Cloud | **not used** |
| Store / TestFlight upload | **not performed** |

## Trees / SHAs

| Tree | Role | Exact SHA |
| --- | --- | --- |
| `d6-ios` worktree (native `ios/` used for this build) | local Expo prebuild + Xcode project | `31490627df2bafbd6ba654b808afd4484f1900fa` |
| `origin/main` tip at gate | D7 JS offline queue already merged | `d6f53624ca8d5cd5410bf75ac614748eba1d7971` |
| iOS offline queue merge | PR [#178](https://github.com/hangndat/ticket-solution/pull/178) | `0c8bcdf7846703628f6abbf98c4c06c896fb3aac` |

## Gaps

1. Native `ios/` directory for this xcodebuild came from the `d6-ios` worktree (gitignored generated tree already present with Team `BLUA62D52G`). JS offline-queue acceptance is covered under [#116](./D7-S4-UAT.md) unit + sim-uat, not re-bundled into this `.app` in the same command.
2. Device / Archive / App Store distribution **out of scope** for this Task (D10 owns archive/TestFlight prep).

## Related

- UAT: [D7-S4-UAT.md](./D7-S4-UAT.md)
- Deploy: [D7-S4-DEPLOY-PROD.md](./D7-S4-DEPLOY-PROD.md)
