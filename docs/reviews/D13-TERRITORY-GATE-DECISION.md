# D13 — Territory gate: Việt Nam vs toàn bộ storefront

| Field | Value |
| --- | --- |
| Epic | [#301](https://github.com/hangndat/ticket-solution/issues/301) |
| Role | `product-ba` · [product-ba.md](../agents/roles/product-ba.md) |
| Ngày | 2026-10-19 |
| Tip SHA (worktree) | `04ade4cff35ffbda1034fdac8e6c19c084be3850` |
| Phạm vi | Docs only — **không** thao tác ASC Availability / Pricing |

## 1. Bài toán & outcome

**Outcome:** Chọn mô hình **Availability** trên App Store Connect cho lần publish đầu của Vemoki (`com.hangndat.ticket`), đủ rõ để Story **S3** (Pricing & Availability) và **S7** (release + evidence territory) không giả định “All countries”.

**Persona:** BTC / agency VN (pilot), nhân viên cổng, khách tham dự — UI/email mặc định **Tiếng Việt** (O04). App **Free**, không IAP (listing + checklist).

**Không phải:** đổi binary, đổi API region, mở payment quốc tế, claim “pilot ready” toàn cầu.

## 2. Hai lựa chọn (so sánh)

Giá ASC: **Free** ở mọi territory — **không** có trade-off “giá bán” giữa VN và All. Khác biệt nằm ở **ai được cài từ storefront** và **phạm vi vận hành / review / evidence**.

| Tiêu chí | **A — Chỉ Việt Nam** (đề xuất mặc định) | **B — Toàn bộ storefront (All)** |
| --- | --- | --- |
| **S3 — Pricing & Availability** | Price: Free. Availability: **Vietnam** (một quốc gia). Pre-order / Arcade: No (giữ checklist). | Price: Free. Availability: **All** (hoặc danh sách rất rộng). Cùng field ASC, rủi ro ops cao hơn. |
| **S7 — Release & evidence** | S7-T1: Manual release + territory VN. S7-T3: evidence URL + version + **“Vietnam”** (screenshot/export Availability). | S7-T3 phải ghi **All** hoặc danh sách dài; support/review scope ngầm toàn cầu. |
| **Pilot & vận hành** | Khớp pilot VN, SMTP/on-call/D12 residual; giảm khách cài từ storefront nước ngoài khi ops chưa sẵn. | User bất kỳ quốc gia có thể cài → kỳ vọng hỗ trợ/IdP/email có thể vượt năng lực pilot. |
| **Copy & ASO** | Listing đã có en-US + vi; storefront VN vẫn dùng localization VI. | EN primary vẫn hợp lệ globally; **không** tự có đội support đa múi giờ. |
| **Privacy / pháp lý** | Phạm vi disclosure hẹp hơn (O06 baseline VN); **không** thay counsel — vẫn Unknown §2 plan. | Nhiều jurisdiction hơn; counsel chưa evidence — **rủi ro** nếu mở All sớm. |
| **Mở rộng sau** | ASC: thêm quốc gia trong Availability **thường không** cần binary mới; cần ops + cập nhật evidence S7-T3. | Đã mở — thu hẹp territory sau publish **khó** hơn (gỡ quốc gia = trải nghiệm user). |
| **Rủi ro App Review** | Apple review global; territory không giới hạn reviewer. | Giống A; khác ở **kỳ vọng user sau publish**. |
| **TestFlight** | Internal/External TF có thể thêm tester nước ngoài **độc lập** storefront (policy TF riêng) — không bắt buộc All. | TF + All trùng “mọi người cài được”. |

**Fact (repo):** S3-T1 read-back 2026-10-18 ghi **Availability / territory unchanged — Not touched (user chốt)** — chưa có thao tác ASC territory trong evidence hiện tại.

## 3. Khuyến nghị (BA)

**Mặc định plan & ops:** **A — chỉ Việt Nam** cho lần **Ready for Sale** đầu tiên.

**Lý do rút gọn:**

1. Khớp O04, pilot VN, và residual D12/D13 (SMTP, demo prod, on-call) — không hứa storefront toàn cầu.
2. S3 và S7 cùng một quyết định: tránh S3 chọn All trong khi S7-T1 vẫn “chờ user”.
3. Mở rộng quốc gia sau là **đường leo thang** rõ, ít hồi tố hơn thu hẹp All.

**Chưa chốt pháp lý:** Khuyến nghị **không** thay user sign-off; coordinator ghi nhận **đề xuất BA** đến khi user xác nhận một dòng (VN hoặc All).

## 4. Đường leo thang (VN → thêm quốc gia)

| Bước | Ai | Việc | ASC? |
| --- | --- | --- | --- |
| E0 | User | Xác nhận: “VN only lần đầu” (hoặc chọn All — ghi rõ) | Không |
| E1 | `ios` / coordinator | S3: Price Free + Availability **Vietnam** (sau E0) | **Có** — chỉ khi user đã chốt |
| E2 | Coordinator | S7-T1: Manual release + territory khớp E1 | **Có** |
| E3 | `product-ba` / coordinator | S7-T3: `docs/reviews/D13-PUBLISH-EVIDENCE.md` — URL, version, **danh sách territory** | Evidence |
| E4 | User + BA | Nhu cầu mở thêm quốc gia (ví dụ SG, US): memo ngắn (support, copy, legal nếu cần) | — |
| E5 | Coordinator | ASC: thêm territory; **không** submit lại nếu Apple không yêu cầu binary mới | **Có** |
| E6 | `product-ba` | Cập nhật publish evidence + comment Issue #301 | Docs |

**Cấm task này:** tự đổi Availability trên ASC; mọi mutation ASC territory thuộc E1/E2/E5 sau **user chốt**.

## 5. Acceptance (Task territory gate)

- [x] So sánh VN-only vs All cho **S3 pricing/availability** và **S7 release/evidence**
- [x] Khuyến nghị mặc định **VN** + đường leo thang
- [x] Cập nhật `docs/plans/D13-APP-STORE-RELEASE-PLAN.md` (mục Territory)
- [ ] User xác nhận territory (E0) — **ngoài** phạm vi worker docs
- [ ] Ops điền ASC Availability sau E0 — S3/S7

## 6. Liên kết

| Artifact | Path |
| --- | --- |
| Plan D13 | [D13-APP-STORE-RELEASE-PLAN.md](../plans/D13-APP-STORE-RELEASE-PLAN.md) |
| ASC checklist §2 | [asc-fields-checklist.md](../asc/asc-fields-checklist.md) |
| S3-T1 read-back | [D13-S3-T1-ASC-FIELDS.md](./D13-S3-T1-ASC-FIELDS.md) |
| Listing (không tự chọn territory) | [listing-metadata.md](../asc/listing-metadata.md) |
