# DoD review — UX-UI P2 TestFlight build 13 (PR #550 / #545)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` · Persona James · terminal `term_fc5b2484-0f24-4e25-aba2-62bba9571ff5` · dispatch `ctx_1f25f81550f6` · task `task_ae7fa5867c1f` · worktree `ux-ui-dod-tf-550` |
| Implementer (≠ reviewer) | hangndat · dispatch `ctx_35948f44a3c5` / task `task_74780f8e6f4e` (evidence) · branch `hangndat/ux-ui-p2-tf-545` |
| Scope | Issue [#545](https://github.com/hangndat/ticket-solution/issues/545) · PR [#550](https://github.com/hangndat/ticket-solution/pull/550) · Epic [#527](https://github.com/hangndat/ticket-solution/issues/527) · paths `apps/mobile/app.config.ts`, `docs/reviews/ux-ui-p2-testflight-build13.md` |
| Commit SHA (under review) | `4823202bc2ce261f80a68847c4e89345ab599c97` |
| Content commit (buildNumber + evidence) | `e630d0b655631345b2168117a87c499edbb2ef08` |
| Agent | `cursor` (orca-agent-routing) · Cost tier: cheap |
| Architecture impact | Không (bump buildNumber + TF evidence only) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| Tip PR #550 = review SHA | `gh pr view 550` → `headRefOid` = `4823202bc2ce261f80a68847c4e89345ab599c97` |
| Diff ownership | Chỉ `apps/mobile/app.config.ts` (`buildNumber` 12→13) + `docs/reviews/ux-ui-p2-testflight-build13.md` — không `apps/api` / `apps/web` |
| `ios.buildNumber` / team / bundle | Tại SHA: `buildNumber: '13'` · `appleTeamId: 'BLUA62D52G'` · `bundleIdentifier: 'com.hangndat.ticket'` · marketing `1.0.0` |
| Evidence artifact | `docs/reviews/ux-ui-p2-testflight-build13.md` tại tip — tip SHA content `e630d0b…`, ASC id `fa4f322d-6a18-4a62-b5a9-e2133a055f8f`, no EAS, no Submit |
| CI mobile green | [run 39200342257](https://github.com/hangndat/ticket-solution/actions/runs/39200342257) · `head_sha` = tip · `mobile` SUCCESS · `changes`/`ci`/`turbo-persist` SUCCESS · web/backend/portal/db SKIPPED (đúng scope mobile) |
| Local toolchain (host logs) | `/tmp/tf13-prebuild.log` prebuild exit=0 · `/tmp/tf13-xcodebuild.log` **ARCHIVE SUCCEEDED** · `DEVELOPMENT_TEAM=BLUA62D52G` · `CURRENT_PROJECT_VERSION=13` · `/tmp/tf13-export.log` **EXPORT SUCCEEDED** · path implementer wt `ux-ui-p2-tf-545` |
| `altool` upload | `/tmp/tf13-altool.log`: **UPLOAD SUCCEEDED** · Delivery UUID `fa4f322d-6a18-4a62-b5a9-e2133a055f8f` |
| ASC poll (implementer) | `/tmp/tf13-asc-poll.json` final: version `13` · `processingState=VALID` · `internalBuildState=IN_BETA_TESTING` · `externalBuildState=READY_FOR_BETA_SUBMISSION` |
| ASC live re-read (reviewer) | API Key `KHT3SAL2FS` (chỉ đọc): build id khớp · `version=13` · `processingState=VALID` · `expired=false` · App Store Version `1.0.0` `appStoreState=PREPARE_FOR_SUBMISSION` · `releaseType=MANUAL` · beta `internalBuildState=IN_BETA_TESTING` / `externalBuildState=READY_FOR_BETA_SUBMISSION` |
| IPA spot-check (implementer wt, gitignored) | SHA256 `53f32dd3da9ead85ad718697c0528892ef2e51ea9d9c61d1d9a821a18568fc59` · bytes `18886697` (khớp evidence) · `CFBundleVersion=13` · `CFBundleShortVersionString=1.0.0` · `CFBundleIdentifier=com.hangndat.ticket` · Authority `Apple Distribution: Hang Nguyen Dat (BLUA62D52G)` · `get-task-allow=false` · `aps-environment=production` |
| EAS Cloud Build | Evidence + host logs: **không** `eas build` / EAS Cloud; chỉ local `expo prebuild` + `xcodebuild` + `altool` |
| Submit for Review | ASC live: version vẫn `PREPARE_FOR_SUBMISSION` — **chưa** Submit / Ready for Sale |
| Secrets in repo | Diff không chứa `.p8` / issuer / password / IPA; chỉ Key ID công khai `KHT3SAL2FS` |
| Independence | Reviewer dispatch `ctx_1f25f81550f6` ≠ implementer `ctx_35948f44a3c5` |

## Acceptance (#545)

| AC | Verdict |
| --- | --- |
| Tip SHA ghi trong evidence | PASS — content tip `e630d0b…`; PR tip / DoD SHA `4823202…` |
| ASC/TestFlight build mới VALID | PASS — live ASC `VALID` build **13** |
| `docs/reviews/ux-ui-p2-testflight-*.md` + commands | PASS — `ux-ui-p2-testflight-build13.md` |
| CAM: không EAS · không Submit for Review | PASS |

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận — khớp AC / evidence) | Không External TestFlight group auto-attach; Internal khi `VALID`. |
| Known gap (chấp nhận — khớp AC) | Không physical-device smoke trong bước upload; AC không yêu cầu. |
| Limitation | IPA / host logs gitignored — reviewer spot-check trên máy + ASC live; không nằm trong git. |
| Nit | Evidence «Source tip» gắn `e630d0b…`; PR tip thêm commit pin docs `4823202…` — đúng; CI gắn tip đầy đủ. |

Không blocker ownership / secrets / EAS Cloud / thiếu ASC VALID / buildNumber lệch / Submit for Review.

## Verdict

**PASS**

- Đủ DoD #545 / PR #550 trên exact SHA `4823202bc2ce261f80a68847c4e89345ab599c97`: buildNumber 13, local archive/export/altool, ASC `VALID`, CI mobile xanh, không EAS, không Submit for Review.
- Reviewer độc lập implementer.
- Merge / Project `Hoàn thành` → coordinator (reviewer **không** merge).

## Revalidation

Commit hành vi mới sau SHA này → bắt buộc DoD lại; không kế thừa verdict.
