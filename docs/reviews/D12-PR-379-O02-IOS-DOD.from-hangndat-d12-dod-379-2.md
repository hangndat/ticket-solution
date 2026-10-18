# DoD review — PR #379 / Issue #370 (O02 iOS chrome)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` · Agent cursor · Dispatch `ctx_a5f7a8481619` · Task `task_e666400a5cb2` · Terminal `term_1e483a8b-5cc9-4a15-89c3-be5906f8aee9` |
| Implementer (khác session) | `ctx_7fcd7cdee1bf` |
| Scope | PR [#379](https://github.com/hangndat/ticket-solution/pull/379) · Issue [#370](https://github.com/hangndat/ticket-solution/issues/370) · ownership `apps/mobile` (+ stub `scripts/o02-me-events-stub.mjs`, UAT note `docs/reviews/O02-IOS-370-UAT.md`) |
| Commit SHA | `403fce62176827bcda690fa3b76a95f5a89ff359` (tip PR #379; `git rev-parse` khớp) |
| Decision IDs áp dụng | **O02** (DECISION-LOG) · **PD §6.1** (`docs/design/D11-PRODUCTION-UX-UI.md`) · ADR-07 (app chung / nav theo permission) |
| Architecture impact | Không (chrome + soft-deny theo MeEvents contract đã có; không đổi OpenAPI/shared contract) |
| Artifact path | `docs/reviews/D12-PR-379-O02-IOS-DOD.md` |
| Verdict | **PASS** |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| Tip SHA = `403fce62176827bcda690fa3b76a95f5a89ff359` | OK |
| GitHub Actions PR #379 (`mobile`, `ci`, `changes`) | pass (backend/web/d5* skip — đúng ownership mobile) |
| `node --test` identity + links (staff-eligibility, fetch-me-events, installed-app-link) | **15/15 pass** trên SHA |
| UAT headless dual persona | Evidence trong `docs/reviews/O02-IOS-370-UAT.md` + screenshots gitignored `apps/mobile/.uat-artifacts/o02-ios-370/` (worktree implementer); reviewer xác minh ảnh |
| EAS Cloud | Không — UAT ghi local Release / Team `BLUA62D52G` |

## Checklist O02 / PD §6.1

| # | Gate | Evidence | Result |
| --- | --- | --- | --- |
| D-O02 | Nav theo permission server (`staffEligible` từ GET `/v1/me/events`); đổi tab không tự cấp quyền | `StaffEligibilityStore` deny-by-default; chỉ `staffEligible === true` sau probe ok; reset khi signed-out; network/401 → hide | PASS |
| D-PD-6.1 | iOS Staff ẩn khi không quyền | Tab: `NativeTabs.Trigger name="staff" hidden={!showStaff}` — prefer **hide**. Guest: `20-guest-clean.png` (chỉ Sự kiện + Vé của tôi). Staff: `22-staff-tabs.png` + AX `Nhân viên`. Attendee: `24-attendee-tabs.png` (ẩn lại) | PASS |
| D-PERM-UAT | Dual persona headless/sim | Guest + staff + attendee + deep-link deny (`25-staff-deny.png` VI «Không có quyền Nhân viên» / «Về Sự kiện»); stub `scripts/o02-me-events-stub.mjs`; `scripts/sim-uat.sh` | PASS |
| D-READY-NAV | Navigation chrome permission có artifact exact-SHA | Artifact này + UAT note trên SHA tip | PASS |
| D-DECISION-ROW | Decision IDs trong DoD | O02 · PD §6.1 · ADR-07 ghi ở bảng trên | PASS |
| Prefer hide + deep-link deny | Soft-entry `/staff-access`; `vemoki://staff` → `staff-access`; tab route Redirect nếu không eligible | Source + UAT deny screen | PASS |
| Không EAS Cloud | Local signed / documented | UAT note + policy mobile | PASS |

## Findings

### Blocker

Không.

### Should-fix / nit (không chặn PASS)

1. **UI hide ≠ API authz** — đúng O02/note role: chrome fail-closed; Gate API vẫn phải authz server-side (ngoài scope PR này).
2. UAT stub không phục vụ published events → màn Events báo lỗi tải danh sách; không ảnh hưởng chứng minh tab chrome.
3. Screenshot UAT nằm gitignored ở worktree implementer; durable pointer là `docs/reviews/O02-IOS-370-UAT.md` (đã merge trong PR).

## Limitations

- Reviewer không re-run full sim-uat / xcodebuild trên máy này; tin CI `mobile` + unit tests local + xác minh screenshot UAT đã có.
- Physical-device deep link ngoài Simulator không bắt buộc bởi AC #370 (sim-uat dual persona đủ cho chrome).

## Kết luận

PR #379 trên SHA `403fce62176827bcda690fa3b76a95f5a89ff359` **đạt DoD O02 / PD §6.1** cho iOS: ẩn tab Nhân viên khi guest/attendee/no eligibility, hiện khi `staffEligible`, deep-link soft-deny VI, có UAT dual persona, không EAS Cloud.
