# Mở rộng MVP — tiếp tục nghiên cứu (coordinator frame)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Epic | [#222](https://github.com/hangndat/ticket-solution/issues/222) |
| Run | `run_1246840dce98` |
| Baseline đã chốt | O10 (D7–D10) · O11/D11 UX · O12 Dashboard dictionary |
| Trạng thái | BA A/B + DoD #241 xong · tổng hợp [`MVP-EXPAND-MARKET-SYNTHESIS.md`](./MVP-EXPAND-MARKET-SYNTHESIS.md) · attendee `#234`/`#235` còn coding · **chờ user chốt** §4 tổng hợp |

## 1. Bối cảnh (đã có)

| Lát | Evidence | Trạng thái |
| --- | -------- | ---------- |
| D0–D10 | Project #3 Hoàn thành | Code/acceptance theo từng Issue; **≠** pilot ready |
| D11 UX discovery | Gói duyệt 18/10; tracker [`D11-IMPLEMENTATION-TRACKER.md`](./D11-IMPLEMENTATION-TRACKER.md) | Admin `#229` + iOS Gate `#231` đã Hoàn thành; attendee `#234`/`#235` Đang làm |
| Dashboard M11 | [`DASHBOARD-MARKET-SYNTHESIS.md`](./DASHBOARD-MARKET-SYNTHESIS.md) + O12 | Wave P1 backend PR [#242](https://github.com/hangndat/ticket-solution/pull/242) · `#241` Chờ duyệt · SHA tip `4f6530bf…` |

## 2. Wave hiện tại (fan-out)

| # | Việc | Role | Dispatch | Artifact / PR |
| - | ---- | ---- | -------- | ------------- |
| 1 | DoD + security EventReport O12 | `reviewer-dod` + `reviewer-security` | `ctx_99496b694d34` | `docs/reviews/D11-EVENTREPORT-O12-DOD.md` |
| 2 | BA day-of ops / resolution desk | `product-ba` | `ctx_093a43c7ad89` | `docs/plans/MVP-EXPAND-BA-A-DAYOF-OPS.md` |
| 3 | BA residual gaps sau D11/O12 | `product-ba` | `ctx_a914057036e4` | `docs/plans/MVP-EXPAND-BA-B-RESIDUAL-GAPS.md` |
| 4 | Web attendee | `web` | `ctx_b30eba237c63` | Issue `#234` |
| 5 | iOS attendee | `ios` | `ctx_5e9d0638d489` | Issue `#235` |

Không serialize BA → coding: research A/B **song song** attendee đã được duyệt D11. Coding mới từ BA A/B **chỉ sau** user duyệt tổng hợp.

## 3. Giả thuyết nghiên cứu (chưa chốt)

Thị trường day-of (Ticket Tailor / Humanitix docs · pattern “scanner vs resolution desk”) gợi ý:

1. **Scanner một việc:** quét hợp lệ → cho qua; lỗi lặp → chuyển bàn xử lý — khớp Vemoki Scanner vs Supervisor/CS, không cần “command center” enterprise.
2. **Escalation có owner nhận:** không đóng exception khi chỉ “đã gửi radio” — có thể ảnh hưởng copy/UX Supervisor + deep-link CS (O12 P3), không bắt buộc workflow engine.
3. **Dashboard = tín hiệu mô tả:** không tự đổi capacity/check-in rules — khớp O12 watermark + fail-closed.
4. **Reject có lý do + cổng:** P1 contract đang mang `rejectByReason`; drilldown theo cổng có thể Wave sau nếu thiếu.

Residual (giả thuyết, chờ BA-B): Owner invite (D11 OUT), O06 retention trước dữ liệu thật, multi-event Owner (O12 defer), validate-only lookup, auto-refresh sau budget.

## 4. Non-goals (giữ)

Android · payment/refund/transfer · seat · Wallet · RFID/SmartBadge · revenue/UTM/CRM BI · EAS Cloud · deploy/store không ủy quyền.

## 5. Bước kế (coordinator)

```text
1. Drain mailbox → settle reviewer #241 → merge khi PASS + CI xanh (ủy quyền Epic)
2. Khi BA A + BA B có artifact → viết MVP-EXPAND-MARKET-SYNTHESIS.md + hỏi user chốt
3. O12 Wave web P2/P3 (KPI UI + việc cần làm) chỉ sau merge contract #242
4. D11 #232 web Gate fallback khi audit còn gap; #236 milestone sau đủ Stories
```

## 6. Phân biệt

research complete ≠ user duyệt mở rộng ≠ code complete ≠ acceptance ≠ pilot ready.
