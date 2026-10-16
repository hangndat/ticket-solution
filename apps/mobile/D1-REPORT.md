# D1 iOS Clerk session POC — worker report

Task: `D1-IOS-CLERK-SESSION` / Issue #11  
Scope: `apps/mobile/**` (+ root lockfile / peer override authorized by coordinator)

## What shipped

- `@clerk/expo@4.12.0` hosted auth (`useHostedAuth`) in Expo Go–compatible path; no native `AuthView`, no EAS Cloud Build.
- Custom `clerkTokenCache` on SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY` + Keychain service `ticket-foundation.clerk`.
- `SessionBridge` → `SessionBoundary.establish(token, verifyViaMe)` so verified identity requires `GET /v1/me` (`MeResponse.userId`).
- Fail-closed when `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing (no ClerkProvider; restore clears credential; UI explains; never stubs verified user).
- My Tickets POC: sign-in, session status, refresh `/v1/me`, logout (boundary + Clerk `signOut`).
- Docs: `apps/mobile/.env.example`, README, root `.env.example` pointers.

## Checks

| Check | Result |
| --- | --- |
| `pnpm --filter @ticket/mobile typecheck` | pass |
| `pnpm --filter @ticket/mobile lint` | pass |
| `pnpm --filter @ticket/mobile test` | pass (identity + config + fetch-me) |
| `pnpm --filter @ticket/mobile build` | pass (iOS JS export → `dist/`) |
| `expo config --type public` | pass |
| `expo install --check` | Dependencies are up to date |
| `npx expo-doctor@latest` | 20/20 passed |

## Limitations

- Live Clerk Dashboard app + Nest `/v1/me` JWKS verifier must be running locally for end-to-end sign-in; this worker did not create cloud Clerk resources or commit secrets.
- `@clerk/expo` peer is `expo >=54 <58`; Expo 58 allowed via root `pnpm.peerDependencyRules.allowedVersions` (`@clerk/expo>expo` → `58`).
- Native Clerk UI / Apple Sign In entitlements not enabled (`appleSignIn: false`). Local Xcode is available if a future prebuild is needed; not used for this POC.
- Staff tab still does not grant staff authorization.
