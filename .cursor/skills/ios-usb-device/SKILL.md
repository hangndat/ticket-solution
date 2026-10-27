---
name: ios-usb-device
description: >-
  Build and install Vemoki onto a physical iPhone over USB (local Xcode, never
  EAS Cloud). Two modes: production extras (OIDC auth.vemoki.com, API
  api.vemoki.com, APNs — same bake as TestFlight) or local API. Use when the
  user asks for USB install, device install, physical iPhone, iphoneos Release,
  devicectl, or when a device build shows «chưa sẵn sàng đăng nhập» / «chưa hỗ
  trợ thông báo».
---

# Vemoki iOS USB / device builds

**ALWAYS read this skill before USB / physical-device install.** Choose **prod** vs **local API** first. Do not invent secrets; print env **names** only.

Canonical path: `.cursor/skills/ios-usb-device/SKILL.md` (same tree as `deploy-prod` / `launch-uat`). Do not copy a second SKILL.md under `apps/mobile`.

## Hard rules

- **Never** Expo/EAS Cloud Build. No `eas.json` in this repo — do not create one. No Fastfile — TF used local `xcodebuild` + `xcrun altool`, not EAS/`fastlane` in-tree.
- Personal Apple team only: `BLUA62D52G`. Bundle `com.hangndat.ticket`. Read `/Users/admin/.cursor/rules/apple-developer-personal.mdc` before signing. Ignore company team `3WHS6JDYV2`.
- `apps/mobile/AGENTS.md`: local prebuild + Xcode only. Generated `ios/` is gitignored.
- Do not print `.p8`, ASC Issuer, Keychain passwords, provisioning blobs, or `/opt/vemoki/.env`.
- Isolated DerivedData: `/tmp/vemoki-device-dd` (do not share Xcode default DD with other apps).
- Example device UDID (confirm live with `xcrun devicectl list devices`): `00008140-000605803C01801C`.
- Development identity: `Apple Development: Hang Nguyen Dat (Y4PU2PH48G)`. USB uses **Development** signing + device UDID on the personal team — not App Store Distribution (that is TestFlight upload).

## Why USB 34/35 failed (do not repeat)

A **stripped** `xcodebuild -configuration Release` that does not bake Expo public extras produces a binary whose JS/`extra.ticketPublic` has empty OIDC / API / push. Gate fail-closed:

- «chưa sẵn sàng đăng nhập» (`accountCopy.misconfiguredTitle` — empty `EXPO_PUBLIC_OIDC_*`)
- «chưa hỗ trợ thông báo» / `Chưa cấu hình thông báo` (empty `EXPO_PUBLIC_PUSH_PROVIDER`)

TestFlight **31** succeeded because production public extras were present at **prebuild and Metro bundle** time (`APS_ENVIRONMENT=production` → `app.config.ts` `bakePublicConfig` + `ios/.xcode.env.local` sourced by Xcode script phases). USB prod must use **the same extras**, not a thinner xcodebuild.

`ios/.xcode.env` (generated) only sets `NODE_BINARY`. Put bake exports in **gitignored** `ios/.xcode.env.local` so the “Bundle React Native code and images” phase sees them. The invoking shell env is not enough if that file still holds the other mode.

## Choose mode

| User intent | Mode | APS bake | API / OIDC at runtime |
| --- | --- | --- | --- |
| Prod / TF-parity on device | **1 — production** | `production` | Pinned `https://api.vemoki.com` + `https://auth.vemoki.com/realms/ticket` |
| Hit API/Keycloak on the Mac | **2 — local API** | `development` | Local URLs **only if** `allowLocalFixtureApi` was baked |

Runtime (`apps/mobile/src/identity/config.ts`): if APS is `production`, `getApiBaseUrl()` **always** returns production. `assertRetailPublicEnv` **throws** if production APS is combined with a non-prod `EXPO_PUBLIC_API_BASE_URL`. Mode 2 cannot be “production APS + localhost”.

Mode 2 also needs `EXPO_PUBLIC_ALLOW_UAT_SESSION=1` at **config** time so `extra.ticketPublic.allowLocalFixtureApi=true`. On a phone, `127.0.0.1` is the **iPhone** — use the Mac LAN IP (or a hostname the device can resolve).

## Env var names (no values/secrets)

Shared / identity:

- `NODE_BINARY` (absolute node in `.xcode.env.local`)
- `EXPO_PUBLIC_BUILD_GIT_SHA` (optional; `git rev-parse HEAD`)
- `EXPO_PUBLIC_OIDC_CLIENT_ID` (public client name `ticket-mobile`)
- `EXPO_PUBLIC_OIDC_SCOPES`
- `EXPO_PUBLIC_TENANT_ID` / `EXPO_PUBLIC_EVENT_ID` (optional; do not hardcode prod tenant)

Mode 1 — production (TF-parity):

- `APS_ENVIRONMENT` / `APP_VARIANT` / `EXPO_PUBLIC_APS_ENVIRONMENT` = `production` (all three, no `development` mix)
- `EXPO_PUBLIC_OIDC_ISSUER`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_PUSH_PROVIDER`

If those three public URLs/provider are unset, `app.config.ts` fills `VEMOKI_PROD_PUBLIC` (`https://api.vemoki.com`, `https://auth.vemoki.com/realms/ticket`, `ticket-mobile`, `apns`). Still export them in `.xcode.env.local` so Metro inlines the same values. Do **not** set `EXPO_PUBLIC_ALLOW_UAT_SESSION` or `EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS`.

