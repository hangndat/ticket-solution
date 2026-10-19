# Mobile working agreement

Read the root AGENTS.md, `.cursor/rules/*.mdc` (Orca parallel/routing/idle-fill, GitHub Project, GitHub Flow), docs/PRD.md, docs/TECHNICAL-DESIGN.md and your current task. Root ownership and dispatch constraints take precedence over generated template guidance. Only edit apps/mobile; coordinator owns root tooling, lockfile and shared contracts. Feature work: branch + PR — không commit thẳng `main`.

Explicit user requirement: NEVER use Expo/EAS Cloud Build or EAS-hosted build workflows, and never fall back to cloud builds. Native binaries must be built locally with Xcode/xcodebuild/fastlane on a Mac or self-managed macOS runner. Local Expo CLI/prebuild is allowed. If local tools are unavailable, report the limitation instead of uploading to Expo build infrastructure.

This is an iOS-only W0 foundation, not production ticketing. No Android build or submission, EAS project, production resource, real secret, fixture authentication or fake staff authorization. Generated ios/ and dist/ outputs are ignored; configure native behavior through app.json and plugins, never edit generated native source by hand.

Before changing APIs, read expo-overview and react-native-best-practices, detect the installed Expo major and consult matching versioned docs. Use Expo's SDK-aware installer with pnpm and pin exact compatible versions. Expo Go includes Expo UI and SecureStore for SDK 58; adding a bundled module alone does not require a custom build.

Keep src/app routes-only and screen bodies outside routes. Label demo content explicitly and preserve tenant scoping. Private identity/cache loads must preserve user partitioning and generation guards; credential presence alone never proves identity.

Run typecheck, lint, meaningful identity tests, Expo config/doctor and iOS JS export. The build script validates JS, not a native binary or App Store release. Simulator UAT from agents: `orca emulator` only (see root `.cursor/rules/uat-headless.mdc`). Follow the live Orca dispatch for checkpoints/heartbeats/completion; do not delegate unless authorized.

Roadmap, Issues, task tracking and user-facing progress reports must be in Vietnamese, except technical terms, IDs, commands and raw verification logs. Do not begin new feature implementation before the roadmap is prepared for user review.
