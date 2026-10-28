# VCX-940 — Verify-first: iOS Staff Gate (route × state × policy)

| Trường | Giá trị |
| --- | --- |
| Issue | [#940](https://github.com/hangndat/ticket-solution/issues/940) · Epic [#914](https://github.com/hangndat/ticket-solution/issues/914) · Story [#919](https://github.com/hangndat/ticket-solution/issues/919) · Planning `S4-T02` / G-13 |
| **sourceSHA** | `357ec5c08b43b514391c59d5c0715e3ae406a00e` (`git rev-parse HEAD` trên worktree `vcx-940-staff`) |
| Persona / process | **Zico** (`company/employees.json`) · role `ios` · verify-first **chỉ tài liệu + checks** — không sửa `apps/mobile` |
| Mẫu tham chiếu | VD-06 Staff Gate [#884](https://github.com/hangndat/ticket-solution/pull/884) · evidence lịch sử `apps/mobile/VD06-ISSUE-879-EVIDENCE.md` |
| Fixture runtime | [#925](https://github.com/hangndat/ticket-solution/issues/925) persona/API matrix **done** (merged); sim OIDC **scanner** chưa đạt — xem [runtime probe](./vcx-940-ios-staff-runtime.md) |
| **actualSHA** (runtime follow-up) | `a70c9a3e1824f0b24b2f863adaeca3ecd8c34e76` · build/sim probe Zico 2026-10-26 — **không** thay `sourceSHA` checks gốc |
| Thiết bị thật | **Blocker B-03** (roadmap §3) — camera/QR/offline thật. **iOS VoiceOver ngoài phạm vi #914 / quyết định owner** |

## O25 / invariant (không đánh giá PASS ngoài scope)

- Không đổi `classifyScan`, reconcile race, admission contract (ADR-18). Copy/UI trong `gate-outcome-copy.ts` ghi rõ UI-only `admissionKind`.
- Simulator **không** chứng minh camera hardware hay offline đa thiết bị.

## Persona & workspace

| Persona | Điều kiện vào Staff workspace | Route chính |
| --- | --- | --- |
| Staff scanner / supervisor | `identity.status === 'verified'` **and** `MeEvents.staffEligible === true` **and** event có `gate.confirm` (`staff-workspace.ts`, `staff-gate-events.ts`) | Tabs `staff-scan` (mặc định), `staff-manual`, `staff-history` |
| Attendee | `staffEligible !== true` hoặc chưa `resolved` | Tabs `(events)`, `my-tickets`, `account` |
| Staff tài khoản | Toolbar cổng → root stack | `/staff-account` (`staff-account-route.ts`) — ngoài NativeTabs |

Eligibility **không** persist `staffEligible: true` SecureStore (`staff-eligibility.ts` § comment) — revoke phải fail-closed tab.

---

## Ma trận route × trạng thái

**Ký hiệu:** **Có** = code/copy/test; **Nghi vấn** = thiếu runtime/sim; **Thiết bị** = cần máy thật; **N/A** = route không áp dụng.

### Cột route (staff)

| Route / màn | File / segment | Vai trò |
| --- | --- | --- |
| `/(tabs)/staff-scan` | `screens/staff-scan.tsx` | Camera + `StaffGateScanStatusPanel` + sticky ops |
| `/(tabs)/staff-manual` | `staff-gate-manual-entry.tsx` + confirm sheet | Nhập mã + `StaffManualConfirmSheet` |
| `/(tabs)/staff-history` | `staff-history.tsx` + history sheet | Lịch sử thiết bị |
| `/staff-account` | `app/staff-account/**` | Đăng xuất / privacy (staff chrome) |
| Gate tab guard | `staff-gate-tab-guard-policy.ts` | `loading` → `redirect-guest` / `redirect-deny` / `ready` |

### Hàng: ngữ cảnh tenant / event

| State | staff-scan / sticky | Evidence |
| --- | --- | --- |
| **Chưa có event gate.confirm** | `StaffGateNoEventState` | `staff-gate-empty-state.tsx`; scope `pickStaffGateScope` (`staff-gate-events.ts:38–48`) |
| **Đã chọn event** | `StaffGateOpsSticky` title = `eventName`; picker `StaffEventPicker` | `staff-gate-ops-sticky.tsx:55–56`; workspace `selected: StaffGateScope { tenantId, eventId, name }` |
| **Đổi event** | Flush ops/session per scope key `tenantId::eventId` | `staff-gate-workspace.ts` `flushScopeIntoWorkspace` |
| **Phiên cổng** | Strip «Phiên cổng · {shortId}» | `staff-gate-ops-sticky.tsx` + `shortId` |
| **Runtime hiển thị đúng tên fixture** | **Nghi vấn** | Cần OIDC scanner persona #925 + API `GET /v1/me/events` |

### Hàng: kết quả quét (online `GateOp.phase`)

| Phase / outcome | UI tone (không admit?) | Evidence |
| --- | --- | --- |
| **idle** | Chờ mã quét | `presentGateOutcome(null)` (`gate-outcome-copy.ts:50–58`) |
| **holding / confirming** | unknown, assertive — «Chưa rõ — không cho vào» | `gate-outcome-copy.ts:73–84`; sticky feedback `staff-gate-scan-feedback.ts:29` |
| **admitted** (fresh) | admit «Được vào» | test `gate-outcome-copy.test.ts` |
| **admitted** (already) | admit title «Vé đã được sử dụng» — không tạo lượt mới | `gate-outcome-copy.ts:109–121` |
| **denied** | deny «Không cho vào» | `gate-outcome-copy.ts:87–94` |
| **unknown** | unknown, assertive | test `queued and unknown never use admit tone` |
| **queued** (offline local) | unknown — «Chờ đồng bộ — Chưa xác nhận vào cổng» | `gate-outcome-copy.ts:61–70`; **không** green admit |
| **recorded** (GET receipt) | unknown sticky | `gate-outcome-copy.ts:97–106` |
| **Camera toast** | Chỉ terminal admit flash | `shouldShowCameraToast` (`staff-gate-scan-feedback.ts`) |

### Hàng: confirm (manual + supervisor token)

| State | UI | Evidence |
| --- | --- | --- |
| **Manual parse OK, chưa server** | Header «Mã đọc được, chưa xác minh» | `staff-manual-confirm-copy.ts` |
| **Confirm sheet admit** | `gate-manual-confirm-admit` testID | `staff-manual-confirm-sheet.tsx` |
| **Phase confirming** | Cùng sticky unknown như holding | `presentGateOutcome` + `supervisor.test.ts` fixture `phase: 'confirming'` |

### Hàng: pending / conflict (offline queue)

| `OfflineLocalStatus` | Copy / tone | Cho vào? |
| --- | --- | --- |
| **pending** | «Chờ đồng bộ — Chưa xác nhận vào cổng» · tone unknown | **Không** (`presentQueueStatus` `gate-outcome-copy.ts:153–160`) |
| **syncing** | Đang gửi — unknown | **Không** |
| **conflict** | Queue banner «Có xung đột đồng bộ» deny | **Không** (`offline-queue.test.ts` banner; `presentQueueStatus` case `conflict`) |
| **duplicate** | Không coi là admit mới | `gate-outcome-copy.ts:177+` |
| **CONFLICT replay** | `localStatus: 'conflict'`, `conflictCount` | `offline-queue.test.ts` «replay maps CONFLICT_LOST» |

Sticky queue attention: `queueSnap.pendingCount > 0 || conflictCount > 0` (`staff-gate-workspace-context.tsx:1144`).

### Hàng: logout / revoke policy

| Sự kiện | Hành vi client | Evidence |
| --- | --- | --- |
| **Logout explicit** | `staffEligibility.reset()`; `beginDurableGateLogout` purge workspace SecureStore; wallet cache gates | `wallet-logout.ts:30–37`; tests `wallet-logout.test.ts` |
| **Logout navigation** | Từ `/staff-account` hoặc staff workspace → `guest-replace` | `post-logout-plan.ts`; `post-logout-plan.test.ts` |
| **Gate tab khi signed-out** | `resolveStaffGateTabPhase` → `redirect-guest` trước eligibility | `staff-gate-tab-guard-policy.ts:23–24` |
| **MEMBERSHIP_REVOKED / 401** | `isMembershipAuthzDenial`; store `reset()` abort in-flight MeEvents | `staff-eligibility.test.ts`; `gate-scan.test.ts` «MEMBERSHIP_REVOKED on open session» |
| **Late MeEvents sau revoke** | Không restore tab | `StaffEligibilityStore reset aborts in-flight` test |
| **Revoke giữa ca — scan tiếp** | API 403 + `membershipAuthzDenied`; eligibility fail-closed | **Có** (unit); **Nghi vấn** E2E simulator #925 |
| **Dữ liệu cục bộ sau logout** | Purge gate workspace v2 key; không resurrect late write | `staff-gate-workspace-store-core.test.ts`; `staff-gate-owned-snapshot.test.ts` |

---

## Acceptance criteria (#940)

| AC | Verify-first | Ghi chú |
| --- | --- | --- |
| Ma trận state + evidence simulator | **Chưa đạt acceptance** — ma trận + unit **đủ review**; sim OIDC/scanner + screenshot **chưa đủ AC** | Unit alone ≠ AC; partial sim `staff@` — [runtime](./vcx-940-ios-staff-runtime.md) |
| Revoke giữa ca: chặn + policy local | Code+test **Có**; runtime revoke **chưa chạy** (blocker acceptance, không optional) | Không reset realm / MFA; F-940-01 |

---

## Findings (verify-first — không fix code)

| ID | Mức | Chặn AC? | Mô tả |
| --- | --- | --- | --- |
| F-940-01 | **high** | **Có** | Scanner OIDC #925 + Staff scan/revoke runtime chưa đạt: issuer **8080** (API JWKS) vs persona **8180** (ui869dev) — `scanner.fixture@…` không login; partial sim chỉ `staff@` — [runtime](./vcx-940-ios-staff-runtime.md) |
| F-940-02 | **high** | **Có** (acceptance) | Thiết bị thật camera/offline (**B-03**). Dispatch runtime: `xcodebuild` Release sim **PASS**; Orca sim **partial** — không thay B-03 |
| F-940-03 | low | Không | `already-checked-in` dùng tone `admit` (xanh) theo VD-06 — đúng «cho qua theo kết quả đã có», không phải fresh admit |

---

## Checks (sourceSHA `357ec5c08b43`)

| Check | Kết quả |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --filter @ticket/contracts build` | PASS |
| `cd apps/mobile && pnpm test` | **472** tests PASS |
| Subset staff/gate (explicit files) | **66** tests PASS (`staff-regression`, `gate-outcome-copy`, `offline-queue`, `wallet-logout`, `staff-eligibility`, …) |
| `pnpm typecheck` (mobile) | PASS |
| `pnpm lint` (mobile) | PASS (8 warnings pre-existing) |
| `expo prebuild` / `xcodebuild` @ actualSHA | **PASS** Release sim D11-Gate-UAT — [runtime](./vcx-940-ios-staff-runtime.md) · tail [`vcx-940-ios-build-tail.txt`](./vcx-940-ios-build-tail.txt) |
| Orca sim Staff chrome (partial) | **Partial** — MFest context + tabs; không scanner #925 OIDC |

### actual vs expected (tóm tắt)

| Khu vực | Expected (G-13 / #940) | Actual @ SHA |
| --- | --- | --- |
| Tenant/event visible in chrome | Tên event + picker + session strip | **Có** (component wiring + scope model) |
| Scan outcomes distinct | pending/unknown/conflict không admit | **Có** (`gate-outcome-copy` + offline queue tests) |
| Confirm manual | Preview + sheet trước server | **Có** (copy + testIDs) |
| Logout/revoke | Fail-closed tab + purge | **Có** (logout + eligibility + gate-scan tests) |
| Simulator proof | Screens + OIDC flow scanner #925 | **Partial** — build OK; OIDC scanner **blocked** B-OIDC-UI869; screenshots gitignored |
| Device camera | QR live | **Thiết bị** (owner user) |

---

## Gap repro (runtime — coordinator route sau)

1. Stack UI869: API `127.0.0.1:3498`, OIDC align **8180** (compose) với `OIDC_ISSUER` API — **không** dùng `4111`/`18091` chưa xác minh (`docs/ops/UI925-LOCAL-PERSONA-FIXTURES.md`).
2. Đăng nhập persona `scanner`; mở `/(tabs)/staff-scan` — xác nhận event title khớp seed.
3. Quét/ manual một mã fixture; quan sát APPLIED vs DUPLICATE vs CONFLICT (server-driven).
4. Revoke membership (API/admin) giữa ca — xác nhận tab staff đóng và scan tiếp 403 (không sửa client trước khi có repro).

---

## Việc còn lại

1. **B-OIDC-UI869** (owner stack): API `:3498` + mobile issuer khớp Keycloak có `scanner.fixture@…`; rồi Orca sim OIDC scanner + revoke giữa ca (không reset realm).
2. Phiên thiết bị thật (camera) — owner user, Zico evidence (**B-03**).
3. Reviewer James `dod+sec+ux` trên SHA PR docs (≠ implementer).

**Verdict (cập nhật runtime):** Ma trận + unit **đủ review**; **acceptance chưa đạt** — F-940-01/02 **chặn AC** (không optional). Runtime packet: [`vcx-940-ios-staff-runtime.md`](./vcx-940-ios-staff-runtime.md). Không sửa product code mobile trên dispatch này.
