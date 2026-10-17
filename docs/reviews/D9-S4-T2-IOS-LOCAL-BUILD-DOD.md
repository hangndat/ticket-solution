# DoD review — D9-S4-T2 iOS local build evidence (#148 / PR #198)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` · terminal `term_464e7406-7185-4545-bf3f-ac15e3f68dd6` · dispatch `ctx_2399ef346bad` · task `task_3daa4a55e7bc` · worktree `d9-s4-t2-dod-reviewer` |
| Implementer (≠ reviewer) | dispatch `ctx_1911e36a1456` · worktree `d9-s4-t2-ios-build` |
| Scope | Issue [#148](https://github.com/hangndat/ticket-solution/issues/148) · PR [#198](https://github.com/hangndat/ticket-solution/pull/198) · Story #146 · Epic #134 · path `docs/reviews/D9-S4-T2-IOS-LOCAL-BUILD.md` |
| Commit SHA | `c454354231f0480b8566db486ee2a37a3f394e91` |
| Source tip (build) | `86be8ef5fc88d558d14d2adb0c122f0c1632c8fb` (ancestor of evidence commit) |
| Agent | `cursor` (orca-agent-routing) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` / tip PR #198 | `c454354231f0480b8566db486ee2a37a3f394e91` |
| Diff ownership | Chỉ `docs/reviews/D9-S4-T2-IOS-LOCAL-BUILD.md` (+64) — docs/evidence; không sửa `apps/api` / `apps/web` / app code |
| Secrets | Không secret / credential / `.env` / signing material trong diff |
| EAS Cloud Build | Không dùng — artifact + Issue comment khẳng định; không có lệnh `eas build` trong evidence |
| `apps/mobile/app.config.ts` (source tip) | `appleTeamId: 'BLUA62D52G'` · `bundleIdentifier: 'com.hangndat.ticket'` · `buildNumber: '8'` |
| Corroborate logs (implementer worktree, gitignored) | `d9-s4-t2-prebuild.log` → Finished prebuild · `d9-s4-t2-pod-install.log` · `d9-s4-t2-xcodebuild.log` → `** BUILD SUCCEEDED **` |
| Generated `project.pbxproj` | `DEVELOPMENT_TEAM = BLUA62D52G` (Debug + Release) · `PRODUCT_BUNDLE_IDENTIFIER = com.hangndat.ticket` |
| Product binary | `Vemoki.app` tồn tại · `CFBundleIdentifier=com.hangndat.ticket` · `CFBundleName=Vemoki` |
| Scope claims | Chỉ simulator Debug unsigned (`CODE_SIGNING_ALLOWED=NO`); **không** claim device / Archive / TestFlight / store submit / deploy prod |
| Evidence trên Issue #148 | Comment implementer có lệnh + SHA + PR + artifact link |
| CI tip PR #198 | `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db **SKIPPED** (docs-only) — [run 39041745836](https://github.com/hangndat/ticket-solution/actions/runs/39041745836) · `headSha` = tip SHA |
| Milestone gate (b) | Đủ evidence local Expo prebuild + xcodebuild; khớp ROADMAP / Project DoD |

## Findings

| Severity | Finding |
| --- | --- |
| Limitation (trong scope — không FAIL) | Binary simulator Debug unsigned — đủ compile/link local; không device-signed / Archive / TF. Khớp AC T2 và Limitations implementer. |
| Nit | Log/derived data máy local (gitignored) — reviewer đã spot-check trên worktree implementer; không nằm trong git. |

Không blocker ownership / secrets / EAS Cloud / thiếu evidence local build / claim physical-device vượt AC.

## Verdict

**PASS**

- Đủ DoD Task #148: evidence local prebuild + xcodebuild trên tip `86be8ef…`, documented tại SHA `c454354…`, team `BLUA62D52G`, không EAS Cloud, CI tip xanh (docs-only).
- Reviewer độc lập implementer (`ctx_1911e36a1456` ≠ `ctx_2399ef346bad`).
- Merge / Project `Hoàn thành` → coordinator (không merge từ reviewer).

## Revalidation

Commit hành vi mới sau SHA này → bắt buộc DoD lại; không kế thừa verdict.
