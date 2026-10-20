# Issue #608 — root cause (gate session / history empty)

**Date:** 2026-10-20  
**Worker:** Orca task `task_f50756dc93a0`  
**Scope:** Điều tra (code + prod DB audit) — fix nhỏ client trong PR riêng  
**UAT evidence:** `docs/reviews/MPR-DEXTER-MOCKUP-UAT-2026-10-20.md` § Verify #600 cuối (Thanh)

## Verdict

**Root cause (chính xác):** `runScan` default `createId` gọi `crypto.randomUUID()`, nhưng Hermes **không có** global `crypto`. Sau khi API `/sessions` + `/reservations` đã thành công trên server, client throw khi tạo `GateOp.id` → `submitScan` không `persist` / không `applyScanResult` → UI: Lịch sử 0, 「Chưa mở phiên cổng」, không toast. Server vẫn ghi `gate.session.open` + `gate.reject`.

**Không phải:** thiếu membership staff cho MFest/Aurora; mạng; early-return trước `runScan` khi scope đã chọn; bug mở phiên riêng lúc chọn scope (không có API mở phiên lúc chọn scope).

## Evidence

### Client code

| Fact | Location |
| --- | --- |
| 「Chưa mở phiên cổng」 = `!sessionId` | `staff-gate-chrome.tsx` `hasSession` |
| Chọn scope **không** gọi `/sessions` | `selectGateScope` chỉ slice workspace |
| Mở phiên chỉ trong `runScan` khi `!staffSessionId` | `gate-scan.ts` |
| Default createId = `crypto.randomUUID()` (vỡ Hermes) | `gate-scan.ts` (~L266 trước fix) |
| Hermes-safe helper đã có | `lib/random-id.ts` (comment: Hermes has no global crypto) |
| `submitScan` try/finally **không catch** | throw → không toast, không ops |
| Toast chỉ mount tab Scan | `staff-scan.tsx` `StaffGateScanToast` |
| History cần `recordedAt` + match scope | `buildDeviceScanHistory` |

### Production DB (read-only) — cửa sổ UAT Thanh ~14:49–14:58 UTC

UUID khớp artifact UAT:

| Time (UTC) | Audit | Ticket / session |
| --- | --- | --- |
| 14:51:05 | `gate.session.open` Aurora | session `83b633a4-…` |
| 14:51:06 | `gate.reject` | ticket `a088c4f7-6048-49b2-995d-981521c81dae` (= `thanh-601-type`) |
| 14:54:14 | `gate.session.open` MFest | session `d402d403-…` |
| 14:54:14 | `gate.reject` | ticket `d3cdaefb-09cc-4af9-b9a2-f527a25cec5e` (= `thanh-104-typed`) |

Actor: `staff@example.com` user `3aa9e81a-…` (KC subject thật). Membership + `gate.confirm` trên MFest/Aurora **đủ**. (Có user fixture trùng email `f15f7852-…` / subject `d9-demo-staff-subject-fixture` — không phải actor UAT.)

### Ảnh hưởng

- **Chặn admit/deny thật trên mobile UI** (kết quả server không được apply vào state) — không chỉ cosmetic lịch sử.
- Server vẫn mở session + reject/admit đúng; web gate (nếu dùng `crypto` browser) không cùng bug.
- Cùng class bug: `offline-queue.ts` default `createId` (đã sửa cùng PR).

## Fix (PR, không merge trong worker này)

1. `runScan` / offline queue: default `createId` → `randomId()`.
2. Regression test: deny sau open session **không** inject `createId`.
3. Re-verify Dexter: Manual UUID giả → Lịch sử ≥1 deny + Scan 「Đã mở phiên cổng」 + toast (trên tab Scan).

## Data note (không phải RC #608)

Hai hàng `users` cùng email `staff@example.com` — dọn fixture khi có slice data riêng; không chặn flow UAT với subject KC thật.
