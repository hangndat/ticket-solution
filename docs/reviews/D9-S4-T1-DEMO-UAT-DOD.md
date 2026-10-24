# DoD review — D9-S4-T1 Demo UAT headless (#147 / PR #197)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` · terminal `term_c70e24bb-f312-4510-9ae7-f09a615236b5` · dispatch `ctx_367cc570838a` · worktree `d9-s4-t1-dod-reviewer` |
| Implementer (≠ reviewer) | dispatch `ctx_dfdcc772aa10` · worktree `d9-s4-t1-uat-roles` |
| Scope | Issue [#147](https://github.com/hangndat/ticket-solution/issues/147) · PR [#197](https://github.com/hangndat/ticket-solution/pull/197) · Story #146 · Epic #134 · paths `docs/reviews/D9-S4-T1-DEMO-UAT.md`, `docs/reviews/d9-uat/s4-t1/**` |
| Commit SHA | `93fe1291bf792dd0a5927d6f6c5a2d4aa23f4ab4` |
| Agent | `cursor` (orca-agent-routing) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` / tip PR #197 | `93fe1291bf792dd0a5927d6f6c5a2d4aa23f4ab4` |
| Diff ownership | Chỉ `docs/reviews/**` (1 markdown + 15 PNG) — không code app |
| Secrets | Không secret prod; chỉ fixture local (`ticket_dev` / pepper demo / attendee-demo) đúng kiểu seed |
| Artifact PNG | 8 web + 7 iOS; kích thước hợp lệ (Playwright ~1280px, sim ~1206×2622) |
| Spot-check UI | Web home: Vemoki + FUN FEST / Form & Forum DEMO; redeem BFF; iOS Events `Tenant: demo-fun` + demo catalog; Staff signed-out / `api.vemoki.com` |
| CI tip PR #197 | `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db **SKIPPED** (docs-only) — [run 39038789149](https://github.com/hangndat/ticket-solution/actions/runs/39038789149) |
| Lệnh evidence (implementer, ghi trong artifact) | `scripts/web-uat.sh` screenshot / auth-smoke / bff-login · `scripts/sim-uat.sh` boot/launch/screenshot/tap — headless / không EAS / không computer-use |
| ROADMAP §1.2 | Không claim camera/push/device vật lý; Limitations ghi rõ không pilot ready |

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận trong scope T1) | `d9-uat/s4-t1/ios/d9-sim-events-loaded.png` cho thấy **lỗi** tải danh sách published (`api.vemoki.com`), không phải load thành công — khớp Limitations implementer; seed demo catalog (`demo-fun` / FUN FEST) vẫn có trên Events. Không dùng headless để PASS AC thiết bị thật. |
| Nit | Tên file `events-loaded` dễ hiểu nhầm là success; nội dung vẫn là evidence trung thực. |
| Nit | Curated `bff-login-*.png` chủ yếu chrome `/auth`; claim HTTP 200 / emailVerified dựa bảng lệnh implementer (không thấy session badge rõ trên PNG). API smoke redeem `DEMO-FUN-003` → 201 vẫn được ghi. |

Không blocker ownership / secrets / thiếu evidence headless / claim physical vượt scope.

## Verdict

**PASS with known gap**

- Gap: iOS published-list API (prod URL) fail trên sim; seed fixture UI vẫn chứng minh demo catalog.
- Gap **không** vi phạm AC Issue #147 (UAT headless web + sim trên seed; không EAS; không device-only AC).
- Đủ gate milestone (a) headless cho Story/Epic khi coordinator merge + Project sync.

## Revalidation

Commit hành vi mới sau SHA này → bắt buộc DoD lại; không kế thừa verdict.
