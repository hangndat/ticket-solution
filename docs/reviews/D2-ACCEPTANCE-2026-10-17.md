# D2 — Báo cáo tiến độ nghiệm thu (2026-10-17)

Ngày ghi nhận: **2026-10-17** (theo lịch coordinator / user; không gắn số latency giả).  
Parent: [#3](https://github.com/hangndat/ticket-solution/issues/3) — `[D2] Nhận vé xuyên web và app` — Project Status: **Đang làm** (chưa Hoàn thành).  
Nguồn đối chiếu: GitHub Issues/PR/Actions live + review độc lập local (coordinator worktree); [ROADMAP](../ROADMAP.md), [PRD](../PRD.md), [TECHNICAL-DESIGN](../TECHNICAL-DESIGN.md), [DECISION-LOG](../DECISION-LOG.md).

**Kết luận đợt:** D2 **chưa đóng**. Backend (#14) + QA độc lập (#17) + Web (#15) đã đạt DoD tích hợp trên `main`. Mobile (#16) còn **cổng merge + UAT xuyên suốt** — chưa full PASS. **Không** mở D3. **Không** production publish. **Không** Expo/EAS Cloud Build.

---

## 1. Phạm vi D2 (nhắc nhanh)

| Hạng mục | Ghi chú |
| --- | --- |
| Mã / quota / issue / ticket / outbox | Backend Nest + PostgreSQL transaction |
| Web redeem | Form đổi mã → BFF → API thật (Keycloak) |
| iOS ví | My Tickets, QR **display**, cache offline tối thiểu |
| QA trước D3 | Contention quota, idempotency, terminal rejection durable |

**Ranh giới kỹ thuật (không nhầm Gate):** payload QR trên app là **`ticket.display`** (hiển thị / offline wallet) — **không** phải JWS Gate check-in (D3). Offline chỉ display; không check-in offline.

---

## 2. Bảng trạng thái Issue / Project (live 2026-10-17)

| Issue | Tiêu đề | GitHub | Project #3 | Ghi chú |
| --- | --- | --- | --- | --- |
| [#2](https://github.com/hangndat/ticket-solution/issues/2) | [D1] Quyết định & Identity | **CLOSED** | Hoàn thành | Keycloak P4; D1 đã đóng |
| [#14](https://github.com/hangndat/ticket-solution/issues/14) | Backend: mã/quota → issue → ticket → outbox/email | **CLOSED** | Hoàn thành | PR [#29](https://github.com/hangndat/ticket-solution/pull/29) merge `3921f2e929a3b6431187b44b3276036cc70a946f` |
| [#17](https://github.com/hangndat/ticket-solution/issues/17) | Kiểm thử độc lập quota/idempotency trước D3 | **CLOSED** | Hoàn thành | Fix PR [#32](https://github.com/hangndat/ticket-solution/pull/32) |
| [#15](https://github.com/hangndat/ticket-solution/issues/15) | Web: form đổi mã, verify, success/ticket | **CLOSED** | Hoàn thành | PR [#30](https://github.com/hangndat/ticket-solution/pull/30) |
| [#16](https://github.com/hangndat/ticket-solution/issues/16) | iOS: My Tickets, QR, cache; đồng bộ identity | **OPEN** | Chờ duyệt | PR [#31](https://github.com/hangndat/ticket-solution/pull/31) **vẫn OPEN** |
| [#3](https://github.com/hangndat/ticket-solution/issues/3) | Parent D2 | **OPEN** | **Đang làm** | Chưa Hoàn thành đợt |

---

## 3. Backend + QA #17 — đã đạt

### 3.1 Fix terminal rejection (PR #32)

| Trường | Giá trị |
| --- | --- |
| PR | [#32](https://github.com/hangndat/ticket-solution/pull/32) — **MERGED** |
| Final feature SHA | `fb3da05193008c904e57f38a69b28a4ccf75dda5` |
| Merge commit trên `main` | `7cc05d056f3091794a70decba7084be4b34af966` |
| Merged at (UTC) | `2026-10-16T16:58:33Z` |
| Independent review | **PASS** (reviewer ≠ implementer) — terminal rejection durable + same-key replay + race reconcile |
| Local DB checks (reviewer) | `pnpm --filter @ticket/backend test:db` → **tests 4 / pass 4 / fail 0** (Postgres ephemeral do `test:db`, không shared UAT DB) |
| CI trên merge commit | [run 38936102204](https://github.com/hangndat/ticket-solution/actions/runs/38936102204) — **success** (`check` + `database-isolation`) |
| Provenance review | Artifact local coordinator (không publish remote): `ticket-d2-backend-fix17-review.md` |

**Hạn chế đã ghi:** lúc chốt review, CI PR còn IN_PROGRESS; sau đó merge + CI merge **success** (đã xác minh lại qua `gh`). Reviewer không tự merge/mark Hoàn thành.

### 3.2 Backend #14 (baseline D2 API)

| Trường | Giá trị |
| --- | --- |
| PR | [#29](https://github.com/hangndat/ticket-solution/pull/29) — **MERGED** |
| Merge commit | `3921f2e929a3b6431187b44b3276036cc70a946f` |
| Issue | [#14](https://github.com/hangndat/ticket-solution/issues/14) CLOSED / Project Hoàn thành |

---

## 4. Web #15 — đã đạt (CI merge đã xanh)

| Trường | Giá trị |
| --- | --- |
| PR | [#30](https://github.com/hangndat/ticket-solution/pull/30) — **MERGED** |
| Final feature SHA | `8c15e58dd1b82a01bc0f38e1d49beaa22701bb71` (gồm `435147ae` poll busy + reuse idempotency-key) |
| Merge commit trên `main` | `64242d1e078a5e95c116de6206909917e682f53f` |
| Merged at (UTC) | `2026-10-16T17:11:06Z` |
| Independent review | **PASS** — network error không kẹt poll; max duration; `finally`; abort/unmount stale; reuse idempotency-key khi outcome unknown; exhausted/used |
| Suite test (implementer, cùng head) | `pnpm --filter @ticket/web test` → **19/19 PASS** |
| Targeted (reviewer) | `tsx --test tests/redeem-poll.test.ts tests/redeem-messages.test.ts` → **11/11 PASS** |
| CI trên merge commit | [run 38937723644](https://github.com/hangndat/ticket-solution/actions/runs/38937723644) — **success** (`check` + `database-isolation`) — đã `gh run view` xác nhận (không còn “đang chạy”) |
| Issue / Project | [#15](https://github.com/hangndat/ticket-solution/issues/15) CLOSED / Hoàn thành |
| Provenance review | Artifact local: `ticket-d2-web-fix-review.md` |

### 4.1 UAT web (Keycloak thật) — tóm tắt không secret

Redeem attendee qua BFF/API thật (Keycloak local): HTTP redeem **201**; list vé owner Nest **200** / BFF **200**; đúng **1** ticket `ACTIVE`. Evidence nằm ở artifact local coordinator (`ticket-d2-e2e-evidence-uat004503/web-redeem-attendee.json`) — **không** đính kèm token/user raw/screenshot lên repo; **không** dùng đường dẫn `/tmp/...` như remote artifact bền vững.

**Hạn chế web đã ghi:** `test:routes` / full Next start không nằm trong review; một số worktree symlink từng không resolve Turbopack `next` (limitation local) — CI remote trên PR/merge đã xanh.

---

## 5. Mobile #16 — review code PASS; UAT + merge chưa đóng

| Trường | Giá trị |
| --- | --- |
| PR | [#31](https://github.com/hangndat/ticket-solution/pull/31) — **OPEN** |
| Head SHA | `e4752161240eeff396118d35f026bfa98f34ce9d` |
| Independent review | **PASS** — epoch/race A→B, logout cleanup, offline cold start fail-closed, 401/403 clear, account switch, QR owner guard |
| Checks local (implementer; reviewer đối chiếu SHA) | `pnpm test` **56/56**, typecheck, lint, `expo export --platform ios` PASS |
| CI trên PR head | [run 38931597664](https://github.com/hangndat/ticket-solution/actions/runs/38931597664) — **success** (`check` + `database-isolation`) |
| Issue / Project | [#16](https://github.com/hangndat/ticket-solution/issues/16) OPEN / **Chờ duyệt** |
| Provenance review | Artifact local: `ticket-d2-ios-fix-review.md` |

### 5.1 UAT iOS (tiến độ từng phần — chưa full PASS)

UAT worker (dispatch `ctx_4244d5648808`) + follow-up coordinator (2026-10-16 UTC): runtime **Expo Go SDK 58** trên simulator riêng (`exp://` callback) — **không** gọi đây là native binary / TestFlight UAT.

**Đã xác nhận (partial):**

- Đăng nhập Keycloak → `SessionBoundary` verified, cùng `userId` với web redeem (không ghi UUID đầy đủ vào repo).
- Cùng vé `ACTIVE` hiện trong list/detail + **Display QR** (`ticket.display`).
- Logout từ My Tickets rồi relaunch: signed-out, **không** còn vé A.

**Chưa hoàn tất (worker chưa chạy / chưa PASS):** account switch sang user B; offline cold start; email sandbox Mailpit. Full UAT report vẫn đang chờ. **Chưa** full PASS cổng D2.

**Chính sách build:** chỉ local Expo prebuild + Xcode/`xcodebuild` cho native; **cấm** Expo/EAS Cloud Build. Evidence UAT này là Expo Go — ghi rõ hạn chế runtime.

---

## 6. Cổng D2 còn mở (trước khi Hoàn thành đợt)

1. Merge PR [#31](https://github.com/hangndat/ticket-solution/pull/31) vào `main` sau DoD (review đã PASS; cần UAT đủ tiêu chí Issue #16 + CI xanh trên commit tích hợp).
2. UAT xuyên web→app: QR `ticket.display`, account switch, offline cold start, email sandbox — evidence đủ, không chỉ `worker_done`.
3. Parent [#3](https://github.com/hangndat/ticket-solution/issues/3) → Hoàn thành chỉ khi các mục trên đạt.
4. **D3** (Gate / check-in) giữ **Chưa lên lịch** / không mở business Gate cho đến khi D2 gate đóng.

---

## 7. SHA neo trên `main` (tại thời điểm báo cáo)

| Vai trò | SHA đầy đủ |
| --- | --- |
| `main` tip (sau PR #30) | `64242d1e078a5e95c116de6206909917e682f53f` |
| Merge PR #32 (QA17 fix) | `7cc05d056f3091794a70decba7084be4b34af966` |
| Feature #32 | `fb3da05193008c904e57f38a69b28a4ccf75dda5` |
| Feature #30 | `8c15e58dd1b82a01bc0f38e1d49beaa22701bb71` |
| PR #31 head (chưa merge) | `e4752161240eeff396118d35f026bfa98f34ce9d` |

Đối chiếu lệnh gợi ý (coordinator): `gh pr view 30|31|32 --json state,mergeCommit,headRefOid,statusCheckRollup` · `gh run view 38936102204|38937723644|38931597664 --json conclusion,url,headSha`.

---

## 8. Những gì báo cáo này cố ý không làm

- Không tuyên bố D2 **Hoàn thành**.
- Không mở / schedule D3.
- Không copy secret, token, credentials, PII, hoặc screenshot vào git.
- Không đánh dấu QR display = Gate JWS.
- Không yêu cầu rebuild product cho sync docs này.
