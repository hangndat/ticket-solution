# Milestone gates (a)+(b) — iOS sim-uat + local xcodebuild · Epic #471

| Field | Value |
| --- | --- |
| Issue / Epic | [#471](https://github.com/hangndat/ticket-solution/issues/471) |
| Role | `ios` (`docs/agents/roles/ios.md`) · Agent cursor · Cost tier standard |
| Worker session | `term_50a7eb14-f8f0-4e16-927b-0ba41cf1a60e` · task `task_574d80c7fd35` · dispatch `ctx_1f1ea8ece207` |
| Architecture impact | **Không** |
| Source tip SHA (exact, binary/UAT) | `65b49e252003436e055a0b8a2e904675eb4fe559` |
| Evidence docs commit (exact) | `a373d0a6138ba76797adceeb7c0f9a0fe4673af6` |
| Branch | `hangndat/ux-ui-revamp-ios-gates-471` |
| Bundle | `com.hangndat.ticket` · app `Vemoki` · buildNumber `10` |
| Team | `BLUA62D52G` (personal) |
| Xcode | 26.5 (Build 17F42) |
| Simulator | **Epic471-iOS-Gates** · UDID `5F53AA9C-5E5D-48BA-B25D-8D0DC656CF11` · iPhone 17 / iOS 26.5 |
| EAS Cloud Build | **Không dùng** |
| Deploy / store | **Không** (ngoài ủy quyền) |

## Verdict

| Gate | Result | Notes |
| --- | --- | --- |
| (a) Headless iOS UAT | **PASS with known gap** | Screenshots Events / Redeem / My Tickets / Ticket detail qua `scripts/sim-uat.sh` (AXe + simctl; không `open -a Simulator`, không cliclick). Gap: Ticket detail = fail-closed «Cần đăng nhập» (không OIDC/API live trong session); My Tickets unsigned-in. |
| (b) Local iOS build | **PASS** | `expo prebuild` + `pod install` + Release `xcodebuild` → `** BUILD SUCCEEDED **` · `DEVELOPMENT_TEAM=BLUA62D52G` |

## Commands & exit codes

Cwd gốc repo trừ khi ghi khác. Logs máy local (gitignored): `apps/mobile/.uat-artifacts/epic-471/`.

```bash
# 0) Identity
gh auth switch --user hangndat
# git user: hangndat <hangndat@gmail.com>

# 1) Deps
pnpm install --filter @ticket/mobile...
# exit 0 · log: apps/mobile/.uat-artifacts/epic-471/pnpm-install.log
pnpm --filter @ticket/contracts build
# exit 0 · log: apps/mobile/.uat-artifacts/epic-471/contracts-build.log

# 2) Simulator (headless — không open Simulator.app)
xcrun simctl create Epic471-iOS-Gates \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17 \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5
# → 5F53AA9C-5E5D-48BA-B25D-8D0DC656CF11
scripts/sim-uat.sh boot 5F53AA9C-5E5D-48BA-B25D-8D0DC656CF11
# exit 0 · log: apps/mobile/.uat-artifacts/epic-471/boot.log

# 3) Local native (cwd: apps/mobile)
CI=1 pnpm exec expo prebuild --platform ios --no-install
# exit 0 · ✔ Finished prebuild · log: .uat-artifacts/epic-471/prebuild.log
# pbxproj: DEVELOPMENT_TEAM = BLUA62D52G · PRODUCT_BUNDLE_IDENTIFIER = com.hangndat.ticket
cd ios && pod install
# exit 0 · Pod installation complete · log: ../.uat-artifacts/epic-471/pod-install.log

UDID=5F53AA9C-5E5D-48BA-B25D-8D0DC656CF11
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "id=$UDID" \
  -derivedDataPath .uat-artifacts/epic-471/DerivedData-Release \
  CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM=BLUA62D52G \
  build
# exit 0 · ** BUILD SUCCEEDED ** · log: .uat-artifacts/epic-471/xcodebuild-release.log

# 4) Install + headless UAT
APP=.uat-artifacts/epic-471/DerivedData-Release/Build/Products/Release-iphonesimulator/Vemoki.app
xcrun simctl install "$UDID" "$APP"
scripts/sim-uat.sh launch com.hangndat.ticket "$UDID"

OUT=apps/mobile/.uat-artifacts/epic-471
scripts/sim-uat.sh screenshot "$UDID" "$OUT/events.png"
scripts/sim-uat.sh tap --udid "$UDID" --label "Vé của tôi"
scripts/sim-uat.sh screenshot "$UDID" "$OUT/my-tickets.png"
scripts/sim-uat.sh tap --udid "$UDID" --label "Sự kiện"
scripts/sim-uat.sh tap --udid "$UDID" --label "Đổi mã lấy vé"
scripts/sim-uat.sh screenshot "$UDID" "$OUT/redeem.png"
xcrun simctl openurl "$UDID" "vemoki://my-tickets/demo-ticket-uat"
# system sheet → tap Open
scripts/sim-uat.sh tap --udid "$UDID" --label "Open"
scripts/sim-uat.sh screenshot "$UDID" "$OUT/ticket-detail.png"
```

## Artifacts

| Surface | Local (gitignored) | Tracked copy |
| --- | --- | --- |
| Events | `apps/mobile/.uat-artifacts/epic-471/events.png` | [epic-471-ios-gates/events.png](./epic-471-ios-gates/events.png) |
| Redeem | `…/redeem.png` | [epic-471-ios-gates/redeem.png](./epic-471-ios-gates/redeem.png) |
| My Tickets | `…/my-tickets.png` | [epic-471-ios-gates/my-tickets.png](./epic-471-ios-gates/my-tickets.png) |
| Ticket detail | `…/ticket-detail.png` | [epic-471-ios-gates/ticket-detail.png](./epic-471-ios-gates/ticket-detail.png) |
| Build / prebuild logs | `apps/mobile/.uat-artifacts/epic-471/*.log` | (machine-local) |
| Product `.app` | `…/DerivedData-Release/.../Vemoki.app` | (machine-local) |

### UI evidence (a11y labels quan sát)

- **Events:** `Events` · `Tổ chức: mfest-demo` · `Đổi mã lấy vé` · banner/logo demo · misconfig API copy khi thiếu `EXPO_PUBLIC_API_BASE_URL`.
- **Redeem:** header `Đổi mã` · form `Mã đổi` / ID tổ chức / ID sự kiện · CTA tải biểu mẫu.
- **My Tickets:** `My Tickets` · `Trạng thái: chưa đăng nhập` · không giả lập tài khoản.
- **Ticket detail:** title `Ticket` · `Cần đăng nhập` · copy fail-closed (deep link `vemoki://my-tickets/demo-ticket-uat`).

## Limitations (không phải FAIL gate)

- Release simulator unsigned (`CODE_SIGNING_ALLOWED=NO`) — đủ gate (b) compile/link local; **không** device Archive / TestFlight / store.
- Không bật API/OIDC live trong session → Events dùng catalog demo cục bộ; ví unsigned-in; Ticket detail không có QR live.
- Không `open -a Simulator`; UAT chỉ AXe + `simctl`.
- `ios/` generated sau prebuild — **không** commit (gitignored).
- Gate (c) deploy prod: n/a. Không claim pilot ready / store submission.

## Không làm

- EAS Cloud Build / cloud fallback
- Upload signing material lên Expo
- Sửa `apps/web` / backend
- Store submit / deploy prod
