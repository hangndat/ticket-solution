# D8-S4-T2 — iOS local build evidence

**Issue:** [#132](https://github.com/hangndat/ticket-solution/issues/132) · Story [#130](https://github.com/hangndat/ticket-solution/issues/130) · Epic [#119](https://github.com/hangndat/ticket-solution/issues/119)  
**Ownership:** `apps/mobile` (local native build only) · Team `BLUA62D52G` · **không** EAS Cloud Build  
**Source tip (main tại lúc build):** `f60b64383e5ae70bdb73d14c6b05c1e8dacb4393`  
**Xcode:** 26.5 (Build 17F42)  
**Bundle:** `com.hangndat.ticket` · app name `Vemoki` · buildNumber `9` · version `0.1.0`  
**Ngày build (UTC):** 2026-10-17T15:53:58Z

## Mục tiêu

Thu evidence milestone D8: local `expo prebuild` + `xcodebuild` simulator Debug. Không store submit; không upload signing/source lên Expo EAS Cloud.

## Commands (cwd: `apps/mobile`)

```bash
# 1) Prebuild native iOS (generated ios/ is gitignored)
CI=1 pnpm exec expo prebuild --platform ios --no-install
# → ✔ Finished prebuild · log: .expo/d8-s4-t2-prebuild.log

# 2) CocoaPods
cd ios && pod install
# → 119 Podfile deps / 118 pods · workspace Vemoki.xcworkspace
# → log: .expo/d8-s4-t2-pod-install.log

# 3) Local xcodebuild (simulator, unsigned — CODE_SIGNING_ALLOWED=NO)
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .expo/d8-s4-t2-derived-data \
  CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
# → ** BUILD SUCCEEDED ** (exit 0)
# → log: .expo/d8-s4-t2-xcodebuild.log (machine-local, gitignored)
```

## Excerpt — BUILD SUCCEEDED

Từ `apps/mobile/.expo/d8-s4-t2-xcodebuild.log` (cuối log, exit 0):

```text
** BUILD SUCCEEDED **
```

Lệnh xcodebuild đã truyền `DEVELOPMENT_TEAM=BLUA62D52G` (dòng invoke trong cùng log).

## Excerpt — DEVELOPMENT_TEAM

Sau prebuild, `ios/Vemoki.xcodeproj/project.pbxproj` (gitignored):

```text
DEVELOPMENT_TEAM = BLUA62D52G;
```

Nguồn cấu hình: `apps/mobile/app.config.ts` → `ios.appleTeamId: 'BLUA62D52G'`.

## Kết quả

| Check | Result |
| --- | --- |
| `expo prebuild --platform ios` | PASS (`✔ Finished prebuild`) |
| `pod install` | PASS (119 deps / 118 pods) |
| `xcodebuild` … `BUILD SUCCEEDED` | PASS, exit 0 |
| `DEVELOPMENT_TEAM` in generated `project.pbxproj` | `BLUA62D52G` |
| Product binary | `.expo/d8-s4-t2-derived-data/Build/Products/Debug-iphonesimulator/Vemoki.app` |
| `CFBundleIdentifier` | `com.hangndat.ticket` |
| EAS Cloud Build | **không dùng** |

## Giới hạn (không phải FAIL)

- Binary là **simulator Debug** unsigned (`CODE_SIGNING_ALLOWED=NO`) — đủ evidence compile/link local; **không** phải device/Archive/TestFlight.
- `DEVELOPMENT_TEAM=BLUA62D52G` được truyền vào xcodebuild và có trong pbxproj sau prebuild; không chạy codesign device với Distribution cert trong task này.
- Không store submit; không deploy prod; không re-run headless UAT trong task này.
- Log/derived data nằm dưới `apps/mobile/.expo/` (gitignored) trên máy build.

## Không làm

- EAS Cloud Build / cloud fallback
- Upload signing material lên Expo
- Sửa BE/web
- App Store Connect submit
- Merge PR (coordinator / DoD sau)
