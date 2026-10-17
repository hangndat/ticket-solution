# DoD review — D10-S4-T2 TestFlight internal prep (#162 / PR #205)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` · terminal `term_75936972-4d63-45dc-b16a-367acd66bad5` · dispatch `ctx_e4b2a93ae95a` · task `task_2f6353558536` · worktree `dod-d10-s4-t2` |
| Implementer (≠ reviewer) | dispatch `ctx_7207821f78a7` (released) · Role `ios` |
| Scope | Issue [#162](https://github.com/hangndat/ticket-solution/issues/162) · PR [#205](https://github.com/hangndat/ticket-solution/pull/205) · Story #160 · Epic #150 · path `docs/reviews/D10-S4-T2-TESTFLIGHT-PREP.md` |
| Commit SHA (under review) | `1a1dee47cd6862447c500133330df9134465e37e` |
| Agent | `cursor` (orca-agent-routing) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse` / tip PR #205 | `1a1dee47cd6862447c500133330df9134465e37e` (= `headRefOid`) |
| Diff ownership | Chỉ `docs/reviews/D10-S4-T2-TESTFLIGHT-PREP.md` (2 commits: checklist + pin SHA) — docs/prep; không sửa `apps/api` / `apps/web` / app runtime |
| Local toolchain only | Commands = `expo prebuild` / `xcodebuild` / `xcrun altool` / Organizer — **không** `eas build` / EAS Cloud |
| Team | Artifact + `apps/mobile/app.config.ts` → `appleTeamId: 'BLUA62D52G'` · bundle `com.hangndat.ticket` · `buildNumber: '9'` |
| Spot-check máy reviewer | Personal Distribution `Apple Distribution: Hang Nguyen Dat (BLUA62D52G)` present; company identities present nhưng không dùng; AuthKey file `AuthKey_MJB7GJ58YL.p8` present locally (**không** đọc nội dung) |
| ASC env | `APP_STORE_CONNECT_API_ISSUER_ID` / Key ID env **unset** — khớp gap documented |
| No production submit | Artifact Claim boundary: App Store production submit **NO**; checklist cấm Submit for Review từ #162 |
| No TF upload in task | Claim: TestFlight IPA uploaded **NO** — đúng khi thiếu Issuer + App Store profile + archive #161 |
| Secrets in repo | Diff không chứa key material / `.p8` / Issuer UUID / password; chỉ Key ID `MJB7GJ58YL` + path `~/.appstoreconnect/...` (OK) |
| Dependency #161 | Documented: archive chưa bàn giao; không block forever — khớp AC prep-only |
| CI tip PR #205 | `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db/d5/* SKIPPED (docs-only) — [run 39046150564](https://github.com/hangndat/ticket-solution/actions/runs/39046150564) · `headSha` = tip SHA |
| Independence | Reviewer dispatch `ctx_e4b2a93ae95a` ≠ implementer `ctx_7207821f78a7` |

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận — không FAIL) | Không upload TestFlight: thiếu ASC Issuer env, thiếu App Store provisioning `BLUA62D52G` / `com.hangndat.ticket`, chưa có archive từ #161. Đã ghi trong § Gaps + Claim boundary. |
| Known gap (chấp nhận) | Phụ thuộc #161 archive — prep checklist + commands sẵn; operator reuse khi #161 PASS. |
| Nit | Transporter.app missing trên máy — artifact đúng hướng dẫn dùng `altool` / Organizer thay thế. |

Không blocker ownership / secrets / EAS Cloud / production submit ngoài scope / thiếu prep evidence.

## Verdict

**PASS with known gap**

- Đủ DoD Task #162 (prep): checklist + lệnh local toolchain, team `BLUA62D52G`, không EAS Cloud, không production submit, không secret trong repo, CI tip xanh (docs-only) trên SHA `1a1dee47cd6862447c500133330df9134465e37e`.
- Known gaps (no TF upload / chờ #161 + Issuer + profile) **đã documented** và nằm trong phạm vi Issue chấp nhận prep-only — không vi phạm AC bắt buộc.
- Reviewer độc lập implementer.
- Merge / Project `Hoàn thành` → **coordinator** (reviewer không merge, không set Hoàn thành).

## Revalidation

Commit hành vi mới sau SHA đang duyệt → bắt buộc DoD lại trên tip mới; không kế thừa verdict. Commit chỉ thêm file DoD này không đổi nội dung prep đã review.
