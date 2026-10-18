# D13-BA — Age Rating questionnaire readiness (#322 hỗ trợ)

| Trường | Giá trị |
| ------ | ------- |
| Role | `product-ba` · `docs/agents/roles/product-ba.md` |
| Agent | `cursor` (`orca-agent-routing.mdc`) |
| Epic | [#301](https://github.com/hangndat/ticket-solution/issues/301) |
| Task GitHub | [#322](https://github.com/hangndat/ticket-solution/issues/322) (S3-T1 ASC fields — **slice BA** chuẩn bị age questionnaire; ops PATCH sau DoD) |
| Architecture impact | **Không** — phân loại nội dung/capability; không ADR/contract |
| Ownership paths | `docs/asc/age-rating-questionnaire.md` + file này |
| Source tip đọc (exact SHA) | `a932cd51544ae26fb9126f8ac73faa9adbeabf3c` (`origin/main` lúc BA ban đầu) |
| Docs PR tip trước FAIL DoD | `a7258534ac4116bf961b6975ae159d1bb9bf3419` (DoD answers-ready **FAIL** — [D13-PR356-DOD.md](./D13-PR356-DOD.md)) |
| Docs PR tip sau BA fix (exact SHA) | *điền sau `git rev-parse` / push — xem §10* |
| Ngày đối chiếu | **2026-10-18** (UTC) |
| Expo | Đã đọc `expo-overview` skill trước khi trace `apps/mobile` (read-only) |

---

## 1. Problem / outcome

**Persona:** Platform Operator / owner ASC cần điền Age Ratings trước submit (S3-T1 / S6).  
**Pain:** Live ASC có `ageRatingDeclarations` resource **PRESENT** nhưng questionnaire **chưa có evidence đã trả lời**; bản docs trước (`a7258534…`) FAIL DoD vì UGC sai + payload MED all-`NONE` không an toàn.  
**Outcome:** Ma trận đúng định nghĩa Apple (UGC=`true`); payload **partial** HIGH-only; unknown thật (U2) + async user (nội dung event / min age) treo rõ — **không** claim ready-to-PATCH cuối hay “all 4+”.

---

## 2. In / out of scope

| In | Out |
| -- | --- |
| `docs/asc/age-rating-questionnaire.md` | Sửa `apps/**` / implement report/block |
| Artifact này | Mutate ASC API / login / secrets |
| Trace feature vs Apple help + API attributes | Privacy Nutrition Labels (blocker AppleID session) |
| Map organizer media = UGC; social ≠ UGC | Đổi Availability / territory |
| Partial PATCH payload + Guideline 1.2 gap note | Claim submit / rating live / all 4+ |
| | User approval gate cho định nghĩa Apple (đã bỏ) |
| | Legal approval flow mới cho Content Rights |

---

## 3. Apple sources browsed (2026-10-18)

| Source | URL |
| ------ | --- |
| Set age rating | https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/ |
| Values & definitions (categories + rating bands) | https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ |
| News — updated ratings / new questions | https://developer.apple.com/news/?id=ks775ehf |
| API Age Ratings | https://developer.apple.com/documentation/appstoreconnectapi/app_store/app_metadata/age_rating_declarations |
| Attributes dictionary | https://developer.apple.com/documentation/appstoreconnectapi/ageratingdeclaration/attributes-data.dictionary |
| Guideline 1.2 UGC | https://developer.apple.com/app-store/review/guidelines/#user-generated-content |

Frequency enums: `NONE` \| `INFREQUENT` \| `FREQUENT` (không dùng deprecated `INFREQUENT_OR_MILD` / `FREQUENT_OR_INTENSE`).

---

## 4. Live ASC context (reuse evidence — không re-mutate)

| Fact | Evidence |
| ---- | -------- |
| Name/version/locales filled | [D13-ASC-METADATA-LIVE.md](./D13-ASC-METADATA-LIVE.md) · SHA reviewed `2759b0a9a3e0ef30321e36367e4f10f6ca18ff4a` |
| Categories ENTERTAINMENT + BUSINESS | `/tmp/vemoki-d13-asc-categories-live.json` · `verified: true` · `submitted: false` · `availabilityChanged: false` |
| Age declaration resource | PRESENT — [D13-IOS-ASC-PREFLIGHT.md](./D13-IOS-ASC-PREFLIGHT.md) |
| Questionnaire answers | **No filled evidence** → treat as **all-null** until ops PATCH + read-back |
| Privacy Labels / territory | Vẫn blocked user-input — **không** redo trong PR này |
| Async user (root) | Đã hỏi nội dung event thực + minimum age — **chưa có câu trả lời** (U2/U3) |

Prior reviewer artifact `docs/reviews/D13-PR356-DOD.md` / `D13-PR308-DOD.md` (local) **không** gộp vào commit age-rating trừ khi coordinator yêu cầu.

---

## 5. Feature trace (CRG-first + source)

Graph `code-review-graph-ticket` sẵn sàng. Semantic search không index literal “chat/UGC”; verify bằng tree `apps/mobile/src` + PRD/TECHNICAL-DESIGN.

| Claim | Source paths @ SHA `a932cd51…` / PRD |
| ----- | ------------------------------------ |
| Không chat/social feed | Mobile screens: `events`, `event-detail`, `my-tickets`, `ticket-detail`, `staff`/`gate`, `claim`/`redeem`, `account` — không messaging / like-comment feed |
| Organizer content = UGC | PRD M03/M04: Event Manager tạo nội dung + brand media; publish → projection công khai; iOS `PublishedEvent*` / `EventMediaHeader` / `data/demo-media*.ts` |
| Không unrestricted in-app browser | `identity/oidc-login.ts` — AuthSession only; `screens/account.tsx` — `Linking.openURL` → Safari |
| Không ads / IAP / gambling SDK | `apps/mobile/package.json` · [privacy-nutrition.md](../asc/privacy-nutrition.md) |
| Publish role gate (không = full 1.2) | `event.publish` permission (TECHNICAL-DESIGN); DRAFT→PUBLISHED; M04 “kiểm tra trước hiển thị” |
| Không in-app report content | Không surface report/flag trên attendee event detail |

---

## 6. Proposed answers (summary)

Chi tiết đủ 30 attribute: [age-rating-questionnaire.md](../asc/age-rating-questionnaire.md).

- `userGeneratedContent: **true**` (HIGH) — social vẫn `false`.  
- Controls/capabilities khác đã verify: theo ma trận HIGH.  
- Frequency violence/medical/profanity/horror/chance: `NONE` / boolean theo HIGH.  
- Alcohol / mature / sexual*: **omit** (U2 unknown thật).  
- Override age: **omit** trừ khi U3 có floor Terms ngoài repo.  
- **Không** Kids.  
- Kỳ vọng band descriptor với UGC true: vẫn **4+** / VN **00+** theo bảng Apple — **không** claim calculated/live “all 4+” (final blocked bởi U2).

---

## 7. Unknown / blocked (sau sửa DoD FAIL)

| ID | Trạng thái | Ghi chú |
| -- | ---------- | ------- |
| U1 | **Đóng** | Không còn userOK definition gate |
| U2 | **Open — blocker MED PATCH** | Async user: actual event content — chưa trả lời |
| U3 | **Chỉ nếu fact** | Repo không có min age; async hỏi — chưa trả lời → omit override |
| U4 | Ops factual rights | Không chặn questionnaire; không legal flow mới |
| G1.2 | Gap documented | Role publish + contact có; thiếu report-in-app — next step tối thiểu trong questionnaire §5b; **không** implement ở PR này |

---

## 8. Checks

| Check | Kết quả |
| ----- | ------- |
| Docs-only paths | Chỉ 2 file ownership trong PR |
| Không secrets / ASC mutate | Pass |
| Enum khớp API hiện hành | Pass (NONE/INFREQUENT/FREQUENT + booleans) |
| UGC vs social tách đúng Apple | Pass (`true` / `false`) |
| Không full MED-NONE ready payload | Pass — §6A partial only |
| Không mâu thuẫn privacy-nutrition (no ads) | Pass |
| Runtime tests | **N/A** (docs-only) |

---

## 9. Verdict BA (tách cổng)

| Cổng | Verdict |
| ---- | ------- |
| **Docs-readiness** | **PASS** (matrix + UGC fix + partial payload + 1.2 gap note) — chờ DoD revalidation SHA mới |
| **Answers-ready-to-PATCH (final / all keys)** | **FAIL / blocked** — U2 mở; chỉ §6A partial khi ops được ủy quyền |
| ASC UI / API applied | **NOT claimed** |
| Rating “all 4+” / live | **NOT claimed** |
| Legal counsel / 1.2 compliance pass | **NOT claimed** |

Reviewer DoD độc lập: exact SHA tip PR sau push (§10); không reuse verdict `a7258534…`.

---

## 10. Exact SHA tip (điền sau commit + push)

| Bước | Giá trị |
| ---- | ------- |
| Branch | `hangndat/d13-ba-age-rating` |
| PR | [#356](https://github.com/hangndat/ticket-solution/pull/356) |
| Tip SHA (`git rev-parse HEAD` sau push) | `REPLACE_AFTER_PUSH` |
| Prior FAIL SHA | `a7258534ac4116bf961b6975ae159d1bb9bf3419` |
