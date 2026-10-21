# D13 — TestFlight external Beta App Review readiness (read-only ASC + upload)

| Field | Value |
| ----- | ----- |
| Date | **2026-10-21** |
| Worker tip SHA | `cbabea4ccc6447e7dc40a832ba95c81320c1b0d9` |
| App Store Connect app id | `6823694490` |
| Bundle | `com.hangndat.ticket` · Team `BLUA62D52G` |
| Marketing version (train) | `1.0.0` |
| Source `ios.buildNumber` | **`26`** (`apps/mobile/app.config.ts`) |
| Scope | ASC API read + local upload build **26** · **no** `betaAppReviewSubmission` · **no** external group attach · **no** demo passwords via API |

## Executive summary

ASC app display name is **Vemoki**; App Store version `1.0.0` remains **PREPARE_FOR_SUBMISSION** with **no** build selected for release. Before this run ASC’s highest build was **14**; build **26** was archived locally and uploaded — now **VALID** with `internalBuildState=IN_BETA_TESTING` and `externalBuildState=READY_FOR_BETA_SUBMISSION`. `docs/asc/testflight-test-information.md` is **not** on `origin/main` (Kazu PR pending) — beta Test Information was **not** PATCHed via API; drafts below. External Beta App Review submit and demo Sign-in passwords remain **manual** on ASC UI.

---

## 1. Builds (API evidence)

**Command (no secrets):** Python JWT client using env `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_PATH` → `GET /v1/builds?filter[app]=6823694490&sort=-uploadedDate`.

| Build | Uploaded (ASC) | processingState | internal (beta detail) | external (beta detail) | export compliance |
| ----- | -------------- | --------------- | ---------------------- | ---------------------- | ----------------- |
| **26** (tip) | 2026-10-20T23:03:29-07:00 | **VALID** | **IN_BETA_TESTING** | **READY_FOR_BETA_SUBMISSION** | `usesNonExemptEncryption=false` |
| 14 | 2026-10-19T01:28:32-07:00 | VALID | (not re-fetched) | (not re-fetched) | false |
| 13 … 1 | earlier | VALID | — | — | false |

- **Total builds on app:** 16 after upload (was 15).
- **Build id (26):** `0e1fb73f-367c-49b7-bd26-0536bc7f3399` (matches altool Delivery UUID).

### 1.1 Local upload build 26 (authorized; no EAS Cloud)

| Step | Result |
| ---- | ------ |
| `APS_ENVIRONMENT=production` + `expo prebuild --platform ios` | OK |
| `xcodebuild archive` (`CURRENT_PROJECT_VERSION=26`, `MARKETING_VERSION=1.0.0`, team `BLUA62D52G`) | **ARCHIVE SUCCEEDED** |
| `xcodebuild -exportArchive` (`method=app-store-connect`) | **EXPORT SUCCEEDED** |
| `xcrun altool --upload-app` | **UPLOAD SUCCEEDED** · Delivery UUID `0e1fb73f-367c-49b7-bd26-0536bc7f3399` |
| IPA SHA256 | `f3d67dbbf4a966dc9d05513bbc733806959f27aa60bec23e3e8408fd8f7a50ac` |
| IPA bytes | `19214737` |
| Entitlements (IPA inspect) | `aps-environment=production`, `get-task-allow=false`, team `BLUA62D52G` |
| Poll `filter[version]=26` until VALID | **VALID** (~3.5 min after upload) |

Local artifacts (gitignored): `apps/mobile/.expo/tf-upload-26/`.

---

## 2. ASC metadata read-back

| Item | API / observation | Status |
| ---- | ----------------- | ------ |
| App name (`/v1/apps/6823694490`) | **Vemoki** | OK |
| App Info localizations | en-US + vi: name **Vemoki**, subtitles set, `privacyPolicyUrl=https://vemoki.com/privacy` | OK |
| App Store version `1.0.0` | `PREPARE_FOR_SUBMISSION` · id `7c5ac05b-f543-4f71-8af3-a7b40073de7a` | OK (not submitted) |
| Version ↔ release build | `GET .../appStoreVersions/{id}/build` → **data: null** | Gap — pick build **26** (or desired) before App Store submit |
| App Store Review Detail (version) | `GET .../appStoreReviewDetail` → **data: null** | Gap — paste contact + notes (`docs/asc/app-review-notes.md`) |
| Age rating declaration | Direct `ageRatingDeclarations` GET → **403** (UPDATE-only); declaration **exists** on app info id `d67d05a9-a4da-4d14-abd4-b17b8e5aa0e4` per [D13-S3-T1-ASC-FIELDS-READBACK.json](./D13-S3-T1-ASC-FIELDS-READBACK.json) | Partial — confirm rating in UI |
| Privacy Nutrition / App Privacy | `appPrivacy` / `appPrivacyPublish` on app → **404** on this API surface | **Unknown publish state** — assume **not published** until verified in ASC UI (`docs/asc/privacy-nutrition.md`) |
| Paid/Free Apps Agreement | `GET /v1/agreements` → **404** | **Unknown** — account holder must confirm in ASC |
| Beta groups | **James** — internal, `hasAccessToAllBuilds=true` | OK (internal only) |
| `betaAppLocalizations` | **[]** empty | Gap — see draft §4 |
| `betaAppReviewDetail` | contact + demo fields **null** | Gap — user/coordinator: contact + demo (no password in git) |
| `betaLicenseAgreement` | `agreementText: null` | Default Apple beta agreement (typical) |
| Build 26 `betaBuildLocalizations` | **[]** | Gap — “What to Test” draft §4 |
| External beta submission | Not created (per task) | **Waiting on user** |

