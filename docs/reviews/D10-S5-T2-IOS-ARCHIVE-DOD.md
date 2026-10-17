# DoD review — D10-S5-T2 local iOS archive (#165 / PR #220)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_1fe863c2-d4a3-4336-ad48-a6f38607a7a0` · dispatch `ctx_4c7dc69b24eb` · task `task_d2aa540cbbfd` · worktree `dod-d10-s5-t2` |
| Implementer (≠ reviewer) | dispatch `ctx_8090daf029ad` · worktree `d10-s5-t2-archive-final` · branch `hangndat/d10-s5-t2-archive` |
| Scope | Issue [#165](https://github.com/hangndat/ticket-solution/issues/165) · PR [#220](https://github.com/hangndat/ticket-solution/pull/220) · Story #163 · Epic #150 · path `docs/reviews/D10-S5-T2-IOS-ARCHIVE.md` |
| Commit SHA (tip under review) | `0b75ce051bd3adc13204939fb1deead61b73f4ec` |
| Source tip (archive) | `ed873a2046fbff26c69e6d828a90e3515b458f62` (parent of tip; `origin/main` tại lúc archive) |
| Agent | `cursor` (orca-agent-routing) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse` / `gh pr view 220` `headRefOid` | `0b75ce051bd3adc13204939fb1deead61b73f4ec` khớp tip PR #220 |
| Diff ownership vs `origin/main` | Chỉ `docs/reviews/D10-S5-T2-IOS-ARCHIVE.md` (+123) — docs/evidence; không sửa app runtime / `apps/api` / `apps/web` |
| Secrets / signing material | Không secret / `.env` / `.p12` / cert / provisioning trong diff; `.expo/` + generated `ios/` gitignored |
| Team personal only | Spot-check worktree implementer `d10-s5-t2-archive-final`: `DEVELOPMENT_TEAM=BLUA62D52G` (pbxproj Debug+Release); xcarchive `Team=BLUA62D52G`; `codesign` `TeamIdentifier=BLUA62D52G`; identity `Apple Development: Hang Nguyen Dat (Y4PU2PH48G)` |
| Company team | `3WHS6JDYV2` / SCHMELER **không** xuất hiện trong `d10-s5-t2-xcodebuild-archive.log` (count 0) |
| EAS Cloud Build | Không dùng — lệnh chỉ `expo prebuild` / `pod install` / local `xcodebuild … archive`; không `eas build` |
| Local archive | `** ARCHIVE SUCCEEDED **` (1 match) trong log implementer; path `apps/mobile/.expo/archives/Vemoki-D10-S5-T2.xcarchive` (gitignored) |
| Bundle / version | `com.hangndat.ticket` · `0.1.0` · build `9` · arm64 — khớp `app.config.ts` source tip (`appleTeamId: BLUA62D52G`) |
| CI tip PR #220 | `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db/d5-* **SKIPPED** (docs-only) — [run 39048570947](https://github.com/hangndat/ticket-solution/actions/runs/39048570947) · `headSha` = tip SHA |
| Re-run vs #161 | Hợp lệ — tip diverge trên `apps/mobile` (PR #218 demo media); không reuse evidence S4 |
| Scope claims | Archive evidence only; **không** claim IPA export / TestFlight / store submit / deploy prod |

## Findings

| Severity | Finding |
| --- | --- |
| Limitation (trong scope — không FAIL) | Archive ký **Apple Development** (Automatic) dưới team `BLUA62D52G` — đủ AC T2 local archive + đúng team; chưa export `.ipa` / TestFlight / ASC submit. |
| Nit | Log / derived data / `.xcarchive` máy local (gitignored) — reviewer spot-check trên worktree implementer `d10-s5-t2-archive-final` (HEAD cùng tip); không nằm trong git. |

Không blocker ownership / secrets / EAS Cloud / sai team / thiếu ARCHIVE SUCCEEDED / claim vượt AC.

## Verdict

**PASS**

- Đủ DoD Task #165: evidence local `expo prebuild` + `xcodebuild archive` trên source `ed873a2…`, documented tại tip `0b75ce0…`, team `BLUA62D52G` only, không EAS Cloud, không secrets trong PR, CI tip xanh (docs-only).
- Reviewer độc lập implementer (`ctx_8090daf029ad` ≠ `ctx_4c7dc69b24eb`).
- Merge PR #220 / Project `Hoàn thành` → coordinator (reviewer **không** merge, **không** đóng Issue).

## Revalidation

Commit hành vi mới sau SHA `0b75ce051bd3adc13204939fb1deead61b73f4ec` → bắt buộc DoD lại; không kế thừa verdict. Commit chỉ thêm artifact DoD docs không đổi archive evidence thì không yêu cầu re-run archive.
