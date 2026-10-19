# Milestone gates (a)+(b) — iOS sim-uat + local xcodebuild · Epic #527

| Field | Value |
| --- | --- |
| Issue / Epic | [#527](https://github.com/hangndat/ticket-solution/issues/527) |
| Role | `ios` (`docs/agents/roles/ios.md`) · Agent cursor · Cost tier standard · Persona Zico |
| Worker session | `term_66d444e5-4b5d-48cb-a3c7-339a22d0bc87` · task `task_3c4fc4740f00` · dispatch `ctx_6c7e5d06982c` |
| Architecture impact | **Không** |
| Source tip SHA (exact, binary/UAT) | `ee95f0ee3f0da32cfaad0d4e741b54dd1685d6ae` |
| Evidence docs commit (exact) | `58464332aa88bbb0c9b2be3b4a6b7b4482e3b799` |
| Branch | `hangndat/ux-ui-p2-gates-ios-527` |
| Phase 2 iOS merge | PR [#535](https://github.com/hangndat/ticket-solution/pull/535) merge `be97ff5337d1ca6ca8af18ba90a695c03ecf4066` (headRefOid DoD `6dcd6998ed32a3648536421170ed8c033888db3c`) — on tip ancestry |
| Bundle | `com.hangndat.ticket` · app `Vemoki` · version `1.0.0` · buildNumber `12` |
| Team | `BLUA62D52G` (personal) |
| Xcode | 26.5 (Build 17F42) |
| Simulator | **Epic527-iOS-Gates** · UDID `4AD7F2DC-5533-4C66-875C-A430DF3C734C` · iPhone 17 / iOS 26.5 |
| EAS Cloud Build | **Không dùng** |
| Deploy / store | **Không** (ngoài ủy quyền) |

## Verdict

| Gate | Result | Notes |
| --- | --- | --- |
| (a) Headless iOS UAT | **PASS with known gap** | Screenshots Events / Account / event-detail / claim qua `scripts/sim-uat.sh` (AXe + simctl; không `open -a Simulator`, không cliclick). Gap: Release build không bake OIDC/`EXPO_PUBLIC_API_BASE_URL` → Account fail-closed «Chưa cấu hình đăng nhập»; Events misconfig API + demo catalog cục bộ; Claim «Cần đăng nhập» + chưa tải form (không API live). |
| (b) Local iOS build | **PASS** | `expo prebuild` + `pod install` + Release `xcodebuild` → `** BUILD SUCCEEDED **` · `DEVELOPMENT_TEAM=BLUA62D52G` |

## Commands & exit codes

Cwd gốc repo trừ khi ghi khác. Logs máy local (gitignored): `apps/mobile/.uat-artifacts/epic-527/`.

```bash
# 0) Identity
gh auth switch --user hangndat
# git user: hangndat <hangndat@gmail.com>
# tip: ee95f0ee3f0da32cfaad0d4e741b54dd1685d6ae

# 1) Deps
pnpm install --filter @ticket/mobile...
# exit 0 · log: apps/mobile/.uat-artifacts/epic-527/pnpm-install.log
pnpm --filter @ticket/contracts build
# exit 0 · log: apps/mobile/.uat-artifacts/epic-527/contracts-build.log

# 2) Simulator (headless — không open Simulator.app)
xcrun simctl create Epic527-iOS-Gates \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17 \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5
# → 4AD7F2DC-5533-4C66-875C-A430DF3C734C
scripts/sim-uat.sh boot 4AD7F2DC-5533-4C66-875C-A430DF3C734C
# exit 0 · log: apps/mobile/.uat-artifacts/epic-527/boot.log

# 3) Local native (cwd: apps/mobile)
CI=1 pnpm exec expo prebuild --platform ios --no-install
# exit 0 · ✔ Finished prebuild · log: .uat-artifacts/epic-527/prebuild.log
# pbxproj: DEVELOPMENT_TEAM = BLUA62D52G · PRODUCT_BUNDLE_IDENTIFIER = com.hangndat.ticket
cd ios && pod install
# exit 0 · Pod installation complete · log: ../.uat-artifacts/epic-527/pod-install.log

UDID=4AD7F2DC-5533-4C66-875C-A430DF3C734C
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "id=$UDID" \
  -derivedDataPath .uat-artifacts/epic-527/DerivedData-Release \
  CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
# exit 0 · ** BUILD SUCCEEDED ** · log: .uat-artifacts/epic-527/xcodebuild-release.log

# 4) Install + headless UAT
APP=.uat-artifacts/epic-527/DerivedData-Release/Build/Products/Release-iphonesimulator/Vemoki.app
xcrun simctl install "$UDID" "$APP"
scripts/sim-uat.sh launch com.hangndat.ticket "$UDID"

OUT=apps/mobile/.uat-artifacts/epic-527
# Events (home tab)
scripts/sim-uat.sh screenshot "$UDID" "$OUT/events.png"
# Account — tab «Vé của tôi» renders AccountScreen when OIDC unset
scripts/sim-uat.sh tap --udid "$UDID" --label "Vé của tôi"
scripts/sim-uat.sh screenshot "$UDID" "$OUT/account.png"
# event-detail — fixture deep link
scripts/sim-uat.sh tap --udid "$UDID" --label "Sự kiện"
xcrun simctl openurl "$UDID" "vemoki://events/demo-mfest"
scripts/sim-uat.sh tap --udid "$UDID" --label "Open"   # system sheet if shown
scripts/sim-uat.sh screenshot "$UDID" "$OUT/event-detail.png"
# claim — invitation deep link (no live API)
xcrun simctl openurl "$UDID" \
  "vemoki://invitations/claim?token=uat-epic527-claim-token-abcdef&tenantId=22222222-2222-4222-8222-222222222222&eventId=33333333-3333-4333-8333-333333333333&tenantSlug=mfest-demo&eventSlug=mfest-demo"
scripts/sim-uat.sh screenshot "$UDID" "$OUT/claim.png"
```

### xcodebuild excerpt

```text
# from apps/mobile/.uat-artifacts/epic-527/xcodebuild-release.log
Command line invocation:
    /Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release -sdk iphonesimulator -destination id=4AD7F2DC-5533-4C66-875C-A430DF3C734C -derivedDataPath .uat-artifacts/epic-527/DerivedData-Release CODE_SIGNING_ALLOWED=NO DEVELOPMENT_TEAM=BLUA62D52G build

Build settings from command line:
    CODE_SIGNING_ALLOWED = NO
    DEVELOPMENT_TEAM = BLUA62D52G
…
Validate …/Release-iphonesimulator/Vemoki.app (in target 'Vemoki' from project 'Vemoki')
** BUILD SUCCEEDED **
```

## Artifacts

| Surface | Local (gitignored) | Tracked copy |
| --- | --- | --- |
| Events | `apps/mobile/.uat-artifacts/epic-527/events.png` | [epic-527-ios-gates/events.png](./epic-527-ios-gates/events.png) |
| Account | `…/account.png` | [epic-527-ios-gates/account.png](./epic-527-ios-gates/account.png) |
| event-detail | `…/event-detail.png` | [epic-527-ios-gates/event-detail.png](./epic-527-ios-gates/event-detail.png) |
| claim | `…/claim.png` | [epic-527-ios-gates/claim.png](./epic-527-ios-gates/claim.png) |
| Build / prebuild logs | `apps/mobile/.uat-artifacts/epic-527/*.log` | (machine-local) |
| Product `.app` | `…/DerivedData-Release/.../Vemoki.app` | (machine-local) |

### UI evidence (a11y labels quan sát)

- **Events:** `Events` · `Sự kiện đang mở` · `Đổi mã lấy vé` · `Tổ chức: mfest-demo` · `Chưa cấu hình API` · demo catalog `MFest Demo` / `Demo · chưa xuất bản`.
- **Account** (tab `Vé của tôi` khi OIDC unset): header `Tài khoản` · `Chưa cấu hình đăng nhập` · `Trạng thái: chưa đăng nhập` · privacy link — không giả lập tài khoản.
- **event-detail** (`vemoki://events/demo-mfest` → `/events/fixture/demo-mfest`): `Sự kiện demo` · `Demo · dữ liệu mẫu · chưa xuất bản` · `MFest · Demo` · banner full-bleed · CTA đăng ký demo-disabled copy.
- **claim** (invitation deep link): `Nhận vé mời` · `Cần đăng nhập` · `Chưa cấu hình API — chưa tải form nhận vé` · CTA `Đến tài khoản để đăng nhập`.

## Limitations (không phải FAIL gate)

- Release simulator unsigned (`CODE_SIGNING_ALLOWED=NO`) — đủ gate (b) compile/link local; **không** device Archive / TestFlight / store.
- Không bake production `EXPO_PUBLIC_*` / OIDC trong session UAT (development APS path) → fail-closed Account + Claim; Events dùng demo catalog khi API misconfig — đúng contract fail-closed, không claim live published list.
- Không `open -a Simulator`; UAT chỉ AXe + `simctl`.
- `ios/` generated sau prebuild — **không** commit (gitignored).
- Gate (c) deploy prod: n/a. Không claim pilot ready / store submission.

## Không làm

- EAS Cloud Build / cloud fallback
- Upload signing material lên Expo
- Sửa `apps/web` / backend
- Store submit / deploy prod
