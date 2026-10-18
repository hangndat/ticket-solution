# DoD — PR #364 (D13 S4-T3 #327 blocker evidence — NOT physical smoke PASS)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_80025e0d-2200-4848-a635-7693a4b79740` · task `task_9b6ba05e2a73` · dispatch `ctx_539c9b12634c` (≠ implementer) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic D13 · Issue [#327](https://github.com/hangndat/ticket-solution/issues/327) · Story [#307](https://github.com/hangndat/ticket-solution/issues/307) · PR [#364](https://github.com/hangndat/ticket-solution/pull/364) · paths: `docs/reviews/D13-S4-T3-DEVICE-SMOKE.md`, `docs/reviews/D13-S4-T3-DEVICE-SMOKE.json`, tracker row S4-T3 in `docs/plans/D13-EXECUTION-TRACKER.md` |
| Architecture impact | **Không** — docs evidence honesty only; không đổi contract/app code |
| Commit SHA reviewed (PR tip, live) | `0d199467d217f3e6342edab2a37f9fcd8054f5e4` (`git rev-parse` + PR `headRefOid` khớp) |
| Primary evidence commit | `a524e510a3aa351804782aa3194a502532efa90a` |
| Base (merge-base `main`) | `0eb528e7ea23575e67d7a482fda4eae77189b05b` |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` + `detect_changes_tool` (docs paths); MCP `built_at_sha` lệch worktree khác → **source docs + live `devicectl` + Project #3 thắng** |
| Verdict (scope này) | **PASS** — blocker evidence honesty / docs-only OK |
| Verdict (S4-T3 smoke AC / Hoàn thành) | **FAIL / không chấp nhận** — vẫn **Bị chặn**; ≠ physical TF smoke PASS |

---

## Mục tiêu review (theo Task Spec)

Nghiệm thu **honesty của blocker artifact** thôi:

1. ASC Internal TF **VALID** · marketing/build **`1.0.0` / `10`** được ghi đúng.
2. Device USB **không** có binary TF `1.0.0 (10)` (chỉ `0.1.0`).
3. USB sideload Distribution IPA **FAIL** (documented).
4. Project / tracker giữ **Bị chặn** chờ operator cài TestFlight + binary.

**Không** chấp nhận Hoàn thành S4-T3 smoke AC. Merge docs-only được nếu honesty OK; merge **không** đóng #327 / không mở S6.

---

## Checklist honesty vs claims

| Claim | Artifact | Reviewer check | Result |
| --- | --- | --- | --- |
| ASC `processingState=VALID`, version `1.0.0`, build `10`, Internal `IN_BETA_TESTING`, Delivery `45c730c3-…` | MD §ASC + JSON `target` | Khớp nội bộ MD↔JSON; khớp evidence S4-T2 `D13-S4-T2-UPLOAD.md` (cùng Delivery UUID / VALID / IN_BETA). Reviewer **không** gọi lại ASC API (không dùng secret `.p8` trong session) | **PASS (docs honesty)** |
| Không TF binary `1.0.0 (10)` trên device; Vemoki chỉ `0.1.0` | MD inventory + JSON `devices` | Live `devicectl` 2026-10-18: Dexter **connected** Vemoki `0.1.0 (7)` + WDA; DatHN **available** Vemoki `0.1.0 (10)`; **không** match TestFlight app | **PASS** |
| USB Distribution install FAIL `0xe800801f` | MD + JSON `usbInstallDistributionIpa` | Documented fail + entitlement wording; kỳ vọng App Store/TF binary (không re-run install trong review — sideload đã fail documented) | **PASS (documented)** |
| Verdict BLOCKED / `physicalTfSmokePass=false` / không claim smoke PASS | MD headline + JSON | Assert JSON; smoke checklist toàn **BLOCKED**; PR body + Issue comments cùng hướng | **PASS** |
| Status **Bị chặn** chờ operator TF install | Tracker S4-T3 row + Issue comments | Project #3 Status **#327 = `Bị chặn`** (live `gh project item-list`); tracker: `Bị chặn — … ≠ PASS` | **PASS** |
| S4-T3 AC physical smoke / Hoàn thành | — | Camera/attendee/staff smoke **chưa chạy**; artifact tự ghi không đủ đóng S4-T3 | **Không chấp nhận Hoàn thành** |

---

## Checks (exact tip SHA `0d199467d217f3e6342edab2a37f9fcd8054f5e4`)

```bash
git rev-parse HEAD
# → 0d199467d217f3e6342edab2a37f9fcd8054f5e4

gh pr view 364 --json headRefOid
# → 0d199467d217f3e6342edab2a37f9fcd8054f5e4

