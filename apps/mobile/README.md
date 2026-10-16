# Ticket iOS foundation (W0)

`@ticket/mobile` is an iOS-only Expo SDK 58 / React Native 0.88 shell, generated with `npx --yes create-expo-app@latest apps/mobile --no-install` (official default SDK 58 template), then reduced to the assigned W0 scope. Versions are exact; native packages follow the generated SDK's compatibility table. React DOM is pinned to match React because Expo UI's universal layer has a web peer, although this app config only targets iOS. ESLint 9 is used because Expo's React/import lint plugins do not yet declare ESLint 10 compatibility.

## Run and check

From the repository root after the coordinator updates the root lockfile and installs:

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

## Scope and fixtures

Routes only live in `src/app`; screen bodies live in `src/screens`. Native tabs and stack headers provide navigation. RN's scrolling event catalog uses tenant-scoped `PublicEvent` fixtures from `@ticket/contracts`; the demo organization switch affects only those fixtures. Event links contain both tenant and event slug, and mismatched links show an unavailable state. Fixture data is explicitly labeled demo and never substitutes for a failed production API.

My Tickets contains no real or sample tickets. Staff is a public explanatory placeholder with no staff permission, selected staff context, camera or check-in action. Changing a demo organization is not authentication or membership. No authentication, API calls, ticket persistence, push, QR, redemption, offline admission or production resources are implemented.

The `@ticket/contracts` dependency is type-only; the local TS path reads the coordinator-owned source contract so clean typechecking does not require writing shared `dist` files. No duplicate event transport interface is maintained.

## Identity integration contract still needed

`SessionBoundary` starts `unknown`. Startup reads the injected credential store, but a stored credential never establishes identity on its own. With no provider verifier, it deletes any credential and becomes `signed-out`; failed storage access leaves identity unknown. There is no mock login/provider or user-ID input in the UI.

A future provider adapter must:

- Supply a real verified-credential callback to `restore`/`establish`, deriving a stable, server-validated subject (`userId`) rather than trusting a local token payload or UI value. Define token format, issuer/audience, expiry/refresh, revocation, PKCE callback and OIDC provider first.
- Establish verified email, tenant memberships and event permissions through server contracts. The boundary's `verified` identity does not grant staff access or tenant authorization.
- Define logout/revoke and device push detachment endpoints, failure/retry behavior and cancellation. Await `logout`; a Keychain deletion failure rejects even though local cache is already inaccessible. The W0 UI has no sign-in/logout control because no provider is connected.
- Place every private load through the boundary (or preserve its generation guard in a future query adapter), with user/tenant/resource partitioning. Abort signals are advisory; generation checks reject late data even when a loader ignores abort. Switching accounts clears cache and aborts old requests synchronously before verification/storage work.
- Add minimal encrypted/file-protected persisted ticket storage, retention policy and device validation before offline tickets. Current cache is memory-only and there are no QR credentials.

The real Expo SecureStore adapter uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY` with a dedicated Keychain service. It is injectable for deterministic tests; test stores and synthetic account IDs are confined to tests. SecureStore can outlive app uninstall, so every startup must reconcile with the eventual provider. This foundation does not claim device security or a completed identity spike.

## Integration ownership

Coordinator must regenerate the root pnpm lockfile after merging this package. Installation needed **no additional `onlyBuiltDependencies` entries**; `unrs-resolver` was already allowlisted. Root tooling/contracts were not committed by this worker. See `W0-REPORT.md` for exact checks and limitations.

Versioned references: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Expo UI](https://docs.expo.dev/versions/v58.0.0/sdk/ui/).
