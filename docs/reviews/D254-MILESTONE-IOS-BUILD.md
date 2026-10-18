# Epic #254 — Milestone gate (b): Local iOS build + published Events sim smoke

**Issue:** [#283](https://github.com/hangndat/ticket-solution/issues/283) · Epic [#254](https://github.com/hangndat/ticket-solution/issues/254)  
**Ownership:** `apps/mobile` (local native build + headless sim smoke) · Team `BLUA62D52G` · **không** EAS Cloud Build  
**Role:** `ios` (`docs/agents/roles/ios.md`) · Agent: cursor · Architecture impact: Không  
**Source tip (`main` tại lúc build):** `7923004af65131d7033a8556d39a214122fa59cf`  
**Xcode:** 26.5 (Build 17F42)  
**Bundle:** `com.hangndat.ticket` · app name `Vemoki` · buildNumber `9` · `appleTeamId` `BLUA62D52G`  
**Simulator:** iPhone 17 · UDID `0F1CAFB0-A392-4591-A93D-A0F5F5E81E1A` (boot via `sim-uat` / simctl — **không** `open -a Simulator`)  
**Ngày (local):** 2026-10-18

## Mục tiêu

Thu evidence Milestone DoD gate (b) + smoke headless Events **published-first / fail-closed** (ADR-19 / #257). Không store submit; không EAS Cloud Build; không trùng full matrix #236.

## Commands (cwd: `apps/mobile` trừ khi ghi khác)

```bash
# Tip
git rev-parse HEAD
# → 7923004af65131d7033a8556d39a214122fa59cf

# 1) Prebuild native iOS (generated ios/ gitignored)
CI=1 pnpm exec expo prebuild --platform ios --no-install
# → ✔ Finished prebuild · log: .expo/d254-283-prebuild.log
# → DEVELOPMENT_TEAM = BLUA62D52G (Debug + Release) trong ios/Vemoki.xcodeproj/project.pbxproj

# 2) CocoaPods
cd ios && pod install
# → exit 0 · log: .expo/d254-283-pod-install.log

# 3a) Local xcodebuild Debug simulator (compile/link evidence)
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .expo/d254-283-derived-data \
  CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
# → ** BUILD SUCCEEDED ** (exit 0)
# → log: .expo/d254-283-xcodebuild.log
# → product: .expo/d254-283-derived-data/Build/Products/Debug-iphonesimulator/Vemoki.app
# → CFBundleIdentifier: com.hangndat.ticket

# 3b) Local xcodebuild Release simulator (embedded main.jsbundle for headless smoke)
env -u EXPO_PUBLIC_API_BASE_URL \
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .expo/d254-283-derived-data-release \
  CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
# → ** BUILD SUCCEEDED ** (exit 0)
# → log: .expo/d254-283-xcodebuild-release.log
# → product includes main.jsbundle

# 4) Unit (published fail-closed helpers)
pnpm --filter @ticket/mobile test
# → 207 pass / 0 fail · log: .expo/d254-283-unit-test.log

# 5) Headless sim smoke (AXe + simctl — không Simulator.app / không mouse desktop)
SIM=0F1CAFB0-A392-4591-A93D-A0F5F5E81E1A
OUT=apps/mobile/.uat-artifacts/d254-283
../../scripts/sim-uat.sh boot "$SIM"
xcrun simctl install "$SIM" .expo/d254-283-derived-data-release/Build/Products/Release-iphonesimulator/Vemoki.app
../../scripts/sim-uat.sh launch com.hangndat.ticket "$SIM"
../../scripts/sim-uat.sh screenshot "$SIM" "$OUT/03-events-fail-closed.png"
../../scripts/sim-uat.sh describe "$SIM" > "$OUT/02-release-cold-ui.txt"
```

## Kết quả

| Check | Result |
| --- | --- |
| Tip SHA | `7923004af65131d7033a8556d39a214122fa59cf` (= `origin/main` lúc chạy) |
| `expo prebuild --platform ios` | PASS |
| `pod install` | PASS |
| `xcodebuild` Debug … `BUILD SUCCEEDED` | PASS, exit 0 |
| `xcodebuild` Release … `BUILD SUCCEEDED` + `main.jsbundle` | PASS, exit 0 |
| `DEVELOPMENT_TEAM` / `appleTeamId` | `BLUA62D52G` only (pbxproj + `app.config.ts`) |
| Company team `3WHS6JDYV2` | **không dùng** |
| EAS Cloud Build | **không dùng** (không `eas build`) |
| Unit `@ticket/mobile` | **207 pass / 0 fail** |
| Headless sim Events published-first | PASS — a11y: «Danh sách lấy từ sự kiện đã xuất bản trên máy chủ» |
| Headless sim fail-closed (no API URL) | PASS — «Chưa cấu hình API» + «Không thay bằng catalog demo.» |
| Demo demoted (không SoT FlatList) | PASS — footer «Demo · dữ liệu mẫu (không phải nguồn đã xuất bản)» + fixture-only copy |
| Artifacts | `apps/mobile/.uat-artifacts/d254-283/` (gitignored) |

### A11y assert (Release cold launch, no `EXPO_PUBLIC_API_BASE_URL`)

Chuỗi bắt buộc có trong `02-release-cold-ui.txt`:

- `Chưa cấu hình API`
- `Không thay bằng catalog demo`
- `Danh sách lấy từ sự kiện đã xuất bản`
- `Demo · dữ liệu mẫu (không phải nguồn đã xuất bản)`

Không có `redbox-error`.

## Artifacts (máy local, gitignored)

| Path | Nội dung |
| --- | --- |
| `apps/mobile/.uat-artifacts/d254-283/03-events-fail-closed.png` | Events tab — fail-closed misconfigured |
| `apps/mobile/.uat-artifacts/d254-283/02-release-cold.png` | Cold launch screenshot |
| `apps/mobile/.uat-artifacts/d254-283/02-release-cold-ui.txt` | AXe describe-ui JSON |
| `apps/mobile/.expo/d254-283-*.log` | prebuild / pod / xcodebuild / unit |

## Giới hạn (không phải FAIL)

- Binary là **simulator** unsigned (`CODE_SIGNING_ALLOWED=NO`) — đủ compile/link + embedded JS smoke; **không** device/Archive/TestFlight/store submit.
- Smoke chạy **không** `EXPO_PUBLIC_API_BASE_URL` → path **misconfigured fail-closed** (đúng ADR-19: không silent demo SoT). Không chứng minh list published live từ API prod trong session này (không có API local :3001/:4000).
- Debug `.app` cần Metro (không embed JS); smoke dùng **Release** `.app` có `main.jsbundle`.
- Simulator riêng task (`iPhone 17` / `0F1CAFB0-…`); không đụng sim đang Booted của worker khác.
- Không deploy prod; không ASC submit; không full #236 matrix.

## Không làm

- EAS Cloud Build / cloud fallback / upload signing lên Expo
- Sửa BE / web / product code (chỉ evidence + prebuild generated `ios/` local)
- Store submit