# JSON honesty asserts (reviewer):
# verdict=BLOCKED, physicalTfSmokePass=false, VALID, 1.0.0/10,
# usbInstall FAIL, testFlightAppPresent=false, installed 0.1.0 only

xcrun devicectl list devices
xcrun devicectl device info apps --device 06CAC741-EB05-55B0-AAE6-14D7B49F50BB
# → Vemoki 0.1.0/7; no TestFlight

xcrun devicectl device info apps --device CB22153A-C24F-547E-87FC-34EC62527838
# → Vemoki 0.1.0/10; no TestFlight
```

| Check | Result |
| --- | --- |
| Tip SHA live | **khớp** PR `headRefOid` |
| Docs-only scope (S4-T3 evidence) | `D13-S4-T3-DEVICE-SMOKE.{md,json}` + tracker 1 dòng; không app code |
| CI tip | [run 39115658754](https://github.com/hangndat/ticket-solution/actions/runs/39115658754) → `changes`/`ci` **SUCCESS**; mobile/backend/web **SKIPPED** (đúng docs-only) |
| Project #327 Status | **`Bị chặn`** |
| Physical smoke / camera AC | **chưa** — đúng với BLOCKED |

Incidental trên cùng PR vs `main`: merge artifact `docs/reviews/D13-PR354-DOD.md` (PR #362) — ngoài scope S4-T3; không tạo claim smoke PASS.

---

## Findings

### Blocker (giữ nguyên — không phải FAIL của docs honesty)

1. **Operator TestFlight install** — cần cài TestFlight + Vemoki `1.0.0 (10)` trên device Apple ID `hangndat@gmail.com`, báo UDID, rồi re-dispatch S4-T3 smoke camera attendee/staff.
2. **S4-T3 AC / Hoàn thành / mở S6** — **chưa** đủ; reviewer **từ chối** nghiệm thu smoke PASS.

### Residual / known gaps (không nuốt AC smoke)

1. ASC API không re-verify live trong session reviewer (đối chiếu S4-T2 + artifact session implementer).
2. USB install FAIL không re-run (đã ghi `0xe800801f`); device DatHN lúc review `available (paired)` không `connected` — vẫn không có TF `1.0.0/10`.
3. CRG `detect_changes` risk 0.90 nhiễu (map sang symbol mobile không thuộc diff docs) — bỏ qua; source docs thắng.

### Nits

1. Tip SHA stamp commit `0d19946` chỉ cập nhật pointer; evidence ASC/device nằm ở `a524e51` — đã ghi rõ trong artifact.
2. PR mang theo `D13-PR354-DOD.md` — nên tách nếu muốn PR #364 chỉ S4-T3; không chặn honesty.

### Out of scope / intentional non-claims

- Không merge hộ trừ ủy quyền docs-only; merge **không** = Hoàn thành #327.
- Không EAS Cloud, không Submit for Review, không computer-use cài TF hộ.
- Review-only: không sửa implementation; artifact DoD này local trên worktree reviewer.

---

## Verdict

**PASS** cho **docs honesty / blocker evidence** trên exact SHA `0d199467d217f3e6342edab2a37f9fcd8054f5e4`.

**Không PASS** physical-device smoke AC của S4-T3; Project #327 giữ **`Bị chặn`** đến khi operator TF install + smoke re-run + revalidation SHA mới.

Docs-only merge: **OK** (nếu coordinator muốn land evidence). **Không** đóng #327 / **không** mở S6 chỉ vì merge PR này.

---

## Comment VI (đăng Issue #327 / PR #364)

```text
## DoD độc lập PR #364 — tip `0d199467d217f3e6342edab2a37f9fcd8054f5e4`

**Verdict (scope review):** PASS — artifact blocker ghi trung thực.
**Verdict (S4-T3 smoke AC / Hoàn thành):** không chấp nhận — vẫn **Bị chặn**.

Đã xác minh:
- ASC TF `1.0.0/10` · `VALID` + Internal `IN_BETA_TESTING` (khớp artifact + S4-T2; Delivery `45c730c3-…`)
- USB devices: Vemoki chỉ `0.1.0`; không TestFlight app / không binary TF `1.0.0 (10)` (live `devicectl`)
- USB Distribution install FAIL `0xe800801f` được ghi đúng
- Project #327 Status = **Bị chặn**; tracker S4-T3 ≠ PASS; chờ operator cài TestFlight + binary rồi re-dispatch

Artifact: `docs/reviews/D13-PR364-DOD.md`
CI tip: success (docs-only). Merge docs-only OK; **không** đóng #327 / không mở S6.
```
