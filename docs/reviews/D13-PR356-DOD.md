# DoD / BA review — PR #356 / Issue #322 (Age Rating questionnaire)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Orca `reviewer-dod` (+ expertise `product-ba`) · terminal `term_8a876e11-7a27-4030-9333-201152d85f00` · task `task_34481627fc46` · dispatch `ctx_bfe6b14b0943` · **≠** session implementer BA |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · đọc thêm `docs/agents/roles/product-ba.md` |
| Scope | PR [#356](https://github.com/hangndat/ticket-solution/pull/356) · Issue [#322](https://github.com/hangndat/ticket-solution/issues/322) · Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · paths `docs/asc/age-rating-questionnaire.md` + `docs/reviews/D13-BA-AGE-RATING.md` |
| Commit SHA | **`a7258534ac4116bf961b6975ae159d1bb9bf3419`** (`git rev-parse` trên tip PR) |
| Architecture impact | **Không** (đối chiếu: đúng — phân loại nội dung/capability, không ADR/contract) |
| Ngày review | **2026-10-18** (UTC) |
| ASC mutate / login / cloud | **Không** (reviewer không gọi PATCH / không login ASC) |

---

## 1. Checks trên exact SHA

| Check | Kết quả |
| ----- | ------- |
| Tip PR = SHA yêu cầu | **PASS** — `git rev-parse` / `gh pr view 356` tip = `a7258534ac4116bf961b6975ae159d1bb9bf3419` |
| Diff ownership | **PASS** — chỉ 2 file docs trên; không `apps/**` |
| CI PR #356 | **PASS** — `changes` + `ci` xanh; backend/web/mobile skip (docs-only) |
| Apple Attributes live schema | **PASS (đối chiếu)** — `AgeRatingDeclaration.Attributes` JSON Apple Developer Docs (30 properties) khớp ma trận BA; string frequency còn nhận deprecated `INFREQUENT_OR_MILD`/`FREQUENT_OR_INTENSE` nhưng docs BA đúng khi **PATCH bằng** `NONE`/`INFREQUENT`/`FREQUENT` (ASC API 4.1 deprecation) |
| Apple definitions (primary) | Đã đọc [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) + [Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/) + Attributes dictionary |
| Source tip BA đọc (`a932cd51…`) — chat / web / ads | **PASS** — screens mobile không chat/social; `oidc-login.ts` chỉ `WebBrowser.openAuthSessionAsync`; Privacy qua `Linking.openURL`; không ad SDK claim mâu thuẫn privacy-nutrition |
| Public prod inspect (read-only, không credential) | `GET https://api.vemoki.com/v1/health` → 200; `GET /v1/public/tenants/{mfest,sunburst,northline,demo,vemoki,…}/events` → **404**; `https://vemoki.com/` = marketing (demo giả lập), **không** list published event công khai để audit theme |

Runtime tests: **N/A** (docs-only).

---

## 2. Phân tách nghiệm thu (bắt buộc)

| Cổng | Verdict | Ý nghĩa |
| ---- | ------- | ------- |
| **Docs-readiness** | **PASS with known gap** | Ma trận attribute đủ 30 field hiện hành, enum đúng hướng, non-goals rõ, không claim ASC đã điền/submit, evidence path phần lớn đúng. Gap = phân loại UGC sai + framing U1 + payload §6 không an toàn để áp dụng. |
| **Answers-ready-to-PATCH** | **FAIL** | Payload minh họa §6 **không** được root/ops dùng im lặng: chứa `userGeneratedContent: false` trái định nghĩa Apple + gắn `NONE` cho attribute **MED** (alcohol/mature/sexual) khi nội dung event thực tế **chưa** xác minh. |

**Verdict tổng DoD (authoritative answers / merge-as-ready-to-apply):** **FAIL**

Không Hoàn thành Project / không merge từ reviewer. Cần BA sửa docs (hoặc commit follow-up) rồi **revalidation exact SHA mới**.

---

## 3. Phân loại Apple — `userGeneratedContent` (blocker)

### Định nghĩa primary (Apple Help — Capabilities)

> **User-Generated Content:** Includes the **broad distribution of content created by users** as a component of the **app's intended user experience**. May include: broadly distributed videos, photos, text, and/or audio created by users of the app.

> **Social Media:** Redistribution, amplification, or interaction with user-generated content through a **social feed** or similar discovery method…

Đây là **hai capability riêng**. Không có social feed chỉ chứng minh `socialMedia: false` — **không** đủ để kết luận `userGeneratedContent: false`.

### Evidence sản phẩm (source / PRD)

- PRD **M03/M04**: Event Manager tạo tên/nội dung event; brand override **logo/banner**; section hero/FAQ/terms; **rich text + upload** được kiểm trước hiển thị; publish → projection công khai dùng chung web/app.
- iOS intended UX: list/detail `PublishedEvent*` + `EventMediaHeader` (banner/logo URL hoặc demo pack) — attendee **không** upload, nhưng **organizer/tenant user** tạo media/text được **phân phối rộng** trong app.
- Guideline 1.2 / 1.2.1 (App Review): nội dung creator/community đóng góp được App Review coi là UGC — khớp mô hình multi-tenant catalog.

### Kết luận kỹ thuật (owned reviewer — không hỏi user “Apple nghĩa là gì”)

| Attribute | Giá trị đúng theo evidence | Ghi chú |
| --------- | -------------------------- | ------- |
| `userGeneratedContent` | **`true`** | Organizer-authored published event text/media = content do user nền tảng tạo, broad distribution là trải nghiệm chính. |
| `socialMedia` | `false` | Không feed like/comment/share — BA **đúng**. |
| `messagingAndChat` | `false` | BA **đúng**. |

**Sửa bắt buộc trong docs:** đổi đề xuất `userGeneratedContent` → `true`; bỏ U1 dạng “user xác nhận Apple definition / bảo thủ true|false”. UGC=`true` vẫn nằm band **4+** (OS 26+) / VN **00+** theo bảng Apple — không tự nâng 9+/13+ chỉ vì UGC.

---

## 4. U1–U4 — unknown thật vs suy luận được

| ID | BA framing | Reviewer | Hành động |
| -- | ---------- | -------- | --------- |
| **U1** | Hỏi user organizer = UGC? | **Không phải unknown định nghĩa Apple** — đã resolve = **true**. Không phải approval gate. | Xóa/viết lại U1; chỉ còn nếu owner muốn **policy** khác (thì phải đổi product, không đổi nghĩa Apple). |
| **U2** | Event thực có alcohol/mature/violence? | **Unknown thật** về nội dung production. Public inspect 2026-10-18: không có published public catalog để đọc theme; marketing site ghi demo giả lập. Shell app không có theme sẵn — **không** suy ra `NONE` an toàn cho mọi tenant tương lai. | Giữ unknown trước PATCH các field MED; cần (a) policy nội dung + moderation đã ship, hoặc (b) audit event pilot thực, hoặc (c) khai `INFREQUENT` nếu cho phép mature — **user/ops chỉ khi thiếu fact nội dung**, không khi thiếu hiểu Apple. |
| **U3** | EULA min age? | **Suy luận được từ repo:** không thấy EULA/Terms age floor trong docs ASC/PRD liên quan. | Mặc định **omit** `ageRatingOverrideV2` / `NONE`. Chỉ hỏi user nếu có Terms **ngoài repo** với floor tuổi. |
| **U4** | Content Rights | **Đúng** — ngoài `ageRatingDeclarations`; ops checklist riêng. | Không chặn questionnaire PATCH; theo dõi ASC field riêng. |

---

## 5. Findings

### Blocker

1. **`userGeneratedContent: false` sai** theo Apple definitions + PRD M03/M04 + published media UX; BA dựa thiếu social feed — nhầm sang `socialMedia`.
2. **§6 PATCH payload không sẵn sàng:** nhúng UGC false + toàn bộ frequency MED = `NONE` mà không treo “không PATCH các key MED đến khi U2 đóng”. Payload có MED unknown **cấm** dùng im lặng.

### Should-fix

3. Tách rõ trong artifact BA: **docs-readiness** vs **answers-ready-to-PATCH** (hiện BA Verdict gộp “PASS (docs)” dễ bị đọc là OK để PATCH).
4. Sau khi UGC=`true`, cập nhật kỳ vọng descriptor (vẫn 4+/00+ band) và bỏ câu “MED — xem U1” trên UGC.
5. Gắn SHA tip PR `a7258534…` cứng vào `D13-BA-AGE-RATING.md` (đang placeholder “Verify on PR tip”).

### Nit

6. OpenAPI mirror bên thứ ba có thể thiếu `socialMedia*` trong một bản sao; **nguồn thắng** = Apple Attributes dictionary (đủ 30, gồm `socialMedia` / `socialMediaAgeRestricted`) — BA đã liệt kê đúng.
7. `violence*` / gambling / ads / unrestricted web: evidence đủ — **giữ** đề xuất BA.

---

## 6. Corrections đề xuất (primary sources)

| Mục | Từ (SHA `a7258534…`) | Sang | Source |
| --- | -------------------- | ---- | ------ |
| `userGeneratedContent` | `false` (MED/U1) | **`true`** (HIGH) | Apple Age ratings values & definitions — User-Generated Content; PRD M04 upload/brand; published event media |
| U1 | User quyết nghĩa Apple | **Đóng** — technical interpretation reviewer | Cùng nguồn; task: không hỏi user quyết definition |
| §6 payload | All-in JSON sẵn PATCH | Tách: (A) HIGH-only payload an toàn; (B) MED keys **omit** đến U2/policy | Task: MED unknown ≠ silent PATCH |
| Calculated rating note | 4+ nếu ma trận hiện tại | Vẫn **4+** / VN **00+** với UGC true (descriptor UGC hiện) | Apple rating tables OS 26+ / Vietnam |

---

## 7. Limitations

- Không login ASC; không đọc live `ageRatingDeclarations` attributes (BA: resource PRESENT / answers chưa evidence — chấp nhận cho docs review).
- Không audit media từng event private/non-public; public prod hiện không expose list published để kết luận U2.
- Không legal counsel; không claim store submit.

---

## 8. Verdict

| | |
| --- | --- |
| **Docs-readiness** | **PASS with known gap** |
| **Answers-ready-to-PATCH** | **FAIL** |
| **DoD tổng (authoritative)** | **FAIL** — cần sửa UGC + cách ly payload MED, rồi revalidation SHA mới |

Coordinator: giữ PR `Chờ duyệt` / trả BA `Đang làm`; **không** merge như sẵn PATCH; **không** Project `Hoàn thành`.
