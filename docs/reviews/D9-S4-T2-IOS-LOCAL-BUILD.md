# D9-S4-T2 — iOS local build evidence

**Issue:** [#148](https://github.com/hangndat/ticket-solution/issues/148) · Story [#146](https://github.com/hangndat/ticket-solution/issues/146) · Epic [#134](https://github.com/hangndat/ticket-solution/issues/134)  
**Ownership:** `apps/mobile` (local native build only) · Team `BLUA62D52G` · **không** EAS Cloud Build  
**Source tip (main tại lúc build):** `86be8ef5fc88d558d14d2adb0c122f0c1632c8fb`  
**Xcode:** 26.5 (Build 17F42)  
**Bundle:** `com.hangndat.ticket` · app name `Vemoki` · buildNumber `8`

## Mục tiêu

Thu evidence milestone: local `expo prebuild` + `xcodebuild` simulator Debug. Không store submit; không upload signing/source lên Expo EAS Cloud.

## Commands (cwd: `apps/mobile`)

```bash
# 1) Prebuild native iOS (generated ios/ is gitignored)
CI=1 pnpm exec expo prebuild --platform ios --no-install
# → ✔ Finished prebuild · log: .expo/d9-s4-t2-prebuild.log

# 2) CocoaPods
cd ios && pod install
# → 119 Podfile deps / 118 pods · workspace Vemoki.xcworkspace
# → log: .expo/d9-s4-t2-pod-install.log

# 3) Local xcodebuild (simulator, unsigned — CODE_SIGNING_ALLOWED=NO)
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .expo/d9-s4-t2-derived-data \
  CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
# → ** BUILD SUCCEEDED ** (exit 0)
# → log: .expo/d9-s4-t2-xcodebuild.log (machine-local, gitignored)
```

## Kết quả

| Check | Result |
| --- | --- |
| `expo prebuild --platform ios` | PASS |
| `pod install` | PASS |
| `xcodebuild` … `BUILD SUCCEEDED` | PASS, exit 0 |
| `DEVELOPMENT_TEAM` in generated `project.pbxproj` | `BLUA62D52G` |
| Product binary | `.expo/d9-s4-t2-derived-data/Build/Products/Debug-iphonesimulator/Vemoki.app` |
| `CFBundleIdentifier` | `com.hangndat.ticket` |
| EAS Cloud Build | **không dùng** |

## Giới hạn (không phải FAIL)

- Binary là **simulator Debug** unsigned (`CODE_SIGNING_ALLOWED=NO`) — đủ evidence compile/link local; **không** phải device/Archive/TestFlight.
- `DEVELOPMENT_TEAM=BLUA62D52G` được truyền vào xcodebuild và có trong pbxproj sau prebuild; không chạy codesign device với Distribution cert trong task này.
- Không store submit; không deploy prod (#149); không re-run UAT #147.
- Log/derived data nằm dưới `apps/mobile/.expo/` (gitignored) trên máy build.

## Không làm

- EAS Cloud Build / cloud fallback
- Upload signing material lên Expo
- Sửa BE/web
- App Store Connect submit
