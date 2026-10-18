# Gap audit INDEX — toàn sản phẩm (Run gap-audit)

| Trường | Giá trị |
| --- | --- |
| Vai trò | Epic planner (`orca-epic-orchestrator.mdc`) — **không** `worker-start`, không code ownership |
| Agent | `cursor` |
| Ngày | 2026-10-18 |
| Tip SHA (worktree) | `a507b36a722f34ee65f19f6388254b44966568cb` |
| Tip message | `Merge pull request #367 … docs-ui-cleanup-reviews` |
| Board | [Project #3](https://github.com/users/hangndat/projects/3) — snapshot `gh` cùng lúc soạn |
| Architecture impact (đợt này) | **Có** — đối chiếu ADR/O vs shipped |
| OUT | Không merge; không đổi Status `Hoàn thành`; không mở MVP ngoài O10/O14 |

**Verdict điều phối:** D11 / #254 / phần lớn UX-01…07 và D12 child #294–#296 đã **đóng board**; O06 **đã chốt**; privacy live **200**. Gap **P0 còn mở và chưa có Issue**: **O02 navigation theo permission** (iOS tab «Nhân viên» luôn hiện + web chrome theo route + thiếu contract capabilities). API authz deny-by-default **PASS** (không bypass). **Chưa** pilot/production ready chỉ vì board xanh.

---

## 0. Artifact cùng đợt (reconcile)

| Artifact | Role | Path | Trạng thái |
| --- | --- | --- | --- |
| BA | `product-ba` | [`GAP-AUDIT-2026-10-18-BA.md`](./GAP-AUDIT-2026-10-18-BA.md) | **Có** |
| Architect | `architect` | [`GAP-AUDIT-2026-10-18-ARCH.md`](./GAP-AUDIT-2026-10-18-ARCH.md) | **Có** |
| DoD process | `reviewer-dod` | [`GAP-AUDIT-2026-10-18-DOD.md`](./GAP-AUDIT-2026-10-18-DOD.md) | **Có** |
| Security | `reviewer-security` | [`GAP-AUDIT-2026-10-18-SECURITY.md`](./GAP-AUDIT-2026-10-18-SECURITY.md) | **Có** (SHA worker có thể lệch tip; kết luận O02/nav khớp) |
| PD riêng Run | `product-design` | *(chưa thấy `GAP-AUDIT-2026-10-18-PD.md`)* | Dùng `docs/design/D11-PRODUCTION-UX-UI.md` §6.1 + `docs/plans/PRODUCTION-READINESS-UX.md` |
| Research trước | BA/UX/Arch/Sec/Planner | `docs/plans/PRODUCTION-READINESS-*.md` | **Stale một phần** — errata ở bảng dưới |

Nguồn quyết định: `docs/DECISION-LOG.md` (O01–O15, đặc biệt O02), `docs/PRD.md`, `docs/TECHNICAL-DESIGN.md`, `docs/ROADMAP.md`.

---

## 1. Highlight — O02 staff tab luôn hiện (đã biết, còn mở)

| Mục | Chi tiết |
| --- | --- |
| Quyết định | O02 / ADR-07: staff trong app chung; **navigation theo permission**; không cấp quyền mới chỉ vì đổi tab |
| PD | `D11-PRODUCTION-UX-UI.md` §6.1: «iOS: 3 tab; **Staff ẩn/disabled nếu không có quyền**» |
| Fact tip | `apps/mobile/src/app/(tabs)/_layout.tsx` luôn mount `NativeTabs.Trigger name="staff"` / label «Nhân viên» — **không** đọc membership/permission |
| Web | `SiteNav` variant `guest\|staff\|admin\|platform` **hardcode theo route** (`site-chrome.tsx`) |
| API | Nest Gate/Admin + `requireTenantPermission` fail-closed — **UI hide ≠ security** (ARCH + SECURITY) |
| DoD process | `docs/reviews/*` **0×** gate O02; PASS Gate/attendee **không** verify tab ẩn (DOD artifact) |
| Issue board | **Không** có Task «nav theo permission / O02» |

---

## 2. Bảng gap hợp nhất

Cột **đã có Issue?** = Issue Project #3 hiện tại (không bịa số). Severity: P0 / P1 / P2.

| ID | Mô tả | Evidence (path / SHA / Issue) | Sev | Owner role | Đã có Issue? | Đề xuất Task title |
| --- | --- | --- | --- | --- | --- | --- |
| **GAP-O02-NAV** | iOS tab «Nhân viên» + web staff/admin chrome không theo permission server | `_layout.tsx` @ tip; PD §6.1; O02; BA `GAP-BA-O02`; ARCH-P0-2/3; SEC-GAP-NAV-01; DOD G4 | **P0** | `ios` ∥ `web` (sau contract) | **Không** | `[O02] iOS: ẩn/disable tab Nhân viên khi không staffEligible` · `[O02] Web: SiteNav theo capabilities (không hardcode route)` |
| **GAP-O02-CONTRACT** | Thiếu tín hiệu chrome ổn định: `/v1/me` không membership; `MeEvents` contract chưa ship Nest; Scanner `tenantPermissions: []` | ARCH-P0-1; `packages/contracts` `MeEventsResponse`; không handler `me/events` | **P0** | `architect` → `backend` | **Không** | `[O02] Architect handoff capabilities` rồi `[O02] BE: MeEvents hoặc /v1/me staff-capabilities` |
| **GAP-DOD-O02** | DoD/corpus reviews không gate O02 / PD §6.1; PRODUCTION-READINESS Navigation «Kiểm lại sau attendee» chưa đóng | DOD G1–G3; `PRODUCTION-READINESS-UX.md` §4.4 | **P0** process | `reviewer-dod` (+ docs) | **Không** | `[O02] DoD revalidation chrome permission (exact SHA)` · errata Navigation readiness |
| **GAP-SEC-NAV** | Privilege signaling / deep-link `/gate` `/admin` discoverable; không bypass API | SECURITY SEC-GAP-NAV-01/02; Medium UX | **P1** | `web` (± middleware soft-redirect) | **Không** (gộp O02 web) | Soft-redirect anonymous `/admin|/gate` → `/auth` (UX only) |
| **GAP-SEC-CACHE** | Sau revoke, UI tenant list / tab có thể stale; API vẫn 403 | SEC-GAP-CACHE-01 | **P1** | `web` ∥ `ios` | **Không** | Clear chrome + refetch khi `MEMBERSHIP_*` 401/403 |
| **GAP-BA-O13** | O13 trang bán / subdomain / CTA đã chốt — không Task board | DECISION-LOG O13; BA §7.1 | **P1** | `web` (+ PD handoff sẵn) | **Không** | `[GTM] Web: trang bán platform O13 (CTA demo+quan tâm, VI+EN, demo giả lập)` |
| **GAP-BA-UX11** | PRD OTP/magic link vs Keycloak verified email — chưa chốt product | UX-11; redeem `UNAUTHENTICATED` | **P1** | `product-ba` | **Không** | `[BA] Chốt guest redeem auth MVP = Keycloak verified email (OTP sau MVP)` |
| **GAP-BA-AC-MATRIX** | Hầu hết O* không có AC GWT gắn board | BA §4 | **P1** | coordinator / BA docs | **Không** | Story docs: nhúng AC runtime O02/O13 trước |
| **GAP-UX10-A11Y** | A11y residual không Issue; không claim WCAG AA | UX-10; PD A1–A10 | **P2** | `web` ∥ `ios` | **Không** | `[P2] A11y residual redeem/admin/gate (axe + VO sample)` |
| **GAP-DOCS-STALE** | PRODUCTION-READINESS-* còn O06 mở / privacy 404 / D11 mở | So board + curl + DECISION-LOG | **P2** | coordinator docs | **Không** | Errata pointer → INDEX + BA artifact |
| **GAP-D12-REMAIN** | Epic #293 còn Đang làm sau child #294–#296 CLOSED — reconcile residual vs O02 | Board #293; Issues #294/#295/#296 CLOSED | **P1** board | coordinator | **Có** #293 | Reconcile AC còn lại #293; **không** re-spawn D11/#254 |
| **GAP-D13-STORE** | App Store path D13 — device smoke / submit blocked chain | #301 Đang làm; #305 Sẵn sàng; nhiều #31x Bị chặn | **P1** path | `ios` / coordinator (đã ủy quyền D13) | **Có** #301… | Tiếp wave D13 theo board — không mở O10 non-goals |
| **GAP-OPS-REVAL** | Release-verify RLS/MFA/SMTP/restore/load/on-call trên hạ tầng đích vẫn **U** trong research | Arch G17/G18/G02/G03/G05; D12 #295/#296 đã có Task đóng — reval prod tip riêng | **P0** ops (khi claim pilot) | ops + `backend` | Một phần #293/#305/#319/#320 | Giữ gate release; không miễn; không spawn feature thay ops |
| UX-01…07 / PR-01…03,05…08 | Fixture SoT, Nest BFF, privacy 404, Gate web, UAT D11, CS, Dashboard | PRODUCTION-READINESS neo cũ | — | — | Đã **Hoàn thành** / stale | **Không** spawn lại |
| O10 non-goals | Android / payment / seat / Wallet | #7 Chưa lên lịch HỦY | — | — | #7 | **Không** mở |

---

## 3. Stale map — PRODUCTION-READINESS UX-01…12

| ID | Pri gốc | Nay | Ghi chú |
| --- | --- | --- | --- |
| UX-01 | P0 | **Stale-as-open** | #254–#257 Hoàn thành; home published-first source |
| UX-02 | P0 | **Đóng source** | Không còn «Nest BFF» trên `page.tsx` |
| UX-03 | P0 | **Stale URL** | `GET https://vemoki.com/privacy` → **200** (rewrite marketing) |
| UX-04…07 | P0/P1 | **Stale board** | #236/#232/#246/#245 Hoàn thành |
| UX-08 | P1 | **Còn NV** | Venue/device — D13 #327 Bị chặn |
| UX-09 | P1 | **Path D13** | Store/Xcode evidence |
| UX-10 | P1 | **Under-tracked** | → GAP-UX10-A11Y |
| UX-11 | P1 | **Còn mở product** | → GAP-BA-UX11 |
| UX-12 | P0 policy | **Stale-as-policy** | O06 đã chốt 18/10 — execution #293 |

---

## 4. Project #3 snapshot (fact lúc INDEX)

| Status | Quan sát |
| --- | --- |
| Đang làm | #293 D12 · #301/#303/#306/#307/#309 D13 |
| Sẵn sàng | #305 D13-S2 runtime prod store |
| Chờ duyệt | **0** (WIP duyệt không đầy) |
| Bị chặn | Chuỗi D13 submit/release (#310–#312, #319–#320, #327, #331–#340…) |
| Chưa lên lịch | #7 HỦY O10 · #318 architect optional |

Open PR (cùng lúc): **#366** mobile UI cleanup (không phải O02).

---

## 5. Ready queue — wave bề rộng tối đa

> Coordinator tạo Issue rồi `worker-start --agent cursor`. Planner **không** spawn. Không mở validate-only / multi-event / metrics / Android / payment / seat / Wallet.

### 5.1 Deps thật (DAG nông)

```text
[GAP-O02-CONTRACT] architect handoff
        ↓
[GAP-O02-CONTRACT] backend MeEvents | staff-capabilities (+ OpenAPI)
        ↓
[GAP-O02-NAV] web  ∥  [GAP-O02-NAV] ios     ← cùng wave consumer
        ↓
[GAP-DOD-O02] reviewer-dod (± reviewer-security signaling) exact SHA
        ↓
docs errata PRODUCTION-READINESS Navigation (soft)
```

### 5.2 Wave A — unblocked ngay (docs / BA / board; không chờ contract)

| # | Task đề xuất | Role ID | Architecture impact | Dep |
| - | ------------ | ------- | ------------------- | --- |
| A1 | Errata PRODUCTION-READINESS-* → pointer INDEX/BA | coordinator docs | **Không** | — |
| A2 | `[BA] Chốt guest redeem auth MVP (UX-11)` | `product-ba` | **Không** | — |
| A3 | Reconcile Epic #293 residual vs child CLOSED + có/không gói O02 | coordinator | **Không** | — |
| A4 | Bổ sung checklist DoD O02/PD §6.1 vào template / `reviewer-dod.md` | coordinator docs | **Không** | — |
| A5 | (Board đã có) Tiếp D13 #305 Sẵn sàng / stories Đang làm theo WIP | per Issue | theo Issue | D13 deps |

**Loại khỏi Wave A vì hard dep / ownership full:** coding O02 consumer (cần contract); D13 Bị chặn submit chain.

### 5.3 Wave B — sau xác nhận contract (max fan-out coding)

| # | Task đề xuất | Role ID | Architecture impact | Dep |
| - | ------------ | ------- | ------------------- | --- |
| B0 | Architect handoff `o02-permission-nav` (shape capabilities) | `architect` | **Có** | — |
| B1 | BE implement MeEvents **hoặc** `/v1/me` staff-capabilities + tests | `backend` | **Có** | B0 |
| B2 | iOS ẩn/disable tab Nhân viên + deep-link deny VI | `ios` | **Có** (consume ADR-07) | B1 merge+CI |
| B3 | Web SiteNav từ capabilities + soft-redirect anonymous staff routes | `web` | **Có** | B1 merge+CI |
| B4 | DoD exact-SHA O02 + PD §6.1 dual persona UAT | `reviewer-dod` | **Không** | B2+B3 |
| B5 | Security reval privilege signaling / cache-after-revoke (optional cùng SHA) | `reviewer-security` | **Có** nhẹ | B2+B3 |

**B2 ∥ B3** sau B1 — **cấm** serialize web→ios giả.

### 5.4 Wave C — P1 song song khi slot rảnh (không tranh O02 paths nếu conflict)

| # | Task | Role | Architecture impact | Dep |
| - | ---- | ---- | ------------------- | --- |
| C1 | O13 trang bán platform (GTM) | `web` (+ PD đã có research) | **Có** nếu subdomain/cookie cutover | Soft: ADR host; **không** block O02 |
| C2 | A11y residual | `web` ∥ `ios` | **Không** | Soft |
| C3 | Ops release-verify còn U (SMTP/restore/load) khi claim pilot | ops | **Có** nếu đổi MTA/backup ADR | Ủy quyền MT |

### 5.5 Cấm trong wave

```text
❌ Re-dispatch #232 / #245 / #246 / #254–#257 / UX-01…07 như feature mới
❌ Deploy prod / store submit / EAS Cloud ngoài Issue D13 đã ủy quyền
❌ Coi SEC «PASS with known gap» = O02 đã ship
❌ Consumer web/iOS O02 trước khi contract/BE signal sẵn (trừ spike đọc-only)
❌ Mở MVP ngoài O10/O14 OUT
```

---

## 6. Architecture impact — tóm tắt Task đề xuất

| Task cluster | Architecture impact | Lý do |
| --- | --- | --- |
| O02 contract / MeEvents / capabilities | **Có** | Shared contract + OpenAPI; ADR-07 |
| O02 web/iOS nav consumers | **Có** | Consume handoff; mode switch |
| DoD/template / BA UX-11 / docs errata | **Không** | Process / product pin |
| O13 GTM host cutover | **Có** nếu đụng cookie/DNS subdomain | ADR O13 |
| Soft-redirect middleware only | **Không** (UX) | Không thay Nest authz |
| D13 store path | Theo Issue hiện có | Không mở rộng từ INDEX |

---

## 7. Việc coordinator làm tiếp

1. Tạo Issue P0 cho **GAP-O02-CONTRACT** + **GAP-O02-NAV** (ios∥web) + DoD follow-up — gắn Epic #293 hoặc Story mới dưới D12/D14; AC GWT từ BA §2 + DOD checklist D-O02/D-PD-6.1.
2. Wave A ngay (docs/BA/board) **∥** tiếp D13 dưới WIP; **không** chờ toàn bộ research.
3. Xác nhận contract B0 → `worker-start` B1 → rồi **B2∥B3** → B4(+B5).
4. Errata PRODUCTION-READINESS; supersede bằng INDEX này.
5. **Không** `Hoàn thành` #293 chỉ vì child CLOSED nếu O02 còn ngoài scope — ghi rõ residual hoặc mở Issue O02 rồi đóng phần đã đủ AC.

---

## 8. Checks planner (docs-only)

```text
git rev-parse HEAD
# a507b36a722f34ee65f19f6388254b44966568cb

gh project item-list 3 --owner hangndat --format json --limit 300
gh issue view 293|294|295|296|301|305 …
curl -sI https://vemoki.com/privacy   # HTTP/2 200

# Source: apps/mobile/src/app/(tabs)/_layout.tsx — staff Trigger luôn mount
# Artifacts: GAP-AUDIT-2026-10-18-{BA,ARCH,DOD,SECURITY}.md
# Prior: docs/plans/PRODUCTION-READINESS-*.md · D11-PRODUCTION-UX-UI.md §6.1
```

Runtime UAT / xcodebuild: **không chạy** trong phiên planner (NV).

---

## 9. Kết luận 3 câu (executive)

Đã tổng hợp BA + Architect + DoD + Security (+ PD qua D11/PRODUCTION-READINESS-UX) thành INDEX tại tip `a507b36…`: gap P0 còn lại là **O02 permission nav** (iOS tab luôn «Nhân viên», web chrome theo route, thiếu MeEvents/capabilities) trong khi API authz vẫn fail-closed. Nhiều gap PRODUCTION-READINESS/UX-01…07 và D11/#254 **stale** — không spawn lại; D12 #293 cần reconcile residual; D13 tiếp theo board. Ready queue: Wave A docs/BA ngay; Wave B architect→BE→web∥ios→DoD cho O02; Wave C O13/a11y/ops khi slot — **không** merge/Hoàn thành từ planner.
