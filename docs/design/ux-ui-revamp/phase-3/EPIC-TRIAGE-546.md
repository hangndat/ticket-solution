# Epic triage — UX-UI Phase 3 ([#546](https://github.com/hangndat/ticket-solution/issues/546))

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#546](https://github.com/hangndat/ticket-solution/issues/546) — Mở rộng surface còn lại |
| PD artifact gốc | [#547](https://github.com/hangndat/ticket-solution/issues/547) / PR [#551](https://github.com/hangndat/ticket-solution/pull/551) → [`README.md`](./README.md) |
| Coding | Web [#554](https://github.com/hangndat/ticket-solution/issues/554) / PR [#558](https://github.com/hangndat/ticket-solution/pull/558) · iOS [#555](https://github.com/hangndat/ticket-solution/issues/555) / PR [#557](https://github.com/hangndat/ticket-solution/pull/557) |
| Role | `product-design` — triage only (docs) |
| Trạng thái triage | **Đề xuất đóng Epic #546** — không mở child Task mới dưới Epic |

---

## 1. Trạng thái child / wave

| Issue | Loại | State | Ghi chú |
| ----- | ---- | ----- | ------- |
| #547 | PD handoff | **CLOSED** | Artifact `phase-3/**` PASS — `docs/reviews/ux-ui-p3-pd-547.md` |
| #554 | Web impl | **CLOSED** | Invite · marketing chrome · redeem polish — PR #558 merged |
| #555 | iOS impl | **CLOSED** | `staff-access` thin · residual — PR #557 merged |

**Kết luận:** Chuỗi PD → fan-out web ∥ iOS đã hoàn tất theo Epic #546. Epic không còn Task coding/UI bắt buộc trong scope Phase 3 (portal · Gate scanner · O13 redesign · Android vẫn OUT).

---

## 2. Đóng Epic vs mở child mới

### Đề xuất: **đóng #546**

| Tiêu chí | Đánh giá |
| -------- | -------- |
| PD handoff đủ mục 0–5 + 4 priority screens | Có — #547 |
| Web + iOS đã ship theo ownership trong handoff | Có — #554 / #555 |
| OUT epic (portal, Gate redesign, O13 IA, Android) | Không thuộc #546 — giữ Issue/Epic khác |
| Pilot / production ready | **Chưa claim** — đúng handoff; không chặn đóng Epic planning |

### Không mở child Task mới **dưới** Epic #546

Residual sau merge là **ops / milestone / D13**, không phải “Phase 3 surface mở rộng”:

| Hạng mục | Xử lý đề xuất | Không gắn #546 |
| -------- | ------------- | -------------- |
| Live membership accept E2E (Nest/BFF stack) | Ops / env UAT — `docs/reviews/ux-ui-p3-web-pr558-uat-gap.md` | Issue infra hoặc milestone UAT |
| iOS dev client rebuild `vemoki://invite` | Follow-up iOS build — `docs/reviews/ux-ui-p3-ios-pr557-uat-gap.md` | Issue D13 / iOS maintenance |
| App Store submit | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) | Riêng D13 |

### Polish invite + staff (tùy chọn)

Nếu product muốn siết pixel/copy sau wave coding: dùng **[`invite-staff-polish-handoff.md`](./invite-staff-polish-handoff.md)** (3–5 ưu tiên) — spawn Task **web** hoặc **ios** **ngoài** Epic #546 (Issue mới, link artifact), không reopen Epic.

---

## 3. Hành động coordinator (checklist)

1. Project #3: Epic #546 → **Hoàn thành** sau comment đóng (VI) + link artifact PD + PR merge #558 / #557.
2. GitHub: **Close** issue #546 với comment tóm tắt wave + pointer residual ops (không blocker epic).
3. **Không** spawn child #546 cho polish ops; mở Issue riêng nếu rebuild dev client hoặc accept E2E là gate product.
4. Coding workers tiếp theo: chỉ link [`invite-staff-polish-handoff.md`](./invite-staff-polish-handoff.md) nếu có Task polish — không paste lại full `README.md` Phase 3.

---

## 4. Liên kết evidence

- PD DoD: [`docs/reviews/ux-ui-p3-pd-547.md`](../../../reviews/ux-ui-p3-pd-547.md)
- Web DoD / UAT gap: [`docs/reviews/ux-ui-p3-web-554-pr558-dod.md`](../../../reviews/ux-ui-p3-web-554-pr558-dod.md) · [`ux-ui-p3-web-pr558-uat-gap.md`](../../../reviews/ux-ui-p3-web-pr558-uat-gap.md)
- iOS DoD / UAT gap: [`docs/reviews/ux-ui-p3-ios-555-pr557-dod.md`](../../../reviews/ux-ui-p3-ios-555-pr557-dod.md) · [`ux-ui-p3-ios-pr557-uat-gap.md`](../../../reviews/ux-ui-p3-ios-pr557-uat-gap.md)
