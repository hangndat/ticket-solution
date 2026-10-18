# D13 — Age Rating questionnaire (ASC) — ma trận trả lời đề xuất

**Epic:** [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story S3 · hỗ trợ Task [#322](https://github.com/hangndat/ticket-solution/issues/322)  
**Role:** `product-ba` · `docs/agents/roles/product-ba.md`  
**Architecture impact:** **Không** — phân loại nội dung/capability thực tế cho ASC; không đổi app/contract.  
**Evidence BA:** [D13-BA-AGE-RATING.md](../reviews/D13-BA-AGE-RATING.md)  
**Mục đích:** nguồn giá trị reviewable để **root/ops** `PATCH` `ageRatingDeclarations` **sau** DoD độc lập — **không** claim ASC đã điền / đã submit.

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

**Cấm từ docs này:** mutate ASC, login ASC, commit secrets, claim store submit, claim “đã 4+ live”.

---

## 2. Nguồn Apple (đối chiếu 2026-10-18)

| Tài liệu | URL |
| -------- | --- |
| Set an app age rating | https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/ |
| Age ratings values and definitions | https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ |
| Updated age ratings (2025-07-24) | https://developer.apple.com/news/?id=ks775ehf |
| ASC API — Age Ratings | https://developer.apple.com/documentation/appstoreconnectapi/app_store/app_metadata/age_rating_declarations |
| `AgeRatingDeclaration.Attributes` | https://developer.apple.com/documentation/appstoreconnectapi/ageratingdeclaration/attributes-data.dictionary |

**Enum tần suất (string):** dùng `NONE` · `INFREQUENT` · `FREQUENT`.  
**Không** dùng deprecated `INFREQUENT_OR_MILD` / `FREQUENT_OR_INTENSE` (Apple docs 2025+).

**Boolean capabilities / controls:** `true` \| `false` (không để null khi điền).

---

## 3. Mapping sản phẩm → câu hỏi (tóm tắt)

| Chủ đề Apple | Kết luận đề xuất | Lý do ngắn (source) |
| ------------ | ---------------- | ------------------- |
| Organizer text/media vs UGC | `userGeneratedContent: **false**` (xem §5 unknown) | Attendee **không** tạo nội dung phân phối rộng; catalog event do Event Manager/tenant admin qua web quản trị (PRD M03/M04). App iOS **hiển thị** `PublishedEvent*` + demo media — không feed peer-post. |
| Chat / social | `messagingAndChat: false`, `socialMedia: false`, `socialMediaAgeRestricted: false` | Không có module chat/DM/feed/like/comment trong `apps/mobile/src` (screens: events, tickets, gate, redeem, account). |
| External links vs unrestricted browser | `unrestrictedWebAccess: false` | `expo-web-browser` chỉ OIDC `openAuthSessionAsync` (`oidc-login.ts`); Privacy mở **Safari ngoài app** qua `Linking.openURL` (`account.tsx`). Không embedded free browser. |
| Contests / gambling / payment | `gambling: false`, `gamblingSimulated: NONE`, `contests: NONE`, `lootBox: false` | PRD §4 ngoài MVP: **không** bán vé/thanh toán/refund; không contest/raffle/gambling trong product. Checklist ASC: In-App Purchase = No. |
| Ads | `advertising: false` | Không ad SDK trong `apps/mobile/package.json` (đối chiếu [privacy-nutrition.md](./privacy-nutrition.md)). |
| Parental / age assurance | `parentalControls: false`, `ageAssurance: false` | Không Made for Kids; không Declared Age Range / age gate trong app. |
| Mature / violence / medical / sexual | Tất cả frequency = `NONE`; `healthOrWellnessTopics: false` | App ticketing/gate — không theme horror/sex/violence/medical; nội dung event do organizer (không bịa nội dung sự kiện cụ thể). |

**Dự kiến rating tính toán (nếu điền đúng ma trận):** global **4+** (OS 26+) / legacy **4+**; Vietnam region có thể **00+** khi chỉ có controls/capabilities “4+ band”. **Không** set `ageRatingOverrideV2` trừ khi user yêu cầu minimum age cao hơn.

---

## 4. Ma trận đầy đủ — `AgeRatingDeclaration.Attributes`

Cột **API attribute** khớp schema Apple. Cột **Đề xuất** = giá trị đề xuất cho PATCH.  
**Confidence:** `HIGH` = source + PRD rõ; `MED` = suy luận hợp lý cần user xác nhận một lần; `USER` = không được tự quyết.

### 4.1 In-app controls (boolean)

| # | API attribute | UI / định nghĩa Apple (rút) | Đề xuất | Evidence | Confidence |
| - | ------------- | --------------------------- | ------- | -------- | ---------- |
| 1 | `parentalControls` | Công cụ phụ huynh hạn chế nội dung/feature trong app | `false` | Không settings parental / content filter trong `apps/mobile` | HIGH |
| 2 | `ageAssurance` | Xác minh tuổi (Declared Age Range, ID, estimation…) | `false` | Không age-gate / Declared Age Range API trong mobile deps hoặc screens | HIGH |

### 4.2 Capabilities (boolean)

| # | API attribute | UI / định nghĩa Apple (rút) | Đề xuất | Evidence | Confidence |
| - | ------------- | --------------------------- | ------- | -------- | ---------- |
| 3 | `unrestrictedWebAccess` | Duyệt web tự do **trong app** / embedded browser | `false` | Auth: `WebBrowser.openAuthSessionAsync` chỉ OIDC (`apps/mobile/src/identity/oidc-login.ts`). Privacy: `Linking.openURL` → browser hệ thống (`apps/mobile/src/screens/account.tsx`). Deep link chỉ scheme app (`links/installed-app-link.ts`) — không URL browser tự do. | HIGH |
| 4 | `userGeneratedContent` | Phân phối rộng nội dung do **user** tạo (video/ảnh/text/audio) như trải nghiệm chính | `false` | Attendee: xem event/vé/QR/claim — không upload feed. Organizer content = admin catalog (web quản trị PRD M03/M04); iOS đọc `PublishedEventDetail` (`published/types.ts`, `screens/event-detail.tsx`) + bundled demo media (`data/demo-media*.ts`). **Không** social redistribution. | MED — xem §5 U1 |
| 5 | `socialMedia` | Feed social: like/comment/share/amplify UGC | `false` | Không social feed / engagement surfaces trong mobile tree | HIGH |
| 6 | `socialMediaAgeRestricted` | Social tắt với &lt;13 + Declared Age Range | `false` | Chỉ relevant nếu `socialMedia: true` — giữ `false` | HIGH |
| 7 | `messagingAndChat` | Chat/DM/voice/video/public posting giữa users | `false` | Không chat module; push = transactional APNs (`push/*`), không messaging peer | HIGH |
| 8 | `advertising` | Quảng cáo trả phí trong app | `false` | No ads SDK — [privacy-nutrition.md](./privacy-nutrition.md) inventory | HIGH |

### 4.3 Mature themes (frequency string)

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 9 | `profanityOrCrudeHumor` | `NONE` | App copy vận hành vé/gate; không comedy/profanity feature | HIGH |
| 10 | `horrorOrFearThemes` | `NONE` | Không horror content type trong product | HIGH |
| 11 | `alcoholTobaccoOrDrugUseOrReferences` | `NONE` | Product không mô tả/đề cập chất kích thích; **không** audit nội dung từng event organizer thực tế | MED — xem §5 U2 |

### 4.4 Medical or wellness

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 12 | `medicalOrTreatmentInformation` | `NONE` | Không chẩn đoán/điều trị | HIGH |
| 13 | `healthOrWellnessTopics` | `false` | Không calorie/diet/fitness coaching | HIGH |

### 4.5 Sexuality or nudity (frequency)

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 14 | `matureOrSuggestiveThemes` | `NONE` | Shell app không có; nội dung event do organizer (U2) | MED |
| 15 | `sexualContentOrNudity` | `NONE` | Idem | MED |
| 16 | `sexualContentGraphicAndNudity` | `NONE` | Idem — **bắt buộc NONE** nếu không có nội dung đó (UNRATED nếu INFREQUENT/FREQUENT) | MED |

### 4.6 Violence (frequency)

| # | API attribute | Đề xuất | Evidence | Confidence |
| - | ------------- | ------- | -------- | ---------- |
| 17 | `violenceCartoonOrFantasy` | `NONE` | Không game/combat | HIGH |
| 18 | `violenceRealistic` | `NONE` | Không | HIGH |
| 19 | `violenceRealisticProlongedGraphicOrSadistic` | `NONE` | Không — UNRATED nếu khai báo có | HIGH |
| 20 | `gunsOrOtherWeapons` | `NONE` | Không theme vũ khí trong product | HIGH |

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
| 26 | `ageRatingOverrideV2` | `NONE` hoặc omit | Chỉ override lên **cao hơn** nếu EULA/minimum age user yêu cầu | USER nếu muốn &gt; calculated |
| 27 | `kidsAgeBand` | omit / null | **Không** Made for Kids (không chọn Kids category) | HIGH |
| 28 | `koreaAgeRatingOverride` | omit | Chỉ khi GRAC/RCN | N/A pilot VN |
| 29 | `gracRatingClassificationNumber` | omit | Idem | N/A |
| 30 | `developerAgeRatingInfoUrl` | omit hoặc URL khi có trang age suitability | Optional | USER |

---

## 5. Unknown — cần user (không tự quyết pháp lý)

| ID | Câu hỏi | Vì sao BA không chốt cứng | Ảnh hưởng nếu trả lời khác |
| -- | ------- | ------------------------- | -------------------------- |
| **U1** | Organizer-authored event title/description/banner có được Apple coi là **User-Generated Content** không? | Định nghĩa Apple: “broad distribution of content created by users”. Organizer **là** user có role admin; BA đề xuất `false` vì không phải peer UGC/social — **user/chủ app** xác nhận trước PATCH nếu muốn bảo thủ `true`. | `true` vẫn có thể **4+** (UGC nằm band 4+), nhưng descriptor hiển thị “User-Generated Content”. |
| **U2** | Event thực tế (pilot MFest / tenant khác) có rượu/gợi cảm/bạo lực trong copy hoặc ảnh không? | BA **không** audit media production; không bịa nội dung sự kiện. | Có thể cần `INFREQUENT` trên alcohol/mature thay vì `NONE` → rating có thể lên **9+** / **12+** (VN). |
| **U3** | Có minimum age trong Terms/EULA cao hơn rating Apple tính không? | Chưa thấy EULA age floor trong docs ASC hiện tại. | Nếu có → set `ageRatingOverrideV2` cao hơn. |
| **U4** | Content rights (field ASC **riêng**, ngoài questionnaire) | Checklist: declare rights cho brand/event media — **không** nằm trong `ageRatingDeclarations`. | Ops điền Content Rights trên App Information theo [asc-fields-checklist.md](./asc-fields-checklist.md). |

---

## 6. Payload gợi ý (PATCH) — sau DoD + user OK U1/U2

Chỉ **minh họa** cho root; thay `{AGE_RATING_DECLARATION_ID}` bằng id từ  
`GET /v1/appInfos/{appInfoId}/ageRatingDeclaration`.

```json
{
  "data": {
    "type": "ageRatingDeclarations",
    "id": "{AGE_RATING_DECLARATION_ID}",
    "attributes": {
      "parentalControls": false,
      "ageAssurance": false,
      "unrestrictedWebAccess": false,
      "userGeneratedContent": false,
      "socialMedia": false,
      "socialMediaAgeRestricted": false,
      "messagingAndChat": false,
      "advertising": false,
      "profanityOrCrudeHumor": "NONE",
      "horrorOrFearThemes": "NONE",
      "alcoholTobaccoOrDrugUseOrReferences": "NONE",
      "medicalOrTreatmentInformation": "NONE",
      "healthOrWellnessTopics": false,
      "matureOrSuggestiveThemes": "NONE",
      "sexualContentOrNudity": "NONE",
      "sexualContentGraphicAndNudity": "NONE",
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

**Sau PATCH:** GET read-back toàn bộ attributes + xem panel Age Ratings (global + Vietnam nếu territory gồm VN). Lưu receipt JSON (che secret) vào `docs/reviews/` khi ops làm — **ngoài** scope BA docs này.

---

## 7. Non-goals / ranh giới

- Không sửa `apps/**`, không UI mouse, không cloud ASC mutate từ worker BA.
- Không điền Privacy Nutrition Labels; không đổi Availability/territory.
- Không Made for Kids; không legal counsel claim.
- Không coi checklist cũ “dự kiến 4+” là evidence đã điền — chỉ là kỳ vọng trước wizard.

---

## 8. Checklist nghiệm thu docs (BA)

- [x] Liệt kê đủ attribute questionnaire hiện hành (controls + capabilities + content + chance)
- [x] Mỗi mục có đề xuất enum/boolean + evidence path hoặc PRD non-goal
- [x] Phân biệt organizer catalog vs UGC; auth browser vs unrestricted web
- [x] Ghi unknown U1–U4 cho user
- [x] Không claim ASC completed / submitted
- [ ] Root PATCH + screenshot/receipt sau DoD (ops — #322)