Mode 2 — local API:

- `APS_ENVIRONMENT` / `APP_VARIANT` / `EXPO_PUBLIC_APS_ENVIRONMENT` = `development` (or omit; default is development)
- `EXPO_PUBLIC_ALLOW_UAT_SESSION=1` (required to bake local API)
- `EXPO_PUBLIC_OIDC_ISSUER` (Keycloak on the Mac, reachable from the phone)
- `EXPO_PUBLIC_API_BASE_URL` (Nest on the Mac, no trailing slash)
- `EXPO_PUBLIC_PUSH_PROVIDER` — omit or non-`apns` unless you intentionally want sandbox APNs; prod APNs entitlement is **not** this mode
- Optional: `EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS=1` only if fixture event routes are requested

Do not leave Mode 1 exports in `.xcode.env.local` when switching to Mode 2 (and vice versa). Rewrite the file for the chosen mode.

TestFlight **upload** (not USB): when separately authorized, `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_PATH` — names only; never cat the `.p8`. Checklist: `docs/reviews/D10-S4-T2-TESTFLIGHT-PREP.md`.

## Bump CFBundleVersion

Before install, bump `ios.buildNumber` in `apps/mobile/app.config.ts` (string integer). Sync gitignored plist:

```bash
cd apps/mobile && pnpm sync-ios-build
```

(`scripts/sync-ios-build-number.mjs` → `ios/Vemoki/Info.plist` `CFBundleVersion`). Do not reuse a CFBundleVersion already installed on that phone if iOS refuses the replace.

## Shared build steps (cwd `apps/mobile`)

1. Confirm device + personal team. Unlock the iPhone; trust this Mac.
2. Write `ios/.xcode.env.local` for the **chosen mode** (`NODE_BINARY` + bake exports). Do not commit it.
3. Prebuild with the same APS intent:

```bash
# Mode 1
APS_ENVIRONMENT=production APP_VARIANT=production EXPO_PUBLIC_APS_ENVIRONMENT=production \
  CI=1 pnpm exec expo prebuild --platform ios --clean

# Mode 2
APS_ENVIRONMENT=development EXPO_PUBLIC_ALLOW_UAT_SESSION=1 \
  CI=1 pnpm exec expo prebuild --platform ios --clean
```

4. `cd ios && pod install && cd ..`
5. Confirm `DEVELOPMENT_TEAM` in `ios/*.xcodeproj/project.pbxproj` is `BLUA62D52G`.
6. `pnpm sync-ios-build`
7. Device Release (not simulator, not `CODE_SIGNING_ALLOWED=NO`):

```bash
rm -rf /tmp/vemoki-device-dd
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Release \
  -destination 'id=00008140-000605803C01801C' \
  -derivedDataPath /tmp/vemoki-device-dd \
  DEVELOPMENT_TEAM=BLUA62D52G \
  CODE_SIGN_STYLE=Automatic \
  build
```

Replace the UDID with the live device. If `xcodebuild` build-for-destination is flaky, build `generic/platform=iOS` then install with `devicectl`.

8. **Verify the `.app` before install** (required). Product:

`/tmp/vemoki-device-dd/Build/Products/Release-iphoneos/Vemoki.app`

Mode 1 must contain `auth.vemoki.com` and `api.vemoki.com`. Mode 2 must contain the local API/OIDC host you exported — **not** `auth.vemoki.com` as the issuer (and must not be an empty extra).

```bash
APP=/tmp/vemoki-device-dd/Build/Products/Release-iphoneos/Vemoki.app
# Fail closed if missing:
strings "$APP" | grep -F 'auth.vemoki.com' | head
strings "$APP" | grep -F 'api.vemoki.com' | head
strings "$APP" | grep -E '127\.0\.0\.1|192\.168\.|10\.|localhost' | head
# Prefer EXConstants when present:
find "$APP" -name 'app.config' -o -name 'Expo.plist' | head
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist"
```

If Mode 1 strings miss `auth.vemoki.com`, **stop** — that is USB 34/35. Fix `.xcode.env.local` + prebuild, do not install.

9. Install + launch:

```bash
xcrun devicectl device install app --device 00008140-000605803C01801C "$APP"
xcrun devicectl device process launch --device 00008140-000605803C01801C com.hangndat.ticket
```

## Mode notes

**Mode 1 — production USB (TF extras):** same public bake as TestFlight 31. APNs `aps-environment` = production. After launch, Account sign-in should be available (not «chưa sẵn sàng đăng nhập»); push UI should not be `Chưa cấu hình thông báo`. This is not a store submit and not a TF upload.

**Mode 2 — local API USB:** development APS; local fixture API flag on. Phone must reach Mac API/Keycloak (LAN IP, firewall, ATS). HTTP to a LAN IP may fail ATS if Info.plist has no local-network exception — diagnose network, do not switch to production bake to “fix” login. Do not claim prod push DELIVERED from this mode.

## Do not

- EAS Cloud / `eas build`
- Company Apple team
- Commit `ios/`, `.xcode.env.local`, `.p8`, provisioning, `.env`
- Print secret values
- Skip `.app` string check
- Close an Epic from a USB install
- Treat simulator Debug (`docs/reviews/D9-S4-T2-IOS-LOCAL-BUILD.md`) as device evidence
