# DoD review — D8-S4-T2 iOS local build evidence (#132 / PR #214)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` · terminal `term_15b6e2a9-4f2a-4ba2-bd50-e355465ec229` · dispatch `ctx_26761f9b55e4` · task `task_15881cafb278` · worktree `dod-d8-t2` |
| Implementer (≠ reviewer) | worktree `d8-s4-t2-ios-build` · branch `hangndat/d8-s4-t2-ios-build` · evidence commit below |
| Scope | Issue [#132](https://github.com/hangndat/ticket-solution/issues/132) · PR [#214](https://github.com/hangndat/ticket-solution/pull/214) · Story #130 · Epic #119 · path `docs/reviews/D8-S4-T2-IOS-BUILD.md` |
| Commit SHA | `7c8e7dfe5569d0a15edba9a8c7e03e9961dedb6f` |
| Source tip (build) | `f60b64383e5ae70bdb73d14c6b05c1e8dacb4393` (ancestor of evidence commit) |
| Agent | `cursor` (orca-agent-routing) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse` / tip PR #214 | `7c8e7dfe5569d0a15edba9a8c7e03e9961dedb6f` |
| Diff ownership | Chỉ `docs/reviews/D8-S4-T2-IOS-BUILD.md` (+86) — docs/evidence; không sửa `apps/api` / `apps/web` / app code |
| Secrets | Không secret / credential / `.env` / signing material trong diff |
| EAS Cloud Build | **Không dùng** — artifact + logs khẳng định; không có lệnh `eas build` trong evidence/logs |
| `apps/mobile/app.config.ts` (source tip + current) | `appleTeamId: 'BLUA62D52G'` · `bundleIdentifier: 'com.hangndat.ticket'` · `buildNumber: '9'` · comment “Never use EAS Cloud Build” |
| Corroborate logs (implementer worktree, gitignored) | `d8-s4-t2-prebuild.log` → ✔ Finished prebuild · `d8-s4-t2-pod-install.log` · `d8-s4-t2-xcodebuild.log` → `** BUILD SUCCEEDED **` + invoke `DEVELOPMENT_TEAM=BLUA62D52G` |
| Generated `project.pbxproj` | `DEVELOPMENT_TEAM = BLUA62D52G` (Debug + Release) · `PRODUCT_BUNDLE_IDENTIFIER = com.hangndat.ticket` |
| Product binary | `Vemoki.app` tồn tại · `CFBundleIdentifier=com.hangndat.ticket` · `CFBundleName=Vemoki` · `CFBundleVersion=9` |
| Scope claims | Chỉ simulator Debug unsigned (`CODE_SIGNING_ALLOWED=NO`); **không** claim device / Archive / TestFlight / store submit / deploy prod |
| CI tip PR #214 | `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db **SKIPPED** (docs-only) — [run 39047094155](https://github.com/hangndat/ticket-solution/actions/runs/39047094155) · `headSha` = tip SHA |
| Milestone gate (b) | Đủ evidence local Expo prebuild + xcodebuild; team `BLUA62D52G`; khớp ROADMAP / Project DoD |

## Findings

| Severity | Finding |
| --- | --- |
| Limitation (trong scope — không FAIL) | Binary simulator Debug unsigned — đủ compile/link local; không device-signed / Archive / TF. Khớp AC T2 và Limitations implementer. |
| Nit | Log/derived data máy local (gitignored) — reviewer đã spot-check trên worktree implementer `d8-s4-t2-ios-build`; không nằm trong git. |

Không blocker ownership / secrets / EAS Cloud / thiếu evidence local build / claim physical-device vượt AC.

## Verdict

**PASS**

- Đủ DoD Task #132: evidence local prebuild + xcodebuild trên tip `f60b643…`, documented tại SHA `7c8e7df…`, team `BLUA62D52G`, **BUILD SUCCEEDED**, không EAS Cloud, CI tip xanh (docs-only).
- Reviewer độc lập implementer (worktree/session khác).
- Merge / Project `Hoàn thành` → coordinator (không merge từ reviewer).

## Revalidation

Commit hành vi mới sau SHA này → bắt buộc DoD lại; không kế thừa verdict.
