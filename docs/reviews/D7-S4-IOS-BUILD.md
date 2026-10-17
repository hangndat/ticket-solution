# D7-S4 — Local iOS build evidence (#117)

**Ngày:** 2026-10-17  
**Story:** [#115](https://github.com/hangndat/ticket-solution/issues/115) · **Task:** [#117](https://github.com/hangndat/ticket-solution/issues/117)  
**Epic:** [#103](https://github.com/hangndat/ticket-solution/issues/103)  
**PR:** [#190](https://github.com/hangndat/ticket-solution/pull/190)

## Policy

- **Local only:** Expo prebuild + `xcodebuild` (no EAS Cloud Build, no store submit).
- **Team:** `BLUA62D52G` (Hang Nguyen Dat — personal Developer Program).
- **Bundle ID:** `com.hangndat.ticket` (Vemoki).

## Exact D7 SHA (not D6)

| Tree | Exact SHA |
| --- | --- |
| Branch tip after evidence push (`hangndat/d7-milestone`) | `c8606fe59a8e5771aac79c420736960781d3ee3a` |
| Prior FAIL doc cited D6 native tree | `31490627…` — **superseded** |
| Server/main runtime used with this `.app` | `f7c88ffd6f936b6da56aa8cea8451f3ae889c278` |

## Commands

```bash
cd /Users/admin/orca/workspaces/ticket-solution/d7-milestone/apps/mobile

# ios/ already present from local expo prebuild (gitignored); Team from app.config.ts
# appleTeamId: BLUA62D52G

xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=F191CF59-4B73-44E5-BFA8-4CE439EB31AD' \
  -derivedDataPath /tmp/d7-s4-DerivedData-d7sha \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
# → ** BUILD SUCCEEDED **
```

Full host log: `/tmp/d7-s4-xcodebuild-d7.log`  
Excerpt committed: [`d7-s4/xcodebuild-d7-excerpt.log`](./d7-s4/xcodebuild-d7-excerpt.log)

### JS bundle same D7 tree (UAT)

```bash
pnpm exec expo export --platform ios --output-dir /tmp/d7-s4-expo-export --clear
# embed entry-*.hbc → Vemoki.app/main.jsbundle + codesign
```

Native binary from `/tmp/d7-s4-DerivedData-d7sha/.../Vemoki.app` (or prior embed DerivedData) + HBC from the same D7 mobile sources used for #116 sim-uat.

## Result

| Field | Value |
| --- | --- |
| Verdict | **BUILD SUCCEEDED** |
| `DEVELOPMENT_TEAM` (pbxproj + xcodebuild env) | `BLUA62D52G` |
| Product | `/tmp/d7-s4-DerivedData-d7sha/Build/Products/Debug-iphonesimulator/Vemoki.app` |
| EAS Cloud | **not used** |
| Store / TestFlight | **not performed** |

## Related

- UAT: [D7-S4-UAT.md](./D7-S4-UAT.md)
- Deploy: [D7-S4-DEPLOY-PROD.md](./D7-S4-DEPLOY-PROD.md) — skip
