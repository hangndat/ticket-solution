# D13 S3-T1 — ASC fields remaining (#322)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | **2026-10-18** (UTC) |
| Issue | [#322](https://github.com/hangndat/ticket-solution/issues/322) · Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#306](https://github.com/hangndat/ticket-solution/issues/306) |
| Role | `ios` (+ `product-ba` đọc docs) · `docs/agents/roles/ios.md` · Agent Cursor |
| Architecture impact | **Không** — ASC metadata paste / read-back |
| Worktree tip (ops run) | `1ddc70d15e230efa59d8286b6bbda2973066a21a` |
| Listing source (reviewed) | BA SHA `2759b0a9a3e0ef30321e36367e4f10f6ca18ff4a` · [D13-ASC-METADATA-LIVE.md](./D13-ASC-METADATA-LIVE.md) |
| Categories (#354) | Receipt `/tmp/vemoki-d13-asc-categories-live.json` · PR tip `535e64908c9ed31d3a5814dc687d69701a58f6bf` |
| Age docs (PR #356) | DoD R2 **PASS with known gap** @ `edb6d6acf8f0d89fceaf141b54fd6d6ac10f1863` · [D13-PR356-R2-DOD.md](./D13-PR356-R2-DOD.md) |
| Screenshots (S3-T2) | [D13-S3-T2-SCREENSHOTS.md](./D13-S3-T2-SCREENSHOTS.md) / PR #360 |
| Receipt JSON | [D13-S3-T1-ASC-FIELDS.json](./D13-S3-T1-ASC-FIELDS.json) · read-back [D13-S3-T1-ASC-FIELDS-READBACK.json](./D13-S3-T1-ASC-FIELDS-READBACK.json) |
| Cấm | EAS Cloud · submit/release · secrets trong git · MED=`NONE` im lặng khi U2 mở |

## 1. Live ASC read-back (2026-10-18) — listing đã đủ

App `6823694490` · version `7c5ac05b-f543-4f71-8af3-a7b40073de7a` · **`1.0.0`** · state **PREPARE_FOR_SUBMISSION** · releaseType **MANUAL** · copyright `2026 Hang Nguyen Dat` · ASC display name **Vemoki**.

| Field | en-US | vi | Status |
| ----- | ----- | -- | ------ |
| Name / Subtitle | Vemoki / Event tickets & gate check-in | Vemoki / Vé sự kiện & check-in cổng | **Live** |
| Description | Present (len 1419) | Present (len 1252) | **Live** (hash prior receipt) |
| Keywords | 83 bytes ASCII | 78 UTF-8 bytes | **Live** (≤100) |
| Support URL | `https://vemoki.com/support` | same | **Live** · HTTP **200** |
| Marketing URL | `https://vemoki.com` | same | **Live** |
| Privacy Policy URL | `https://vemoki.com/privacy` | same | **Live** · HTTP **200** |
| Promotional Text | Present | Present | **Live** |
| Primary / Secondary category | ENTERTAINMENT / BUSINESS | — | **Live** (#354) |
| What’s New | *null* | *null* | **Blocked** — see §3 |
| Age rating questionnaire | mostly `null` | — | **Blocked** — see §2 |
| Build selected | `null` | — | Outside S3-T1 (S4) |
| App Store Review Detail | `null` | — | Outside / follow-up |
| Content Rights Declaration | `null` | — | Follow-up (U4) |
| Availability / territory | unchanged | — | **Not touched** (user chốt) |

**Không submit / không release / không đổi Availability.**

## 2. Age rating — attempted §6A, then skipped (coordinator C)

### Attempt

- Source: [docs/asc/age-rating-questionnaire.md](../asc/age-rating-questionnaire.md) §6A (HIGH-only; omit MED U2).
- `PATCH /v1/ageRatingDeclarations/d67d05a9-a4da-4d14-abd4-b17b8e5aa0e4`
- Result: **HTTP 409** `ENTITY_ERROR.ATTRIBUTE.REQUIRED` — Apple **bắt buộc** đồng thời:
  - `alcoholTobaccoOrDrugUseOrReferences`
  - `matureOrSuggestiveThemes`
  - `sexualContentOrNudity`
  - `sexualContentGraphicAndNudity`
- Partial §6A **không** được API chấp nhận trên entity này.
- Live attributes sau attempt: HIGH keys vẫn `null`; MED vẫn `null` (không ghi đè).

### Decision

Coordinator ask reply (**option C**): *Skip age PATCH; document blocker only. Không chọn B — không authorize MED=`NONE` im lặng (BA U2 còn mở; PR356 known gap).*

| Cổng | Verdict |
| ---- | ------- |
| Listing fields (desc/keywords/URLs/categories) | **Done / verified live** |
| Age rating applied | **NOT done** — blocker U2 + API requires MED keys |
| Calculated / “all 4+” | **NOT claimed** |
| Full questionnaire ready | **Blocked** until user chốt MED (U2) |

Follow-up: khi user trả lời U2 (nội dung event pilot có rượu/gợi cảm/tình dục hay không), ops PATCH full required attributes + GET read-back — Task/wave riêng; **không** nuốt vào claim #322 listing-done.

## 3. What’s New — cannot edit (no build)

- Attempted `PATCH` `whatsNew` en-US + vi từ [listing-metadata.md](../asc/listing-metadata.md).
- Result: **HTTP 409** `STATE_ERROR` — `Attribute 'whatsNew' cannot be edited at this time`.
- Version `build` relationship = **null** (chưa chọn build) → khớp ràng buộc ASC.
- Coordinator: document; **không force**.
- Follow-up: sau S4 gắn build VALID → paste What’s New EN/VI.

## 4. Gap checklist D13 (quan sát)

| ID | Trước S3-T1 ops này | Sau |
| -- | ------------------- | --- |
| G2 ASC listing metadata trống | Mở một phần | **Đóng phần listing** (name/subtitle/desc/keywords/URLs/promo/categories/version/copyright) — chưa screenshot ASC UI che secret; chưa submit |
| Age questionnaire | Docs ready (PR356); live null | **Vẫn mở** — API 409 + U2 |
| What’s New | null | **Vẫn mở** — cần build |
| G3 Screenshots | Đóng phần en-US (S3-T2) | Không đổi |
| Privacy Nutrition Labels | Blocker session riêng | Không đụng |
| Territory | Chờ user | Không đụng |

## 5. Claim boundary

- State vẫn **PREPARE_FOR_SUBMISSION**.
- Listing draft fields trong phạm vi task **đã live và read-back**.
- Age rating **chưa** apply; What’s New **chưa** apply.
- **Không** TestFlight / In Review / Ready for Sale.
- Không commit API key / issuer / token / `.p8`.
- Implementer evidence; DoD reviewer độc lập trên exact SHA commit chứa artifact này (khi mở PR).

## 6. Checks

| Check | Kết quả |
| ----- | ------- |
| CRG `list_graph_stats` | PASS (session) |
| ASC GET read-back listing | PASS |
| Support / Privacy HTTP 200 | PASS |
| Categories ENTERTAINMENT+BUSINESS | PASS |
| Age §6A PATCH | **409** → skipped per C |
| what’sNew PATCH | **409** → documented |
| Submit/release/Availability | Not performed |

## 7. DoD checklist (implementer)

- [x] Description / keywords / support / privacy / categories verified live (en-US+vi)
- [x] Age rating: attempted authorized §6A; blocked; documented (no silent MED=`NONE`)
- [x] Evidence + JSON (no secrets)
- [x] Không submit/release
- [ ] DoD Cursor reviewer ≠ implementer (exact SHA sau commit/PR)
- [ ] Age rating + What’s New follow-up khi U2 + build sẵn
