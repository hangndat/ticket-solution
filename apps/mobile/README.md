# Ticket iOS foundation (W0 + D1 Clerk POC)

`@ticket/mobile` is an iOS-only Expo SDK 58 / React Native 0.88 shell. D1 adds a Clerk hosted-auth POC bridged into the existing `SessionBoundary` / SecureStore identity cache.

## Run and check

From the repository root after install:

```sh
pnpm --filter @ticket/mobile dev
pnpm --filter @ticket/mobile typecheck
pnpm --filter @ticket/mobile lint
pnpm --filter @ticket/mobile test
pnpm --filter @ticket/mobile build
```

`dev` opens iOS on Metro port 8083; choose your own simulator when other workers are active. Alternatively run `pnpm exec expo start --go --port 8083` from this directory to use Expo Go. `build` validates an **iOS JavaScript/Hermes export**, not an Xcode binary, archive, signing, TestFlight or store submission. Native projects and exported bundles are generated and ignored. `com.example.ticket.foundation` is a local build placeholder, not approved store identity. No EAS project is linked.

Additional checks from this directory:

```sh
pnpm exec expo config --type public
pnpm exec expo install --check
npx --yes expo-doctor@latest
```

## Local env (no secrets in git)

Copy `apps/mobile/.env.example` to `apps/mobile/.env` (or a root `.env` that Expo loads):

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key. **Empty → fail-closed UI**; the app never stubs a verified user.
- `EXPO_PUBLIC_API_BASE_URL` — Nest API origin for `GET /v1/me` (default local `http://127.0.0.1:3001`).

Enable Native API in the Clerk Dashboard for Expo. Hosted Account Portal sign-in works in Expo Go; native `AuthView` is intentionally not used (would require a local prebuild/dev client, never EAS Cloud Build).

## D1 identity POC

My Tickets hosts the POC:

1. **Sign in** — Clerk hosted auth (`useHostedAuth`) in a browser auth session (PKCE-capable).
2. **Session bridge** — after Clerk is signed in, the short-lived bearer is passed to `SessionBoundary.establish` and **only** becomes `verified` when `GET /v1/me` returns a `MeResponse.userId`.
3. **Refresh /v1/me** — displays server identity (`userId`, `issuer`, `subject`, email flags).
4. **Log out** — `session.logout()` then Clerk `signOut()`, clearing SecureStore credential + in-memory user/tenant cache partitions (generation guards preserved).

Clerk's own session keys use a custom `tokenCache` with the same SecureStore posture as `secure-credential-store`: `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and a dedicated Keychain service (`ticket-foundation.clerk`). The API bearer still goes through `ticket-foundation.identity` / `SessionBoundary`.

Verified SessionBoundary identity does **not** grant staff authorization or tenant membership.

### Dependency note (Expo 58)

`@clerk/expo@4.12.0` declares peer `expo: >=54 <58`. This app is on Expo 58; root `package.json` sets `pnpm.peerDependencyRules.allowedVersions` for `@clerk/expo>expo` → `58`. If Clerk runtime fails hard on SDK 58, treat as a blocker (do not stub auth).

## Scope and fixtures

Routes only live in `src/app`; screen bodies live in `src/screens`. Native tabs and stack headers provide navigation. RN's scrolling event catalog uses tenant-scoped `PublicEvent` fixtures from `@ticket/contracts`; the demo organization switch affects only those fixtures. Event links contain both tenant and event slug, and mismatched links show an unavailable state. Fixture data is explicitly labeled demo and never substitutes for a failed production API.

Staff remains a public explanatory placeholder with no staff permission, camera or check-in action.

The `@ticket/contracts` dependency is type-only; the local TS path reads the coordinator-owned source contract so clean typechecking does not require writing shared `dist` files.

## Identity invariants (unchanged)

`SessionBoundary` starts `unknown`. A stored credential never establishes identity without a server verifier. Account switch / re-login bumps generation, aborts in-flight loads, and clears partitioned cache. Await `logout`; Keychain deletion failure rejects even though local cache is already inaccessible.

Versioned references: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Using Clerk](https://docs.expo.dev/guides/using-clerk/).

## Mandatory build policy

Never use Expo/EAS Cloud Build, EAS-hosted build workflows or automatic cloud fallback. Build native iOS binaries locally with Expo prebuild plus Xcode/xcodebuild or fastlane on a Mac/self-managed macOS runner. If local tooling is unavailable, report the limitation — do not upload to Expo build infrastructure.
