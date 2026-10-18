# D13-BA — Age Rating questionnaire readiness (#322 hỗ trợ)

| Trường | Giá trị |
| ------ | ------- |
| Role | `product-ba` · `docs/agents/roles/product-ba.md` |
| Agent | `cursor` (`orca-agent-routing.mdc`) |
| Epic | [#301](https://github.com/hangndat/ticket-solution/issues/301) |
| Task GitHub | [#322](https://github.com/hangndat/ticket-solution/issues/322) (S3-T1 ASC fields — **slice BA** chuẩn bị age questionnaire; ops PATCH sau DoD) |
| Architecture impact | **Không** — phân loại nội dung/capability; không ADR/contract |
| Ownership paths | `docs/asc/age-rating-questionnaire.md` + file này |
| Source tip đọc (exact SHA) | `a932cd51544ae26fb9126f8ac73faa9adbeabf3c` (`origin/main` lúc BA) |
| Docs PR tip (exact SHA DoD) | Verify on PR tip / `git rev-parse` branch `hangndat/d13-ba-age-rating` sau push |
| Ngày đối chiếu | **2026-10-18** (UTC) |
| Expo | Đã đọc `expo-overview` skill trước khi trace `apps/mobile` (read-only) |

---

## 1. Problem / outcome

**Persona:** Platform Operator / owner ASC cần điền Age Ratings trước submit (S3-T1 / S6).  
**Pain:** Live ASC có `ageRatingDeclarations` resource **PRESENT** nhưng questionnaire **chưa có evidence đã trả lời** (all-null / chưa wizard); checklist cũ chỉ viết “dự kiến 4+” không đủ để PATCH an toàn.  
**Outcome:** Ma trận attribute ↔ giá trị đề xuất có evidence source/PRD + danh sách unknown cần user — root áp dụng sau DoD độc lập.

---

## 2. In / out of scope

| In | Out |
| -- | --- |
| `docs/asc/age-rating-questionnaire.md` | Sửa `apps/**` |
| Artifact này | Mutate ASC API / login / secrets |
| Trace feature vs Apple help + API attributes | Privacy Nutrition Labels (blocker AppleID session) |
| Map organizer media vs UGC, chat, web, gambling/payment | Đổi Availability / territory |
| | Claim submit / rating live đã 4+ |
| | Quyết định pháp lý thay user (U1–U4) |

---

## 3. Apple sources browsed (2026-10-18)

| Source | URL |
| ------ | --- |
| Set age rating | https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/ |
| Values & definitions (categories + rating bands) | https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ |
| News — updated ratings / new questions | https://developer.apple.com/news/?id=ks775ehf |
| API Age Ratings | https://developer.apple.com/documentation/appstoreconnectapi/app_store/app_metadata/age_rating_declarations |
| Attributes dictionary | https://developer.apple.com/documentation/appstoreconnectapi/ageratingdeclaration/attributes-data.dictionary |

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

Prior reviewer artifact `docs/reviews/D13-PR308-DOD.md` (nếu có local) **giữ nguyên untracked** — không gộp vào PR age-rating.

---

## 5. Feature trace (CRG-first + source)

Graph `code-review-graph-ticket` sẵn sàng (list_graph_stats OK). Semantic search không index được literal “chat/UGC”; đã verify bằng `ctx_search` / tree `apps/mobile/src` + đọc file nóng.

| Claim | Source paths @ SHA `a932cd51…` |
| ----- | ------------------------------ |
| Không chat/social feed | Mobile screens: `events`, `event-detail`, `my-tickets`, `ticket-detail`, `staff`/`gate`, `claim`/`redeem`, `account` — không messaging module |
| Không unrestricted in-app browser | `identity/oidc-login.ts` — `expo-web-browser` AuthSession only; `screens/account.tsx` — `Linking.openURL(PRIVACY_POLICY_URL)` → Safari hệ thống |
| Deep links app-scheme only | `links/installed-app-link.ts` |
| Event media = published/admin + demo pack | `published/types.ts`, `screens/event-detail.tsx`, `components/event-media.tsx`, `data/demo-media*.ts`; remote URL chỉ `https?` image (`safe-event-image-url.ts`) |
| Không ads / IAP / gambling SDK | `apps/mobile/package.json` · [privacy-nutrition.md](../asc/privacy-nutrition.md) |
| Payment / contests non-goals | `docs/PRD.md` §4 — ngoài MVP: bán vé/thanh toán/refund; không contest/gambling trong scope product |

---

## 6. Proposed answers (summary)

Chi tiết đủ 30 attribute: [age-rating-questionnaire.md](../asc/age-rating-questionnaire.md).

- Booleans controls/capabilities: **all `false`** (kể cả `userGeneratedContent` — **MED / U1**).  
- Frequency strings mature/medical/sexual/violence/chance: **all `NONE`**.  
- `gambling: false`, `lootBox: false`.  
- Không Kids; không override trừ user (U3).  
- **Kỳ vọng** calculated **4+** (VN **00+** band nếu chỉ descriptors 4+) — **không** claim đã live.

---

## 7. Unknown cần user (blocker mềm trước PATCH)

1. **U1** — Organizer catalog = UGC theo Apple? (đề xuất `false`)  
2. **U2** — Event media/copy thực tế có alcohol/mature/violence?  
3. **U3** — EULA minimum age &gt; rating tính toán?  
4. **U4** — Content Rights (field riêng) — ops theo checklist, ngoài questionnaire  

---

## 8. Checks

| Check | Kết quả |
| ----- | ------- |
| Docs-only paths | Chỉ 2 file mới trong PR |
| Không secrets / ASC mutate | Pass |
| Enum khớp API hiện hành | Pass (NONE/INFREQUENT/FREQUENT + booleans) |
| Không mâu thuẫn privacy-nutrition (no ads) | Pass |
| Runtime tests | **N/A** (docs-only) |

---

## 9. Verdict BA

| Mục | Verdict |
| --- | ------- |
| Questionnaire matrix reviewable | **PASS (docs)** |
| Source-backed (không all-false mù) | **PASS** — UGC/web/chat/gambling có rationale; U1/U2 flagged |
| ASC UI / API applied | **NOT claimed** |
| Legal counsel | **Unknown / not claimed** |

Reviewer DoD độc lập: exact SHA tip PR này; không reuse verdict privacy #308.
