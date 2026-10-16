# W0 iOS foundation report

Base: `5e4968d`. Ownership: `apps/mobile/**` only. Commit SHA is supplied in the worker completion message to avoid a self-referential commit.

## Delivered

Official latest create-expo-app default scaffold selected SDK 58.0.12, React Native 0.88.0 and React 19.3.0. Reconciled generated AGENTS guidance with repository ownership and iOS-only scope, removed template example screens/assets/editor plugin settings, and pinned package versions. Package is `@ticket/mobile`; config platforms is `["ios"]` with an explicitly documented local example bundle ID.

Native tab/stack shell contains demo Events with organization switching, tenant/event detail routing, My Tickets empty state and an explanatory staff placeholder. All sample events are typed against `@ticket/contracts` PublicEvent and explicitly labeled demo. No ticket, authentication or permission claims are fabricated.

Identity seam supplies unknown/signed-out/verified state with injectable SecureStore credential storage. User + tenant + resource partitions, per-session generation checks, abort controllers, synchronous account-change cache clearing and serialized secure credential operations prevent old responses/writes from restoring the previous account. Startup never trusts Keychain presence without provider validation; no provider is connected. README records the open OIDC/API contract, logout/device-detachment work and private persistence limitations.

## Checks

Commands executed from apps/mobile unless noted:

| Command                                                                            | Result                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm typecheck`                                                                   | PASS                                                         |
| `pnpm lint`                                                                        | PASS                                                         |
| `pnpm test`                                                                        | PASS, 8 tests                                                |
| `pnpm exec expo config --type public`                                              | PASS, iOS only, no EAS project                               |
| `pnpm exec expo install --check`                                                   | PASS, compatible dependencies                                |
| `npx --yes expo-doctor@latest`                                                     | PASS, 20/20 checks                                           |
| `pnpm build`                                                                       | PASS, 1384 modules, iOS Hermes JS export                     |
| `pnpm exec expo start --go --port 8083`                                            | Metro starts; `/status` reports running; stopped after check |
| `CI=1 pnpm exec expo prebuild --platform ios --no-install`                         | PASS, ignored generated iOS project                          |
| `pod install` in ios                                                               | PASS; CocoaPods 1.17.0                                       |
| Root `pnpm exec prettier --check apps/mobile --ignore-path apps/mobile/.gitignore` | PASS                                                         |
| Root `git diff --check`                                                            | PASS                                                         |

Tests cover cross-tenant fixture links, explicit fixture labeling, untrusted restored credential cleanup, account-switch cancellation and late response rejection, re-login under the same subject, late restore after logout, secure-write/logout races and deletion failure propagation.

## Native build

PASS with Xcode 26.5 (`** BUILD SUCCEEDED **`, exit 0):

```sh
xcodebuild -workspace ios/Ticket.xcworkspace -scheme Ticket -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath .expo/w0-derived-data CODE_SIGNING_ALLOWED=NO build
```

This produced an unsigned simulator binary under ignored `.expo/w0-derived-data`; it is not a signed device/archive build. Full local build log: `.expo/w0-xcodebuild.log` (ignored, machine-local). No running simulator belonging to another worker was controlled.

## Integration and limitations

- Coordinator must regenerate root lockfile; verification installation's transient root lockfile changes were restored. No root/contracts/backend/web changes are included.
- Additional `onlyBuiltDependencies` entries required: **none**. Existing `unrs-resolver` permission sufficed.
- No cloud resources, EAS linking, remote push, Android build, native signing/archive or store submission.
- No physical-device or interactive simulator UAT, screenshot, VoiceOver, Dynamic Type or navigation gesture validation. Metro/export/native compilation do not establish runtime UI correctness.
- SecureStore adapter device behavior is not tested by injected-store unit tests. No live OIDC, membership revocation, persistent ticket/QR data, push detachment or server logout; these remain follow-up work under an agreed provider/API contract.
- This is W0; no claim of production authentication, security, offline admission, issuance, check-in or concurrency behavior on a real backend.
