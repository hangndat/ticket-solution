# Mở rộng MVP — Tổng hợp nghiên cứu (coordinator)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Epic | [#222](https://github.com/hangndat/ticket-solution/issues/222) |
| Run | `run_1246840dce98` |
| BA A | `ctx_093a43c7ad89` → [`MVP-EXPAND-BA-A-DAYOF-OPS.md`](./MVP-EXPAND-BA-A-DAYOF-OPS.md) |
| BA B | `ctx_a914057036e4` → [`MVP-EXPAND-BA-B-RESIDUAL-GAPS.md`](./MVP-EXPAND-BA-B-RESIDUAL-GAPS.md) |
| Frame | [`MVP-EXPAND-RESEARCH-CONTINUATION.md`](./MVP-EXPAND-RESEARCH-CONTINUATION.md) |
| O12 P1 | PR [#242](https://github.com/hangndat/ticket-solution/pull/242) **merged** · merge SHA `5a24f4beece3c2c95ed4ddfa071ba59b3466e1c2` · tip reviewed `4f6530bf…` · DoD [`D11-EVENTREPORT-O12-DOD.md`](../reviews/D11-EVENTREPORT-O12-DOD.md) **PASS with known gap** |
| Trạng thái | **Đã duyệt O14** (2026-10-18) — xem [DECISION-LOG O14](../DECISION-LOG.md#o14--phê-duyệt-mở-rộng-mvp-day-of--residual-18102026). Coding theo §2 + O14; không tự mở OUT |

Hai BA chạy độc lập. File này tổng hợp sau khi cả hai artifact có trên disk.

---

## 1. Kết luận chung (A ∩ B)

1. **D11 UX đang chạy đúng hướng** (Gate + attendee) — không liệt lại như gap mới; idle-fill `#232` khi slot web rảnh.
2. **O12 Wave P1 backend đã integrate** — consumer web KPI (`asOf`, check-in, reject, emailNeedsCs, quotaRemaining) = Task `web` riêng, không sửa AC `#229`.
3. **Day-of ops chưa đóng gói:** Scanner lane vs resolution desk vs Supervisor escalation vs Manager “command center” — học pattern ops, không copy enterprise suite / RFID / badge.
4. **Pilot path residual rõ nhất:** O06 chưa chốt · privacy URL live · Owner invite HTTP prod (CSRF gap D4) — tách khỏi code complete D11.
5. **Giữ REJECT:** Android / payment / seat / Wallet / validate-only tự mở / multi-event overview trong Wave P1 / metrics product tự mở.

---

## 2. Ưu tiên hợp nhất (proposed)

| # | Việc | Nguồn | Ownership | Ghi chú |
| - | ---- | ----- | --------- | ------- |
| P0 | Hoàn tất D11 đang chạy (`#230`–`#236`) | B-P0-D · A §3 | web ∥ ios | Đang làm `#234`/`#235` |
| P0 | Chốt O06 retention/region/SLA tối thiểu | B-P0-B | user/product | Pilot blocker |
| P0 | Privacy host 200 + nội dung duyệt (khi ủy quyền) | B-P0-C | web + deploy ủy quyền | Store/public trust |
| P0 | Invite Owner HTTP revalidate (sau/∥ web slot) | B-P0-A · A resolution CS | web | Tránh tranh Dispatch với `#234` |
| P1 | Web consumer EventReport O12 (KPI + watermark + deep-link việc cần làm) | A command center · B-P1-C · O12 P2/P3 | web | **Hard dep:** merge `#242` ✓ |
| P1 | CS/email recovery UX (timeline, DELIVERED≠ACCEPTED) | B-P1-B · A CS | web | API sẵn |
| P1 | Wire online `gate.reject` audit (known gap DoD) | DoD `#241` | backend | Completeness metric |
| P2 | Multi-event Owner overview | B-P2-A · O12 defer | web ± BE | User chốt IA trước |
| P2 | Manual lookup / validate-only | A resolution · B-G6 | BE+ios+web | **OUT** đến user mở |
| — | Revenue / RFID / Wallet / Android | A+B reject | — | **Không mở** |

---

## 3. Roadmap đề xuất (sau user duyệt §4)

```text
Now     D11 attendee #234∥#235 → #232 web Gate → #236 UAT
∥       (sau user) docs: đảm bảo O12 trên main DECISION-LOG
Next    web: Dashboard O12 consumer (P1) ∥ optional CS UX
Next    backend: online reject audit completeness
Pilot    invite revalidate khi slot web rảnh + user chọn Q2
Later   multi-event · validate-only · metrics — chỉ nếu user mở
Pilot   O06 + privacy + device UAT — độc lập code complete
```

---

## 4. Quyết định đã chốt (O14 — 2026-10-18)

| # | Chốt |
| - | ---- |
| 1 | O06 tạm: **không ingest PII ngoài demo** đến khi chốt số |
| 2 | Invite Owner: **sau** `#234` (không tranh slot web attendee) |
| 3 | Dashboard web O12 consumer: **mở** sau/ khi slot `web` rảnh |
| 4 | CS email UX: **gộp đợt** khi slot `web` rảnh |
| 5 | Validate-only / resolution desk / multi-event / metrics: **giữ OUT** |
| 6 | Privacy: **không** deploy chỉ vì O14 — cần ủy quyền + nội dung |
| 7 | BE online `gate.reject` audit: **ưu tiên ngay** |

---

## 5. Artifact index

| Artifact | Path |
| -------- | ---- |
| BA A day-of | `docs/plans/MVP-EXPAND-BA-A-DAYOF-OPS.md` |
| BA B residual | `docs/plans/MVP-EXPAND-BA-B-RESIDUAL-GAPS.md` |
| Coordinator frame | `docs/plans/MVP-EXPAND-RESEARCH-CONTINUATION.md` |
| Tổng hợp này | `docs/plans/MVP-EXPAND-MARKET-SYNTHESIS.md` |
| DoD EventReport | `docs/reviews/D11-EVENTREPORT-O12-DOD.md` |
| Dashboard O12 trước đó | `docs/plans/DASHBOARD-MARKET-SYNTHESIS.md` |

Proposed ≠ approved ≠ code/acceptance/pilot ready.
