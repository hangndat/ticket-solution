# D13 — Age Rating questionnaire (ASC) — ma trận trả lời đề xuất

**Epic:** [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story S3 · hỗ trợ Task [#322](https://github.com/hangndat/ticket-solution/issues/322)  
**Role:** `product-ba` · `docs/agents/roles/product-ba.md`  
**Architecture impact:** **Không** — phân loại nội dung/capability thực tế cho ASC; không đổi app/contract.  
**Evidence BA:** [D13-BA-AGE-RATING.md](../reviews/D13-BA-AGE-RATING.md)  
**Mục đích:** nguồn giá trị reviewable để **root/ops** `PATCH` `ageRatingDeclarations` **sau** DoD độc lập — **không** claim ASC đã điền / đã submit / đã “all 4+”.

---

## 0. Phân tách nghiệm thu (bắt buộc)

| Cổng | Trạng thái hiện tại | Ý nghĩa |
| ---- | ------------------- | ------- |
| **Docs-readiness** | Ma trận + evidence reviewable (sau sửa UGC) | Có thể review docs / revalidate SHA |
| **Answers-ready-to-PATCH** | **Chưa** — chỉ payload **partial** §6A an toàn; §6B MED **omit** đến khi U2 đóng | **Cấm** dùng full JSON all-`NONE` im lặng |
| **Final questionnaire / calculated rating** | **Blocked** — thiếu fact nội dung event (U2); root đã hỏi async user về nội dung event thực + minimum age (**chưa có câu trả lời**) | Không tuyên bố rating live / “đã 4+” |

---

## 1. Bối cảnh live ASC (không bịa)

| Fact | Evidence |
| ---- | -------- |
| App | Vemoki · bundle `com.hangndat.ticket` · ASC app id `6823694490` · Team `BLUA62D52G` |
| Listing EN/VI + version `1.0.0` | Đã điền API — [D13-ASC-METADATA-LIVE.md](../reviews/D13-ASC-METADATA-LIVE.md) (reviewed BA SHA `2759b0a9…`) |
| Categories | Primary **ENTERTAINMENT**, secondary **BUSINESS** — receipt `/tmp/vemoki-d13-asc-categories-live.json` (`verified: true`, `submitted: false`, `availabilityChanged: false`) |
| Age rating resource | **PRESENT** (resource tồn tại) — [D13-IOS-ASC-PREFLIGHT.md](../reviews/D13-IOS-ASC-PREFLIGHT.md) |
| Questionnaire attributes | **Chưa có evidence đã trả lời** — coi live = **all-null / chưa wizard** cho đến khi root PATCH + read-back (task này **không** gọi ASC API) |
| Privacy Nutrition / territory | **Không** làm lại trong task này (Privacy Labels còn blocker AppleID session; Availability territory còn chờ user) |

**Cấm từ docs này:** mutate ASC, login ASC, commit secrets, claim store submit, claim “đã 4+ live”, ship full questionnaire như sẵn PATCH khi còn MED unknown.

---

## 2. Nguồn Apple (đối chiếu 2026-10-18)

| Tài liệu | URL |
| -------- | --- |
| Set an app age rating | https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/ |
| Age ratings values and definitions | https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ |
| Updated age ratings (2025-07-24) | https://developer.apple.com/news/?id=ks775ehf |
| ASC API — Age Ratings | https://developer.apple.com/documentation/appstoreconnectapi/app_store/app_metadata/age_rating_declarations |
| `AgeRatingDeclaration.Attributes` | https://developer.apple.com/documentation/appstoreconnectapi/ageratingdeclaration/attributes-data.dictionary |
| App Review Guidelines (1.2 User-Generated Content) | https://developer.apple.com/app-store/review/guidelines/#user-generated-content |

**Enum tần suất (string):** dùng `NONE` · `INFREQUENT` · `FREQUENT`.  
**Không** dùng deprecated `INFREQUENT_OR_MILD` / `FREQUENT_OR_INTENSE` (Apple docs 2025+).

**Boolean capabilities / controls:** `true` \| `false` (không để null khi điền).

---

## 3. Mapping sản phẩm → câu hỏi (tóm tắt)

| Chủ đề Apple | Kết luận đề xuất | Lý do ngắn (source) |
| ------------ | ---------------- | ------------------- |
| Organizer text/media vs UGC | `userGeneratedContent: **true**` | Apple: “broad distribution of content created by **users**” là trải nghiệm chính. Organizer/tenant admin **là user nền tảng**; PRD M03/M04: tạo tên/nội dung event, logo/banner, rich text + upload → publish → projection công khai web/app (`PublishedEvent*`). **Không** hỏi user “Apple nghĩa là gì” — phân loại theo định nghĩa official là trách nhiệm BA/ops. |
| Social feed | `socialMedia: false`, `socialMediaAgeRestricted: false` | Không feed like/comment/share — **chỉ** chứng minh social = false; **không** suy ra UGC = false. |
| Chat | `messagingAndChat: false` | Không module chat/DM trong `apps/mobile/src`. |
| External links vs unrestricted browser | `unrestrictedWebAccess: false` | `expo-web-browser` chỉ OIDC `openAuthSessionAsync`; Privacy qua `Linking.openURL` → Safari ngoài app. |
| Contests / gambling / payment | `gambling: false`, `gamblingSimulated: NONE`, `contests: NONE`, `lootBox: false` | PRD §4 ngoài MVP: không bán vé/thanh toán; không contest/gambling. |
| Ads | `advertising: false` | Không ad SDK — [privacy-nutrition.md](./privacy-nutrition.md). |
| Parental / age assurance | `parentalControls: false`, `ageAssurance: false` | Không Made for Kids; không age gate. |
| Mature / alcohol / sexual (frequency MED) | **Omit khỏi PATCH** đến khi U2 đóng | Shell app không theme horror/sex; **không** audit media/copy event pilot thực → **không** gán `NONE` im lặng. |
| Violence / medical / chance đã verify | Frequency / boolean theo §4 (HIGH) | Có evidence product shell — được đưa vào payload partial. |

**Kỳ vọng descriptor (không claim live):** với UGC=`true` + các HIGH đã verify, Apple tables vẫn đặt UGC trong band **4+** (OS 26+) / VN **00+** — **không** tự nâng 9+/13+ chỉ vì UGC. Rating **tính toán cuối** vẫn **blocked** đến khi U2 (và override U3 nếu có) đóng. **Không** claim “all 4+”.

---

## 4. Ma trận đầy đủ — `AgeRatingDeclaration.Attributes`

Cột **API attribute** khớp schema Apple. Cột **Đề xuất** = giá trị đề xuất khi đủ fact.  
**Confidence:** `HIGH` = source + PRD rõ → được vào §6A; `MED` = thiếu fact nội dung → **omit** PATCH đến U2; `USER` = chỉ hỏi khi có fact ngoài repo.

### 4.1 In-app controls (boolean)

| # | API attribute | UI / định nghĩa Apple (rút) | Đề xuất | Evidence | Confidence |
| - | ------------- | --------------------------- | ------- | -------- | ---------- |
| 1 | `parentalControls` | Công cụ phụ huynh hạn chế nội dung/feature trong app | `false` | Không settings parental / content filter trong `apps/mobile` | HIGH |
| 2 | `ageAssurance` | Xác minh tuổi (Declared Age Range, ID, estimation…) | `false` | Không age-gate / Declared Age Range API trong mobile deps hoặc screens | HIGH |

### 4.2 Capabilities (boolean)

| # | API attribute | UI / định nghĩa Apple (rút) | Đề xuất | Evidence | Confidence |
| - | ------------- | --------------------------- | ------- | -------- | ---------- |
| 3 | `unrestrictedWebAccess` | Duyệt web tự do **trong app** / embedded browser | `false` | Auth: `WebBrowser.openAuthSessionAsync` chỉ OIDC (`apps/mobile/src/identity/oidc-login.ts`). Privacy: `Linking.openURL` → browser hệ thống (`apps/mobile/src/screens/account.tsx`). Deep link chỉ scheme app (`links/installed-app-link.ts`). | HIGH |
| 4 | `userGeneratedContent` | Phân phối rộng nội dung do **user** tạo (video/ảnh/text/audio) như trải nghiệm chính | `true` | Organizer/Event Manager tạo text/media (PRD M03/M04); publish → `PublishedEvent*` / `EventMediaHeader` phân phối rộng trên web+iOS. Attendee **không** upload — không cần peer-post để = UGC. | HIGH |
| 5 | `socialMedia` | Feed social: like/comment/share/amplify UGC | `false` | Không social feed / engagement surfaces trong mobile tree | HIGH |
| 6 | `socialMediaAgeRestricted` | Social tắt với &lt;13 + Declared Age Range | `false` | Chỉ relevant nếu `socialMedia: true` — giữ `false` | HIGH |
| 7 | `messagingAndChat` | Chat/DM/voice/video/public posting giữa users | `false` | Không chat module; push = transactional APNs (`push/*`) | HIGH |
| 8 | `advertising` | Quảng cáo trả phí trong app | `false` | No ads SDK — [privacy-nutrition.md](./privacy-nutrition.md) | HIGH |

### 4.3 Mature themes (frequency string)

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 9 | `profanityOrCrudeHumor` | `NONE` | App copy vận hành vé/gate; không comedy/profanity feature | HIGH |
| 10 | `horrorOrFearThemes` | `NONE` | Không horror content type trong product | HIGH |
| 11 | `alcoholTobaccoOrDrugUseOrReferences` | *omit đến U2* | Product shell không mô tả chất kích thích; **chưa** audit copy/ảnh event organizer thực (public catalog inspect 2026-10-18: không list published để đọc theme) | MED — §5 U2 |

### 4.4 Medical or wellness

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 12 | `medicalOrTreatmentInformation` | `NONE` | Không chẩn đoán/điều trị | HIGH |
| 13 | `healthOrWellnessTopics` | `false` | Không calorie/diet/fitness coaching | HIGH |

### 4.5 Sexuality or nudity (frequency)

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 14 | `matureOrSuggestiveThemes` | *omit đến U2* | Shell app không có; nội dung event do organizer — chưa audit | MED — U2 |
| 15 | `sexualContentOrNudity` | *omit đến U2* | Idem | MED — U2 |
| 16 | `sexualContentGraphicAndNudity` | *omit đến U2* | Idem — **không** PATCH `NONE` khi chưa verify (UNRATED nếu sau này khai INFREQUENT/FREQUENT) | MED — U2 |

### 4.6 Violence (frequency)

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 17 | `violenceCartoonOrFantasy` | `NONE` | Không game/combat | HIGH |
| 18 | `violenceRealistic` | `NONE` | Không | HIGH |
| 19 | `violenceRealisticProlongedGraphicOrSadistic` | `NONE` | Không — UNRATED nếu khai báo có | HIGH |
| 20 | `gunsOrOtherWeapons` | `NONE` | Không theme vũ khí trong product shell | HIGH |

### 4.7 Chance-based activities

| # | API attribute | Type | Đề xuất | Evidence | Confidence |
| - | ------------- | ---- | ------- | -------- | ---------- |
| 21 | `gambling` | boolean | `false` | Không betting/real-money wager; PRD non-goal payment | HIGH |
| 22 | `gamblingSimulated` | string | `NONE` | Không casino giả lập | HIGH |
| 23 | `contests` | string | `NONE` | Không skill contest/trivia ranking trong MVP | HIGH |
| 24 | `lootBox` | boolean | `false` | Không randomized purchasable items; không IAP | HIGH |

### 4.8 Override / Kids / Korea (thường để mặc định — không PATCH trừ khi cần)

| # | API attribute | Đề xuất | Ghi chú | Confidence |
| - | ------------- | ------- | ------- | ---------- |
| 25 | `ageRatingOverride` | *omit / không đổi* | Deprecated — dùng V2 | HIGH |
| 26 | `ageRatingOverrideV2` | **omit** (mặc định) | Repo/docs ASC/PRD liên quan: **không** thấy EULA/Terms age floor. Chỉ hỏi user / set override nếu có Terms **ngoài repo** với minimum age thật. Root đã hỏi async — **chưa trả lời**. | USER chỉ khi fact ngoài repo |
| 27 | `kidsAgeBand` | omit / null | **Không** Made for Kids | HIGH |
| 28 | `koreaAgeRatingOverride` | omit | Chỉ khi GRAC/RCN | N/A pilot VN |
| 29 | `gracRatingClassificationNumber` | omit | Idem | N/A |
| 30 | `developerAgeRatingInfoUrl` | omit hoặc URL khi có trang age suitability | Optional | USER |

---

## 5. Unknown / blocked facts (không tự bịa)

| ID | Trạng thái | Nội dung | Ghi chú |
| -- | ---------- | -------- | ------- |
| ~~U1~~ | **Đóng (technical)** | `userGeneratedContent = true` theo Apple definitions + PRD M03/M04 + published media UX | **Không** còn gate “user OK định nghĩa Apple”. Nếu product **muốn** không phải UGC → phải đổi product (bỏ broad distribution organizer content), không đổi nghĩa Apple. |
| **U2** | **Unknown thật — BLOCKER PATCH MED** | Event thực (pilot / tenant) có rượu / gợi cảm / tình dục trong copy hoặc ảnh không? | Root đã **hỏi async** user về nội dung event thực — **chưa có câu trả lời**. Public prod inspect (DoD): không có published public catalog để audit theme. **Giữ omit** alcohol/mature/sexual keys. |
| **U3** | Chỉ nếu fact ngoài repo | Minimum age trong Terms/EULA cao hơn rating tính toán? | Trong repo: **không thấy** age floor → mặc định **omit** override. Root đã hỏi async min age — chưa trả lời; không bịa floor. |
| **U4** | Ops checklist (ngoài questionnaire) | Content Rights — xác nhận factual owner cho brand/event media | Field ASC **riêng**; **không** chặn PATCH age attributes; **không** invent legal approval flow mới. Owner xác nhận khi điền ASC App Information theo [asc-fields-checklist.md](./asc-fields-checklist.md). |

---

## 5b. Guideline 1.2 (UGC) — publish-readiness (docs finding, không implement)

Vì `userGeneratedContent: true`, App Review **Guideline 1.2** áp dụng cho nội dung do user (organizer) tạo và phân phối rộng. Đối chiếu **cơ chế hiện có trong source/docs** (không invent compliance pass):

| Yêu cầu 1.2 (rút) | Evidence hiện có | Gap? |
| ----------------- | ---------------- | ---- |
| Lọc / không đăng nội dung objectionable | PRD M04: rich text + upload “được kiểm tra trước hiển thị”; publish nguyên tử DRAFT→PUBLISHED; quyền `event.publish` (TECHNICAL-DESIGN) | Có **gate publish theo role** + kiểm tra hiển thị — **không** chứng minh filter objectionable đầy đủ kiểu UGC community |
| Cơ chế report nội dung xúc phạm | Không thấy in-app “report content” trên attendee surfaces (`apps/mobile` screens: events/tickets/gate/account) | **Gap thật** nếu App Review áp 1.2 đầy đủ cho catalog organizer |
| Block abusive users | Membership revoke / deny-by-default roles (PRD M02) — quản trị tenant, không phải block peer UGC | Partial / khác ngữ cảnh social |
| Contact published | Privacy + Review Contact (`app-review-notes.md`, `hangndat@gmail.com`) | Có contact; không thay report-in-app |

**Kết luận BA (source-backed):** khai UGC=`true` là đúng age-rating; **publish/store readiness** còn gap moderation/report so với 1.2 đầy đủ — **không** claim đã pass 1.2.

**Bước tiếp tối thiểu (docs/ops — ngoài scope implement task này):**  
1) Owner chốt U2 (nội dung event pilot).  
2) Trước submit store: bổ sung **một** cơ chế report tối thiểu (vd. deep-link / mailto “Báo cáo nội dung” trên event detail + quy trình xử lý ≤24h theo 1.2) **hoặc** ghi rõ trong App Review Notes cách reviewer/user report qua contact — Story/Task riêng do coordinator; **BA không ship feature trong PR này**.

