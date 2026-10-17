# D10-S4-T1 — Archive local (xcodebuild) team BLUA62D52G

**Issue:** [#161](https://github.com/hangndat/ticket-solution/issues/161) · Story [#160](https://github.com/hangndat/ticket-solution/issues/160) · Epic [#150](https://github.com/hangndat/ticket-solution/issues/150)  
**Ownership:** `apps/mobile` (local native archive only) · Team `BLUA62D52G` · **không** EAS Cloud Build  
**Source tip (main tại lúc archive):** `f4e079d8266d8ad56af9411d92ea4ed03390becc`  
**Branch:** `hangndat/d10-ios-archive-161`  
**Xcode:** 26.5 (Build 17F42)  
**Bundle:** `com.hangndat.ticket` · app name `Vemoki` · version `0.1.0` · buildNumber `9`

## Mục tiêu

Thu evidence local `expo prebuild` + `xcodebuild archive` cho Vemoki với Team personal **BLUA62D52G** only. Không store submit; không TestFlight upload trong task này; không upload signing/source lên Expo EAS Cloud.

## Commands (cwd: `apps/mobile`)

```bash
# 0) Source tip
git rev-parse HEAD
# → f4e079d8266d8ad56af9411d92ea4ed03390becc

# 1) Prebuild native iOS (generated ios/ is gitignored)
export APS_ENVIRONMENT=production APP_VARIANT=production EXPO_PUBLIC_APS_ENVIRONMENT=production
CI=1 pnpm exec expo prebuild --platform ios --no-install
# → ✔ Finished prebuild · log: .expo/d10-s4-t1-prebuild.log
# → DEVELOPMENT_TEAM = BLUA62D52G in ios/Vemoki.xcodeproj/project.pbxproj (Debug + Release)

# 2) CocoaPods
cd ios && pod install && cd ..
# → 119 Podfile deps / 118 pods · workspace Vemoki.xcworkspace
# → log: .expo/d10-s4-t1-pod-install.log

# 3) Local xcodebuild archive (device arm64, Automatic signing, personal team)
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath .expo/archives/Vemoki-D10-S4-T1.xcarchive \
  -derivedDataPath .expo/d10-s4-t1-archive-derived \
  DEVELOPMENT_TEAM=BLUA62D52G \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY='Apple Development' \
  archive
# → ** ARCHIVE SUCCEEDED ** (exit 0)
# → log: .expo/d10-s4-t1-xcodebuild-archive.log (machine-local, gitignored)
```

> Ghi chú: lần thử đầu với `CODE_SIGN_IDENTITY='Apple Distribution'` thất bại vì Expo project đang Automatic → Development; đổi sang `Apple Development` (Hang Nguyen Dat) thì archive thành công. Identity vẫn thuộc personal team `BLUA62D52G`, không phải company `3WHS6JDYV2`.

## Kết quả

| Check | Result |
| --- | --- |
| `expo prebuild --platform ios` | PASS |
| `pod install` | PASS |
| `xcodebuild … archive` → `ARCHIVE SUCCEEDED` | PASS, exit 0 |
| `DEVELOPMENT_TEAM` (pbxproj + xcodebuild) | `BLUA62D52G` |
| Archive `Info.plist` → `Team` | `BLUA62D52G` |
| Archive `SigningIdentity` | `Apple Development: Hang Nguyen Dat (Y4PU2PH48G)` |
| `codesign` → `TeamIdentifier` | `BLUA62D52G` |
| Bundle ID | `com.hangndat.ticket` |
| Architectures | `arm64` (iphoneos Release) |
| Company team `3WHS6JDYV2` / SCHMELER | **không xuất hiện** trong archive log |
| EAS Cloud Build | **không dùng** |

### Archive path (local, gitignored)

```text
apps/mobile/.expo/archives/Vemoki-D10-S4-T1.xcarchive
```

### Log excerpt

```text
Signing Identity:     "Apple Development: Hang Nguyen Dat (Y4PU2PH48G)"
Provisioning Profile: "iOS Team Provisioning Profile: com.hangndat.ticket"
** ARCHIVE SUCCEEDED **
```

`xcarchive/Info.plist` (ApplicationProperties):

| Key | Value |
| --- | --- |
| CFBundleIdentifier | `com.hangndat.ticket` |
| CFBundleShortVersionString | `0.1.0` |
| CFBundleVersion | `9` |
| SigningIdentity | `Apple Development: Hang Nguyen Dat (Y4PU2PH48G)` |
| Team | `BLUA62D52G` |

## Giới hạn (không phải FAIL)

- Archive ký bằng **Apple Development** (Automatic) dưới team `BLUA62D52G` — đủ evidence local archive + đúng team; **không** export `.ipa` / upload TestFlight / App Store Connect trong task này (Story T2 / submit riêng).
- `Apple Distribution` + Automatic bị Xcode từ chối trên project Expo (conflict development vs distribution identity); không ép Manual signing trong task evidence-only.
- Log / derived data / `.xcarchive` nằm dưới `apps/mobile/.expo/` (gitignored) trên máy build — không commit secrets, certs, `.p12`, provisioning profiles.
- `ios/` generated sau prebuild — không commit vào git.

## Không làm

- EAS Cloud Build / cloud fallback
- Upload signing material lên Expo
- Sửa `apps/api` / `apps/web` / backend packages
- App Store Connect submit / TestFlight upload
- Merge PR / spawn nested DoD reviewer (coordinator ownership)
