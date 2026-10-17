# DoD review — D10-S4-T1 local iOS archive (#161 / PR #204)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_42ec13e5-84e8-45c5-8847-95c95e39b5e1` · dispatch `ctx_bc30308037cc` · task `task_6a044ed9287e` · worktree `dod-d10-s4-t1` |
| Implementer (≠ reviewer) | dispatch `ctx_687920b61efa` (released) · worktree `d10-s4-t1-archive` |
| Scope | Issue [#161](https://github.com/hangndat/ticket-solution/issues/161) · PR [#204](https://github.com/hangndat/ticket-solution/pull/204) · Story #160 · Epic #150 · path `docs/reviews/D10-S4-T1-ARCHIVE.md` |
| Commit SHA (tip under review) | `3629a526a3f9f0b6cc61e94645f796f61e3d0d0c` |
| Source tip (archive) | `f4e079d8266d8ad56af9411d92ea4ed03390becc` (parent of tip; `origin/main` tại lúc review) |
| Agent | `cursor` (orca-agent-routing) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse` tip PR #204 | `3629a526a3f9f0b6cc61e94645f796f61e3d0d0c` = `gh pr view 204` `headRefOid` |
| Diff ownership | Chỉ `docs/reviews/D10-S4-T1-ARCHIVE.md` (+103) — docs/evidence; không sửa `apps/api` / `apps/web` / app code |
| Secrets / signing material | Không secret / `.env` / `.p12` / cert / provisioning trong diff; `.expo/` + `*.p12` + `*.mobileprovision` gitignored |
| Team personal only | Spot-check worktree implementer: `DEVELOPMENT_TEAM=BLUA62D52G` (pbxproj Debug+Release); xcarchive `Team=BLUA62D52G`; `codesign` `TeamIdentifier=BLUA62D52G`; identity `Apple Development: Hang Nguyen Dat (Y4PU2PH48G)` |
| Company team | `3WHS6JDYV2` / SCHMELER **không** xuất hiện trong `d10-s4-t1-xcodebuild-archive.log` (count 0) |
| EAS Cloud Build | Không dùng — artifact + lệnh chỉ `expo prebuild` / `pod install` / local `xcodebuild … archive`; không `eas build` |
| Local archive | `** ARCHIVE SUCCEEDED **` trong log implementer; path `apps/mobile/.expo/archives/Vemoki-D10-S4-T1.xcarchive` (gitignored) |
| Bundle / version | `com.hangndat.ticket` · `0.1.0` · build `9` · arm64 — khớp `app.config.ts` source tip (`appleTeamId: BLUA62D52G`) |
| CI tip PR #204 | `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db/d5-* **SKIPPED** (docs-only) — [run 39046041422](https://github.com/hangndat/ticket-solution/actions/runs/39046041422) · `headSha` = tip SHA |
| Scope claims | Archive evidence only; **không** claim IPA export / TestFlight / store submit / deploy prod |

## Findings

| Severity | Finding |
| --- | --- |
| Limitation (trong scope — không FAIL) | Archive ký **Apple Development** (Automatic) dưới team `BLUA62D52G` — đủ AC T1 local archive + đúng team; chưa export `.ipa` / TestFlight (Story T2 / submit riêng). |
| Nit | Log / derived data / `.xcarchive` máy local (gitignored) — reviewer spot-check trên worktree implementer `d10-s4-t1-archive`; không nằm trong git. |

Không blocker ownership / secrets / EAS Cloud / sai team / thiếu ARCHIVE SUCCEEDED / claim vượt AC.

## Verdict

**PASS**

- Đủ DoD Task #161: evidence local `expo prebuild` + `xcodebuild archive` trên source `f4e079d…`, documented tại tip `3629a526…`, team `BLUA62D52G` only, không EAS Cloud, không secrets trong PR, CI tip xanh (docs-only).
- Reviewer độc lập implementer (`ctx_687920b61efa` ≠ `ctx_bc30308037cc`).
- Merge PR #204 / Project `Hoàn thành` → coordinator (reviewer **không** merge, **không** đóng Issue).

## Revalidation

Commit hành vi mới sau SHA `3629a526a3f9f0b6cc61e94645f796f61e3d0d0c` → bắt buộc DoD lại; không kế thừa verdict.