---

## 6. Payload — tách an toàn vs blocked

### 6A — Partial PATCH an toàn (chỉ HIGH đã verify)

Chỉ **minh họa** sau DoD docs; thay `{AGE_RATING_DECLARATION_ID}`.  
**Cấm** thêm key MED (alcohol / mature / sexual*) vào body này cho đến U2.

```json
{
  "data": {
    "type": "ageRatingDeclarations",
    "id": "{AGE_RATING_DECLARATION_ID}",
    "attributes": {
      "parentalControls": false,
      "ageAssurance": false,
      "unrestrictedWebAccess": false,
      "userGeneratedContent": true,
      "socialMedia": false,
      "socialMediaAgeRestricted": false,
      "messagingAndChat": false,
      "advertising": false,
      "profanityOrCrudeHumor": "NONE",
      "horrorOrFearThemes": "NONE",
      "medicalOrTreatmentInformation": "NONE",
      "healthOrWellnessTopics": false,
      "violenceCartoonOrFantasy": "NONE",
      "violenceRealistic": "NONE",
      "violenceRealisticProlongedGraphicOrSadistic": "NONE",
      "gunsOrOtherWeapons": "NONE",
      "gambling": false,
      "gamblingSimulated": "NONE",
      "contests": "NONE",
      "lootBox": false
    }
  }
}
```