**Not done (explicit):** attach build 26 to external group · create `betaAppReviewSubmission` · Submit for Review.

---

## 3. Gap table — user / coordinator manual ASC UI

| # | Gap | Suggested action | Owner |
| - | --- | ---------------- | ----- |
| G1 | Privacy Nutrition Labels publish state unconfirmed via API | Complete + **Publish** in App Privacy (`docs/asc/privacy-nutrition.md`) | User |
| G2 | App Store Review Detail empty | Paste notes + contact from `docs/asc/app-review-notes.md`; Sign-in required **passwords ASC only** (VPS `asc-sign-in-required.txt`) | User |
| G3 | Version `1.0.0` not linked to a build | Select build **26** (or newer) on version page when ready for review | User |
| G4 | Screenshots / preview | Upload per S3-T2 | User |
| G5 | Territory / availability | Confirm **VN** (or chosen set) — do not assume “All” | User |
| G6 | Paid Apps Agreement | Confirm active in Agreements, Tax, and Banking | User |
| G7 | TestFlight **Test Information** (beta app localizations) | Fill description, feedback email, privacy/marketing URLs — draft §4 or `testflight-test-information.md` when merged | User / after Kazu PR |
| G8 | Build **What to Test** (`betaBuildLocalizations`) | Paste whatsNew draft §4 for build **26** | User / after Kazu PR |
| G9 | External Beta App Review | When G1–G8 ready: attach build to **external** group, submit Beta App Review (coordinator/user gate) | User |
| G10 | `betaAppReviewDetail` demo account | Set `demoAccountRequired` + credentials in ASC only | User |

---

## 4. Draft beta Test Information (API **not** applied)

**Reason:** `docs/asc/testflight-test-information.md` absent on `origin/main` and workspace — worker stopped at read for PATCH per task spec.

### 4.1 `betaAppLocalizations` (en-US) — proposed

| Field | Draft value |
| ----- | ----------- |
| description | Vemoki is an event ticketing and gate check-in app for attendees and staff. Sign in with your organizer-issued account, view tickets and QR codes, or scan guest codes at the gate. TestFlight build uses production API/OIDC endpoints at vemoki.com. |
| feedbackEmail | `hangndat@gmail.com` |
| privacyPolicyUrl | `https://vemoki.com/privacy` |
| marketingUrl | `https://vemoki.com` |

### 4.2 `betaBuildLocalizations` — What to Test (build 26, en-US) — proposed

```
Build 26 — production APS + api.vemoki.com / auth.vemoki.com baked in.

Please verify:
1) Sign in (OIDC) as attendee — open My Tickets and display a ticket QR.
2) Sign out; sign in as staff — allow Camera — scan a demo ticket QR at the gate.
3) Optional: Account → request account deletion — expect acknowledgement (not instant erasure).
4) Push: allow notifications on first prompt; decline path should still allow tickets/scan.

Known: no in-app ticket purchase in this MVP. Report issues via TestFlight feedback or hangndat@gmail.com.
```

**After** Kazu merges `docs/asc/testflight-test-information.md`, re-run API PATCH for `betaAppLocalizations` + `betaBuildLocalizations` only (still no submission / no external attach).

---

## 5. Commands reference (secrets redacted)

```sh
# Env present (values not logged): APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_API_ISSUER_ID, APP_STORE_CONNECT_API_KEY_PATH

# Read builds
python3 - <<'PY'  # JWT + GET /v1/builds?filter[app]=6823694490
# ...

# Upload (from apps/mobile)
export APS_ENVIRONMENT=production EXPO_PUBLIC_APS_ENVIRONMENT=production
export EXPO_PUBLIC_BUILD_GIT_SHA="$(git rev-parse HEAD)"
pnpm exec expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath .expo/tf-upload-26/Vemoki-1.0.0-26.xcarchive \
  DEVELOPMENT_TEAM=BLUA62D52G CODE_SIGN_STYLE=Automatic \
  CURRENT_PROJECT_VERSION=26 MARKETING_VERSION=1.0.0 archive
xcodebuild -exportArchive \
  -archivePath .expo/tf-upload-26/Vemoki-1.0.0-26.xcarchive \
  -exportPath .expo/tf-upload-26/export \
  -exportOptionsPlist .expo/tf-upload-26/ExportOptions.plist
xcrun altool --upload-app --type ios --file .expo/tf-upload-26/export/Vemoki.ipa \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"
```

---

## 6. Checklist (this task)

- [x] ASC read-only audit app `6823694490`
- [x] Upload build **26** > max train build **14** · wait **VALID**
- [x] No `betaAppReviewSubmission` · no external group attach · no demo passwords in API/git
- [x] Report gaps for manual ASC UI
- [ ] API-fill beta fields (blocked on `testflight-test-information.md` on main)
- [ ] External Beta App Review submit (user gate)
