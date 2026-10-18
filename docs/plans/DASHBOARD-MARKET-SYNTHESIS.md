# Dashboard Vemoki — Tổng hợp nghiên cứu thị trường (coordinator)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Tiếp nối session | `structured-agent-session-codex_9a523780_81b6_4da5_b887_0b39ca28720f` (đã đóng bởi Orca) |
| Worker BA A | `term_5615e198-3b6f-466d-9f07-08a695b9e998` → `docs/plans/DASHBOARD-BA-A-MARKET-RESEARCH.md` |
| Worker BA B | `term_f68ca08a-b4d3-48d8-a7f9-2f6705a80a2d` → `docs/plans/DASHBOARD-BA-B-MARKET-RESEARCH.md` |
| Nghiên cứu nội bộ trước spawn | `docs/plans/DASHBOARD-RESEARCH.md` |
| Source HEAD đối chiếu | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| Trạng thái | **Đã chốt O12** (2026-10-18). Wave P1 backend **merged**: PR [#242](https://github.com/hangndat/ticket-solution/pull/242) · merge `5a24f4be…` · tip reviewed `4f6530bf…` · DoD PASS with known gap. Web consumer P2/P3 — chờ user/dispatch sau D11 attendee. |

Hai BA chạy độc lập (không đọc bản của nhau). File này chỉ tổng hợp sau khi cả hai artifact đã có trên disk.

---

## 1. Kết luận chung (A ∩ B ∩ nội bộ)

1. **Học pattern ops, không copy sản phẩm bán vé / enterprise suite.** Eventbrite · Ticket Tailor · Humanitix và Cvent · Bizzabo · Swoogo đều tách **tóm tắt vận hành event** khỏi analytics bán hàng / ROI / CRM. Vemoki MVP = invite-code + Gate — reject revenue, UTM, seat, Wallet, RFID, SmartBadge, cross-event BI.
2. **Gap thật so PRD M11 và source:** `readEventReport` chỉ có `ticketsByState` + `quota` + `pendingApprovalCount`. Thiếu check-in success / reject theo lý do·cổng, email lỗi, `asOf`/watermark, deep-link “việc cần làm”. Board `#21`/`#22` Hoàn thành **không** chứng minh đủ M11.
3. **KPI dictionary phải chốt trước contract.** Thị trường documented: Checked-in ≠ Attended (Ticket Tailor); orders ≠ tickets; sales ≠ earnings (Humanitix). Vemoki cần dictionary riêng cho state máy vé + Gate (không copy “sold”).
4. **Freshness / offline là bài học bắt buộc event-day.** Ticket Tailor help documented double-scan khi offline không sync; Cvent/Swoogo có device/onsite stats. Dashboard phải nói “server đã ghi nhận” + watermark — không im lặng số “xanh”.
5. **Readiness ≠ Dashboard số liệu.** Story `#228` / Task `#229` (web workspace readiness) đang `Đang làm` trên Project #3 (snapshot sau research BA). Dashboard event-report dẫn về readiness, không xây checklist thứ hai hay portfolio BI kiểu Splash/Cvent.

---

## 2. Ưu tiên hợp nhất (proposed)

| # | Việc | Nguồn đồng thuận | Ownership gợi ý | Ghi chú |
| - | ---- | ---------------- | --------------- | ------- |
| P0 | User chốt dictionary KPI + 5 câu hỏi §4 | A§8 + B§8 + `DASHBOARD-RESEARCH` §8 | product / user | **Gate** trước mọi Wave coding |
| P1 | Mở rộng event report: check-in success + reject (lý do±cổng) + remaining quota có định nghĩa | A-P1, B-P1, nội bộ §3 | backend → OpenAPI | Dep: P0 |
| P2 | `asOf` / watermark + giữ fail-closed UI (`shown`/`unknown`/`rejected`) | A-P3, B-P2, nội bộ §5 | backend + web | Honest latency; không hứa “real-time” marketing |
| P3 | Khu “cần xử lý”: pending + email lỗi count → deep-link workflow (không resend từ thẻ) | A-P2, B-P3 | web (+ CS API sẵn) | |
| P4 | Hòa readiness columns với `#228/#229` (publish ≠ mở đổi vé ≠ mở check-in) | B-P4, nội bộ §4 | web (ownership `#229`) | Không tranh slot feature `#229` |
| P5 | Auto-refresh có chủ đích khi event live / chỉ poll thủ công pilot | B-P5, A câu hỏi freshness | web + backend budget | TD: giảm reporting trước khi Gate quá tải |
| P6+ | Drilldown / time-bucket / multi-event Owner | A-P4–P6, B-P6 | sau P1–P3 ổn | |
| — | Revenue / CRM / ROE / badge / RFID | A+B reject | — | **Không mở** |

---

## 3. Roadmap đề xuất (sau khi user duyệt P0)

```text
Wave 0  product: dictionary + quyết định §4
Wave 1  backend: EventReport DTO + tests isolation
Wave 1∥ web: render KPI + asOf + work CTAs (sau contract)
Wave 1∥ web readiness #229: chỉ align copy/AC nếu còn room — không fork checklist
Wave 2  email fail count + optional Gate device summary (dep D11-S3)
Wave 3  UAT headless + reviewer-dod/security trên exact SHA
```

Không spawn coding từ tổng hợp này. Không deploy/store. Không đổi Project Status sang Hoàn thành chỉ vì có research.

---

## 4. Quyết định đã chốt (O12 — 2026-10-18)

| # | Chốt |
| - | ---- |
| 1 | Check-in dash = **lượt Gate confirm thành công**; không check-out / Attended tách trong MVP |
| 2 | Day-of: **Manager readiness/quota/pending → Supervisor check-in/reject** trên cùng trang event |
| 3 | Email lỗi = count **cần CS** (failed cuối); deep-link, không resend từ thẻ |
| 4 | Pilot: **`asOf` + refresh thủ công**; ≤10s PRD = độ trễ đo được, không bắt buộc poll 10s |
| 5 | Chỉ **event-scoped**; multi-event Owner sau |
| 6 | **Không** tự sửa AC `#229`; chỉ bổ sung KPI/copy Dashboard |

Chi tiết đầy đủ: [DECISION-LOG § O12](../DECISION-LOG.md#o12--dashboard-m11-dictionary-kpi-và-pha-triển-khai-18102026).

---

## 5. Artifact & cleanup

| Artifact | Path |
| -------- | ---- |
| Nội bộ (Codex trước spawn) | `docs/plans/DASHBOARD-RESEARCH.md` |
| BA A (SMB ticketing) | `docs/plans/DASHBOARD-BA-A-MARKET-RESEARCH.md` |
| BA B (enterprise ops) | `docs/plans/DASHBOARD-BA-B-MARKET-RESEARCH.md` |
| Tổng hợp này | `docs/plans/DASHBOARD-MARKET-SYNTHESIS.md` |

Giới hạn chung: không đăng nhập competitor; một phần Cvent/Bizzabo KB chỉ mức index/marketing; CRG stale tại thời điểm research — source thắng. Proposed ≠ approved ≠ code/acceptance/pilot ready.