**Omitted on purpose (U2):**  
`alcoholTobaccoOrDrugUseOrReferences`, `matureOrSuggestiveThemes`, `sexualContentOrNudity`, `sexualContentGraphicAndNudity`.  
**Omitted on purpose (U3 default):** `ageRatingOverride` / `ageRatingOverrideV2` / Kids / Korea fields.

### 6B — Không ship: full all-`NONE` / “ready to PATCH” cuối

Payload gộp mọi frequency MED = `NONE` + UGC false (bản cũ) **không còn hợp lệ** và **không** được root/ops áp dụng im lặng. Final questionnaire + calculated rating panel chỉ sau U2 (+ U3 nếu có floor thật).

**Sau PATCH partial (khi DoD cho phép ops):** GET read-back attributes đã gửi; **không** suy ra rating cuối từ partial. Lưu receipt (che secret) khi ops làm — ngoài scope BA docs này.

---

## 7. Non-goals / ranh giới

- Không sửa `apps/**`, không UI mouse, không cloud ASC mutate từ worker BA.
- Không điền Privacy Nutrition Labels; không đổi Availability/territory.
- Không Made for Kids; không legal counsel claim; không invent flow duyệt pháp lý mới cho U4.
- Không implement report/block UGC (chỉ ghi gap + next step tối thiểu ở §5b).
- Không coi checklist “dự kiến 4+” / “all 4+” là evidence đã điền hoặc rating live.

---

## 8. Checklist nghiệm thu docs (BA)

- [x] Liệt kê đủ attribute questionnaire hiện hành (controls + capabilities + content + chance)
- [x] UGC=`true` theo Apple + PRD; social ≠ UGC
- [x] Tách docs-readiness vs answers-ready-to-PATCH; partial payload §6A; omit MED
- [x] U1 đóng technical; U2 unknown thật; U3 chỉ nếu floor ngoài repo; U4 factual rights
- [x] Guideline 1.2 gap source-backed + next step tối thiểu (không implement)
- [x] Không claim ASC completed / submitted / all 4+
- [ ] Root PATCH + screenshot/receipt sau DoD + U2 đóng (ops — #322)
