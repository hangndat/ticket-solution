# DoD — PR #360 (D13 S3-T2 ASC screenshots upload evidence)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_07d47ef4-9d9d-4b85-9315-7dc868a07f81` · task `task_11c738d947b0` · dispatch `ctx_9a261d2153d5` (≠ implementer) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#306](https://github.com/hangndat/ticket-solution/issues/306) · Task [#323](https://github.com/hangndat/ticket-solution/issues/323) · PR [#360](https://github.com/hangndat/ticket-solution/pull/360) · paths: `docs/reviews/D13-S3-T2-SCREENSHOTS.md`, `docs/reviews/D13-S3-T2-SCREENSHOTS.json` (+ companion plan/tracker status) |
| Architecture impact | **Không** — ASC screenshot evidence; không đổi source app / OpenAPI / contracts |
| Commit SHA reviewed (PR tip) | `a90a9f829862fc95d8df78fa02c2b54307573de4` (`git rev-parse` + PR `headRefOid`, live verified) |
| Evidence content commit | `283518b50f9966106736a20cf2a48de84b309180` (ancestor; tip chỉ cite SHA) |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` first; docs/evidence review — **source + local PNG + ASC read-only thắng** |
| Verdict | **PASS with known gap** |

---

## Checklist vs AC (Task #323 / PR #360)

| AC | Result |
| --- | --- |
| Exact tip SHA live = claimed | **PASS** — `git rev-parse HEAD` = `a90a9f829862fc95d8df78fa02c2b54307573de4`; khớp PR tip |
| Slot iPhone + iPad theo checklist; không EAS | **PASS** — local `sips`: iPhone **1320×2868** (5 PNG), iPad **2064×2752** (5 PNG); ASC types `APP_IPHONE_67` + `APP_IPAD_PRO_3GEN_129`; không EAS trong diff/claims |
| Upload ASC COMPLETE (en-US) | **PASS** — receipt JSON 10/10 `COMPLETE`; ASC API read-only 2026-10-18 xác nhận cùng 10 asset id + `COMPLETE` + pixels |
| Version state chưa submit | **PASS** — JSON `submitted:false` / state `PREPARE_FOR_SUBMISSION`; ASC live `appStoreState=PREPARE_FOR_SUBMISSION` |
| Evidence + tip SHA; no secrets | **PASS** — MD+JSON trên tip; md5 local ≡ JSON; không private key / JWT / `.p8` / credentials trong commit |
| Gap checklist D13 cập nhật (không bịa ASC state) | **PASS** — G3/G4 đóng phần en-US media khớp ASC read-back; prose rõ chưa submit |
| Independent DoD exact-SHA | **PASS** — session/dispatch này ≠ implementer |
| Không coi Task = publish | **PASS** — claim boundary rõ; reviewer không merge/submit |

---

## Checks (exact tip SHA `a90a9f829862fc95d8df78fa02c2b54307573de4`)

```bash
git rev-parse HEAD
# → a90a9f829862fc95d8df78fa02c2b54307573de4

sips -g pixelWidth -g pixelHeight apps/mobile/.uat-artifacts/d13-asc/iphone-6.9/*.png
# → 1320 × 2868 (×5)

sips -g pixelWidth -g pixelHeight apps/mobile/.uat-artifacts/d13-asc/ipad-13/*.png
# → 2064 × 2752 (×5)

md5 apps/mobile/.uat-artifacts/d13-asc/iphone-6.9/*.png
md5 apps/mobile/.uat-artifacts/d13-asc/ipad-13/*.png
# → 10/10 khớp docs/reviews/D13-S3-T2-SCREENSHOTS.json

# ASC API read-only (JWT từ env local; không ghi secret vào git):
# GET appStoreVersions/7c5ac05b-… → versionString=1.0.0, appStoreState=PREPARE_FOR_SUBMISSION
# GET appScreenshotSets/{e605accf-…,828098b7-…}/appScreenshots → 5+5 COMPLETE; pixels 1320×2868 / 2064×2752
```

| Check | Result |
| --- | --- |
| Tip SHA live | **match** |
| Local PNG sizes | **match claimed slots** |
| Local md5 ↔ JSON | **10/10 match** |
| ASC read-only delivery | **10/10 COMPLETE; ids/sizes/pixels match receipt** |
| ASC version state | **PREPARE_FOR_SUBMISSION** |
| Secrets / EAS / submit in tip | **none** (chỉ cấm/claim phủ định) |
| Runtime store submit | **not claimed; not run by reviewer** |

---

## Findings

### Scope note — plan/tracker edits

PR diff cũng sửa:

- `docs/plans/D13-APP-STORE-RELEASE-PLAN.md` (G3/G4 status)
- `docs/plans/D13-EXECUTION-TRACKER.md` (S3-T2 → Chờ duyệt)

Đây là **companion process docs**, không phải core ASC media evidence. Không blocker DoD cho #323; coordinator có thể chấp nhận trên cùng PR hoặc tách sau — **out of core evidence path** nhưng hợp lý để khớp gap tracker với ASC state đã verify.

### Residual nits (không chặn PASS)

1. Evidence MD field “Tip SHA (evidence commit)” = `283518b…`; PR tip = `a90a9f8…` (cite-only). DoD dùng **PR tip** `a90a9f8…`.
2. ASC enum `APP_IPHONE_67` cho pixels 6.9" (không có `APP_IPHONE_69`) — đã ghi trong artifact; khớp Apple screenshot specs Dynamic Island large.
3. CRG graph `built_at_sha` có thể lệch worktree khác; kết luận từ git + PNG + ASC API.

### Known gaps (có chủ đích — không = publish)

- `APP_IPHONE_61` (medium, listing mới) **chưa** upload — artifact ghi rõ.
- Locale **vi** chưa có screenshot set; chỉ **en-US**.
- Chưa chọn build, chưa App Review submit, chưa release / Ready for Sale.
- PNG gitignored local; durable proof = receipt JSON + ASC read-back (reviewer đã xác nhận live).

Các gap trên **đã được artifact ghi rõ**; không phải finding ẩn. Không đủ để tuyên bố store submit hoặc đóng publish gate.

---

## Verdict

**PASS with known gap** cho PR #360 tip `a90a9f829862fc95d8df78fa02c2b54307573de4`: local sizes/md5 khớp receipt; ASC read-only xác nhận 10/10 `COMPLETE` trên `APP_IPHONE_67` + `APP_IPAD_PRO_3GEN_129`, version vẫn `PREPARE_FOR_SUBMISSION`; không EAS / secrets / submit trong PR. Gap có chủ đích: thiếu `APP_IPHONE_61` + locale vi; chưa submit/release.

Không merge / submit trong session reviewer này.
