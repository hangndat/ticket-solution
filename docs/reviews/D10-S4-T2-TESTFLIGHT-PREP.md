# D10-S4-T2 — TestFlight internal prep (local toolchain)

| Field | Value |
| --- | --- |
| Issue | [#162](https://github.com/hangndat/ticket-solution/issues/162) |
| Parent | Story [#160](https://github.com/hangndat/ticket-solution/issues/160) → Epic [#150](https://github.com/hangndat/ticket-solution/issues/150) |
| Dependency | Archive evidence [#161](https://github.com/hangndat/ticket-solution/issues/161) (Song song — **không block forever**; ghi gap nếu archive chưa sẵn) |
| Ownership | `apps/mobile` + `docs/reviews` · Role `ios` |
| Team | `BLUA62D52G` (Hang Nguyen Dat — personal) |
| Bundle / product | `com.hangndat.ticket` · **Vemoki** |
| Version / build (source) | `0.1.0` / `buildNumber` **`9`** (`apps/mobile/app.config.ts`) |
| Source tip (branch base / main tại lúc viết) | `f4e079d8266d8ad56af9411d92ea4ed03390becc` |
| Implementer | Orca Cursor worker · Role `ios` · dispatch `ctx_7207821f78a7` |
| EAS Cloud Build | **Không dùng** (cấm dự án) |
| App Store production submit | **Không làm** (ngoài scope #162) |
| TestFlight upload từ task này | **Không** — xem § Gaps |

## Mục tiêu

Chuẩn bị checklist + lệnh local (Xcode / `xcodebuild` / `xcrun altool` hoặc notary tooling) để đóng gói IPA và upload **TestFlight Internal** khi đủ credential + archive. Prep only trong task này nếu thiếu key/issuer/profile hoặc chưa có `.xcarchive` Vemoki từ #161.

## Đã xác minh trên máy (2026-10-17)

| Check | Result |
| --- | --- |
| Xcode | 26.5 (Build 17F42) |
| Distribution identity personal | Present: `Apple Distribution: Hang Nguyen Dat (BLUA62D52G)` |
| Development identity personal | Present: `Apple Development: Hang Nguyen Dat (Y4PU2PH48G)` |
| Company identities on Mac | Present nhưng **không dùng** cho Vemoki (`SCHMELER ERUNG` / `3WHS6JDYV2`) |
| ASC AuthKey file | Present: `~/.appstoreconnect/private_keys/AuthKey_MJB7GJ58YL.p8` (Key ID `MJB7GJ58YL` từ tên file) |
| ASC Issuer ID env | **Unset** (`APP_STORE_CONNECT_API_ISSUER_ID` / `ASC_ISSUER_ID`) |
| ASC Key ID env | **Unset** (có thể set `APP_STORE_CONNECT_API_KEY_ID=MJB7GJ58YL` từ tên file) |
| Transporter.app | Missing (dùng `xcrun altool` / Xcode Organizer thay thế) |
| Provisioning Profiles (local) | Chỉ thấy profile **company** `com.dexter292.bricksbreaker` / team `3WHS6JDYV2` — **không** có App Store profile `BLUA62D52G.com.hangndat.ticket` |
| Local Xcode Archives | `2026-10-15` chỉ có **Paddleflare** (company) — **không** có archive Vemoki trên máy lúc kiểm tra |
| Sibling #161 worktree | Branch `hangndat/d10-ios-archive-161` · Project Status `Đang làm` · chưa có `docs/reviews/D10-S4-T1-*` evidence lúc viết |
| `apps/mobile` tip identity | `appleTeamId: BLUA62D52G` · `buildNumber: '9'` · README ghi TF line `0.1.0 (9)` |

## Gaps (chặn upload; không chặn docs prep)

1. **ASC Issuer ID** chưa cấu hình trên shell/env → không gọi `altool`/`asc` API an toàn từ worker này.
2. **App Store / Ad Hoc provisioning** cho `com.hangndat.ticket` + team `BLUA62D52G` chưa có trong `~/Library/MobileDevice/Provisioning Profiles`.
3. **Archive #161** chưa bàn giao `.xcarchive` / IPA / evidence path — dependency ghi rõ; operator lấy artifact từ #161 khi sẵn sàng (không chờ vô hạn trong task này).
4. **Không upload** trong #162 vì (1)+(2)+(3); Issue chấp nhận prep checklist khi credential/archive chưa đủ.

Không commit: `.p8`, `.p12`, provisioning profiles, Issuer secret, mật khẩu ASC.

## Checklist operator (TestFlight Internal)

### A. Trước prebuild / Archive

- [ ] Xcode team chọn **`BLUA62D52G`** (không `3WHS6JDYV2`)
- [ ] App ID `com.hangndat.ticket` trên Apple Developer: Push Notifications + capabilities khớp `app.config.ts`
- [ ] Tạo/refresh **App Store** distribution provisioning profile cho bundle trên team personal; cài vào máy
- [ ] Đặt Issuer ID (ASC → Users and Access → Keys) vào env local **không git**:
  - `export APP_STORE_CONNECT_API_KEY_ID=MJB7GJ58YL`
  - `export APP_STORE_CONNECT_API_ISSUER_ID=<issuer-uuid>`
  - `export APP_STORE_CONNECT_API_KEY_PATH=$HOME/.appstoreconnect/private_keys/AuthKey_MJB7GJ58YL.p8`
- [ ] Confirm `#161` archive PASS hoặc tự archive theo § Commands
- [ ] `APS_ENVIRONMENT=production` (hoặc `APP_VARIANT=production`) trước `expo prebuild` để `aps-environment=production`
- [ ] Metadata ASC đã prep (`docs/asc/*`, #151–#159) — paste UI riêng; không coi docs = submitted

### B. Export → Upload → Internal group

- [ ] Export IPA `method=app-store` với `teamID=BLUA62D52G`
- [ ] Upload IPA (altool / Organizer) — **không** EAS Cloud
- [ ] ASC → TestFlight → build processing xanh
- [ ] Gán **Internal Testing** group; ghi build number + link ASC (che secret)
- [ ] **Không** Submit for App Store Review từ task này

### C. Sau upload (điền khi làm thật)

| Field | Value |
| --- | --- |
| Build number uploaded | *chưa — không upload trong #162* |
| ASC TestFlight URL | *chưa* |
| Internal group | *chưa* |
| Processing status | *N/A* |

## Commands (local only — copy/paste)

Cwd mặc định: `apps/mobile`. Generated `ios/` gitignored.

### 1) Prebuild + pods (Release / production APS)

```bash
cd apps/mobile
APS_ENVIRONMENT=production CI=1 pnpm exec expo prebuild --platform ios --clean
cd ios && pod install && cd ..
# Verify team in generated project (expect BLUA62D52G):
rg "DEVELOPMENT_TEAM" ios/*.xcodeproj/project.pbxproj | head
```

### 2) Archive (xcodebuild) — Team personal

```bash
cd apps/mobile
mkdir -p .expo/tf-prep
xcodebuild archive \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$PWD/.expo/tf-prep/Vemoki.xcarchive" \
  DEVELOPMENT_TEAM=BLUA62D52G \
  CODE_SIGN_STYLE=Automatic
# Prefer Coordinating with #161: reuse that archive path if evidence already records one.
```

### 3) ExportOptions.plist (máy local — **không** commit file có secret)

Tạo `apps/mobile/.expo/tf-prep/ExportOptions.plist` (gitignored dưới `.expo/`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>BLUA62D52G</string>
  <key>uploadSymbols</key>
  <true/>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>destination</key>
  <string>export</string>
</dict>
</plist>
```

```bash
xcodebuild -exportArchive \
  -archivePath "$PWD/.expo/tf-prep/Vemoki.xcarchive" \
  -exportPath "$PWD/.expo/tf-prep/ipa" \
  -exportOptionsPlist "$PWD/.expo/tf-prep/ExportOptions.plist"
```

### 4) Upload IPA → App Store Connect (khi Issuer + profile sẵn)

```bash
# Env: APP_STORE_CONNECT_API_KEY_ID / ISSUER_ID / KEY_PATH (xem checklist)
xcrun altool --upload-app \
  --type ios \
  --file "$PWD/.expo/tf-prep/ipa/Vemoki.ipa" \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"
```

Hoặc: Xcode → Organizer → Distribute App → App Store Connect → Upload (team `BLUA62D52G`).

### 5) Xác nhận trên ASC (thủ công)

1. [App Store Connect](https://appstoreconnect.apple.com) → Apps → **Vemoki** → TestFlight  
2. Chờ Processing → Missing Compliance nếu hỏi (ITSAppUsesNonExemptEncryption=false trong config)  
3. Internal Testing → add build → notify testers  
4. Ghi build number + URL vào comment Issue #162 (che API key)

## Liên kết evidence liên quan

| Artifact | Vai trò |
| --- | --- |
| [#161](https://github.com/hangndat/ticket-solution/issues/161) / tương lai `docs/reviews/D10-S4-T1-*` | Archive local PASS — input IPA/xcarchive |
| [D10-ASC-S1-S3-METADATA.md](./D10-ASC-S1-S3-METADATA.md) + `docs/asc/*` | Listing / privacy / review notes (prep, chưa submit) |
| [D9-S4-T2-IOS-LOCAL-BUILD.md](./D9-S4-T2-IOS-LOCAL-BUILD.md) | Simulator Debug local — **không** thay Archive/TF |
| [D5-PR-201-DOD.md](./D5-PR-201-DOD.md) | Prior TF `buildNumber` 9 trên source |
| `apps/mobile/README.md` | Signing table + TF line `0.1.0 (9)` |

## Claim boundary

| Claim | Status |
| --- | --- |
| Prep checklist + exact commands documented | **YES** (this file) |
| Local toolchain verified (Xcode, personal Distribution cert, AuthKey file present) | **YES** |
| TestFlight IPA uploaded in #162 | **NO** |
| Internal testers notified | **NO** |
| App Store production submit | **NO** |
| EAS Cloud Build used | **NO** |

## Exact SHA

- **Base / evidence source tip:** `f4e079d8266d8ad56af9411d92ea4ed03390becc` (`origin/main` lúc branch)
- **Tip commit của PR docs này:** điền sau `git rev-parse HEAD` khi commit (PR template + Issue comment)
