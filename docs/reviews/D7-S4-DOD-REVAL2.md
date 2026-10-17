# D7-S4 — DoD tái thẩm định lần 2 (Cursor REVAL2-2)

**Ngày:** 2026-10-17  
**Kết luận:** **PASS with known gap** — F1/F2 đóng trên tip dưới đây; #117 PASS; #118 deploy prod **NOT authorized** (gap có chủ đích).

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Cursor DoD reviewer-dod · Orca dispatch `ctx_6b49fb1682c5` · task `task_078b471bb8da` · terminal `term_5f6bb07d-4689-4260-9d6d-1b2647e7269c` |
| Implementer (≠ reviewer) | hangndat iOS worker đã đóng F1/F2 (evidence author); không tái dùng verdict Codex |
| Scope | Story [#115](https://github.com/hangndat/ticket-solution/issues/115) · Tasks [#116](https://github.com/hangndat/ticket-solution/issues/116) [#117](https://github.com/hangndat/ticket-solution/issues/117) [#118](https://github.com/hangndat/ticket-solution/issues/118) · PR [#190](https://github.com/hangndat/ticket-solution/pull/190) · paths `docs/reviews/D7-S4-*.md` + `docs/reviews/d7-uat/**` |
| Tip under review (exact) | `c7bd17691651dea7a37bf7fede4b1652141f1f70` |
| Evidence commit F1/F2 | `763e14951c7a74f081ccb50e08ac0bc8201ac244` |
| Behavior SHA (mobile) | `c8606fe59a8e5771aac79c420736960781d3ee3a` |
| Server/runtime (`origin/main` offline-sync) | `f7c88ffd6f936b6da56aa8cea8451f3ae889c278` |
| Artifact path | `docs/reviews/D7-S4-DOD-REVAL2.md` (file này) |

## Supersession

| Artifact lịch sử | SHA / nơi đọc | Verdict cũ | Ghi chú |
| --- | --- | --- | --- |
| `docs/reviews/D7-S4-DOD.md` | `c9bd246…` (git show) | FAIL | iOS offline + D7 build chưa đủ |
| `docs/reviews/D7-S4-DOD-REVAL.md` | `3e2aef6021c005516447b52bd4804d20f163b2f6` · Codex `ctx_8f56cdb5a7d3` | FAIL | thiếu pending dump + DB 0→1→1 + PNG trùng |
| `docs/reviews/D7-S4-DOD-REVAL2.md` (bản Codex) | `2a80c6799c3512073823f8905dbb5372cd9cb1df` · Codex `ctx_0a31e3fd8cf2` | FAIL | F1 OK; F2 đòi raw stdout count từng mốc |
| **File này (Cursor REVAL2-2)** | tip `c7bd176…` + evidence `763e149…` | **PASS with known gap** | **Supersede** các FAIL trên; không tái dùng verdict Codex |

Role file `docs/agents/roles/reviewer-dod.md` không có trong tree (404); áp dụng AGENTS.md + `github-project-tracking.mdc` DoD evidence rules + task dispatch.

## Kết quả theo Issue

| Issue | Verdict | Cơ sở ngắn |
| --- | --- | --- |
| #116 | **PASS** | F1 + F2 + 5 PNG SHA256 distinct + web gate PNGs retained |
| #117 | **PASS** | Local `xcodebuild` Simulator **BUILD SUCCEEDED**, `DEVELOPMENT_TEAM=BLUA62D52G`, không EAS Cloud |
| #118 | **PASS with known gap** | Deploy prod **NOT authorized** — skip có chủ đích; không claim prod |
| #115 | **PASS with known gap** | T1–T3 roll-up: #116+#117 PASS; #118 gap deploy documented |

Không đánh Project **Hoàn thành**; không merge PR #190; không tuyên bố acceptance complete / pilot ready / store submission.

## Checks đã chạy (trên tip `c7bd176…`)

```bash
git rev-parse HEAD
# c7bd17691651dea7a37bf7fede4b1652141f1f70

git merge-base --is-ancestor 763e14951c7a74f081ccb50e08ac0bc8201ac244 HEAD  # yes
git merge-base --is-ancestor c8606fe59a8e5771aac79c420736960781d3ee3a HEAD  # yes

shasum -a 256 docs/reviews/d7-uat/ios/d7-s4-{staff-verified,offline-enqueued,offline-after-restart,offline-after-replay,offline-retry-nodup}.png
# 5 hashes unique; khớp bảng trong D7-S4-UAT.md / checkins-transcript.md

# Đọc: D7-S4-UAT.md, D7-S4-IOS-BUILD.md, D7-S4-DEPLOY-PROD.md,
#   d7-s4-queue-pending.json, d7-s4-queue-final.json,
#   d7-s4-checkins-transcript.md, AX excerpts, d7-s4/xcodebuild-*.md,
#   prior FAIL via git show (3e2aef6, 2a80c67)
```

Không chạy lại sim-uat / xcodebuild / deploy (evidence files đủ theo checklist dispatch). Không EAS Cloud; không điều khiển chuột desktop.

## F1 — PASS (`localStatus=pending` sau terminate, trước replay)

| Evidence | Finding |
| --- | --- |
| [`d7-uat/ios/d7-s4-queue-pending.json`](./d7-uat/ios/d7-s4-queue-pending.json) | `localStatus: "pending"`, `checkinId: null`, type `CHECKIN_OFFLINE` |
| Same IDs → final | ticketId `ace74a71-7646-431a-a73e-7281848002a1`, clientEventId `2a5bfe8b-dd0d-4b71-a46a-95c8c66e0057` |
| [`d7-s4-queue-final.json`](./d7-uat/ios/d7-s4-queue-final.json) | `localStatus: "applied"`, checkinId `431913ad-f107-4a6a-936b-2239f5d78d2e` |
| [`d7-s4-ax-pending-pre-terminate.txt`](./d7-uat/ios/d7-s4-ax-pending-pre-terminate.txt) | `OFFLINE_ENQUEUED pending=1` |
| [`d7-s4-ax-after-restart.txt`](./d7-uat/ios/d7-s4-ax-after-restart.txt) | «Đã xếp hàng offline» khi API paused / cold start (`Phiên: signed-out`) |
| [`D7-S4-UAT.md`](./D7-S4-UAT.md) + transcript | Documents dump **sau** `simctl terminate`, **trước** restart/replay |

Đóng finding F1 của Codex `ctx_8f56cdb5a7d3`.

## F2 — PASS (checkins `0 → 1 → 1`)

[`d7-uat/ios/d7-s4-checkins-transcript.md`](./d7-uat/ios/d7-s4-checkins-transcript.md) (commit `763e149…`):

| Phase | checkins |
| --- | --- |
| before_enqueue / after_enqueue_before_replay / after_restart_before_replay | **0** |
| after_replay | **1** |
| after_retry (same ticket preferOffline) | **1** (no duplicate) |

Có lệnh `psql … SELECT count(*) …`, timestamps UTC, exact SHAs, và stdout row cuối khớp checkinId / clientEventId / source `OFFLINE`.

**Đối chiếu Codex FAIL `ctx_0a31e3fd8cf2`:** bản đó đòi raw stdout count riêng từng mốc. Checklist dispatch Cursor REVAL2-2 chỉ yêu cầu transcript **shows** `0→1→1` (replay rồi retry) — đã thỏa. Không FAIL lại vì thiếu dump stdout từng phase khi bảng + row cuối + queue-final đã nhất quán.

## Screenshots — PASS (5 SHA256 distinct)

Tự tính lại trên working tree tip:

```text
d9d530849d580d0bee9718baa046cd0952068832ba86437fe2ac590e2416d96e  d7-s4-staff-verified.png
dceafca85cc9253e9f03cbaf1a4db09db827ef3fb6b593072b8f6eda730f5eff  d7-s4-offline-enqueued.png
1e640cd0192bee3a41de145f23c19e0f89b0b8a298de7f6045f8106fa10f72fa  d7-s4-offline-after-restart.png
af73b6d7ea01e5be0870417971ae7d2a8baf1b241134ece7292928b42f311981  d7-s4-offline-after-replay.png
a3b11fec2ba7570fd174318befb0dedaad7e87428b18c3673d90c41e856bb5ed  d7-s4-offline-retry-nodup.png
```

5 hash unique; không còn byte-copy `355c385a…`. Nội dung: verified session · `OFFLINE_ENQUEUED pending=1` · after-restart offline/signed-out · after-replay online/empty queue · retry no-dup (online/empty). Web retained: `d7-uat/web/d7-s4-gate-{online,offline}.png`.

## #117 iOS local build — PASS

- [`D7-S4-IOS-BUILD.md`](./D7-S4-IOS-BUILD.md) + [`d7-s4/xcodebuild-d7-excerpt.md`](./d7-s4/xcodebuild-d7-excerpt.md): `** BUILD SUCCEEDED **`, DerivedData `/tmp/d7-s4-DerivedData-d7sha`, path `d7-milestone/apps/mobile/ios`
- [`d7-s4/xcodebuild-excerpt.md`](./d7-s4/xcodebuild-excerpt.md): `DEVELOPMENT_TEAM = BLUA62D52G`, EAS Cloud: not used
- Behavior tree `c8606fe…` unchanged for `apps/mobile` since tip (docs-only deltas after)

Ghi chú nhỏ (không chặn): link `.log` trong UAT/build doc trỏ đuôi sai — artifact committed là `.md`.

## #118 Deploy prod — PASS with known gap

[`D7-S4-DEPLOY-PROD.md`](./D7-S4-DEPLOY-PROD.md): **NOT authorized — deploy skipped.** Không rsync/compose/health claim D7; không tái dùng D6 deploy làm chứng D7.

## Known gaps / limitations (có chủ đích)

1. **#118** — chưa ủy quyền deploy prod → không có deploy SHA / health D7 (milestone gap documented).
2. Docs tip hygiene: tại `c7bd176…`, bảng “Client tip” trong UAT/transcript vẫn ghi `dc65c402…` (parent docs commit) — không ảnh hưởng F1/F2 artifacts tại `763e149…`.
3. Không re-run UAT/DB trong session reviewer (ownership: không chiếm Simulator/DB worker khác).
4. Role path `docs/agents/roles/reviewer-dod.md` thiếu trong repo.

## Verdict

**PASS with known gap** trên tip exact `c7bd17691651dea7a37bf7fede4b1652141f1f70`.

Coordinator có thể merge PR #190 và cập nhật Project sau khi CI xanh + quyết định riêng; **reviewer này không merge và không set Hoàn thành.**
