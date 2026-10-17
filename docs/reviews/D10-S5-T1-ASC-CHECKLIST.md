# D10-S5-T1 — Checklist ASC + artifact metadata (tổng hợp nghiệm thu)

| Field | Value |
| --- | --- |
| Issue | [#164](https://github.com/hangndat/ticket-solution/issues/164) |
| Parent | Story [#163](https://github.com/hangndat/ticket-solution/issues/163) → Epic [#150](https://github.com/hangndat/ticket-solution/issues/150) |
| Role | `product-ba` (`docs/agents/roles/product-ba.md`) |
| Ownership | `docs/reviews` + liên kết `docs/asc` / `docs/ops` (docs-only) |
| Base `main` lúc soạn | `361deddeea7a83e628ece69d9ed6307d08fc7468` |
| Bundle / product | `com.hangndat.ticket` · **Vemoki** · Team `BLUA62D52G` |
| App Store / TestFlight submit từ task này | **Không** |
| EAS Cloud Build | **Không dùng** |

## Mục tiêu

Tổng hợp checklist metadata App Store Connect đã có từ S1–S3 + archive/TestFlight prep (S4) thành **một artifact nghiệm thu**: mục đã đủ / thiếu / link evidence + **exact SHA** liên quan. Không claim đã upload ASC / đã submit store nếu chưa có evidence.

## Claim boundary

| Claim | Status |
| --- | --- |
| Docs listing / privacy / App Review notes đã merge | **Có** (PR #170) |
| Screenshots sim local đã capture + checklist | **Có** (PR #181) — PNG gitignored, **chưa** upload ASC UI |
| Local `xcodebuild archive` Team `BLUA62D52G` | **Có** (PR #204 / #161) |
| TestFlight internal **prep** checklist | **Có** (PR #205 / #162) |
| TestFlight IPA **đã upload** | **Không** — gap documented (#162) |
| Privacy URL `https://vemoki.com/privacy` live 200 | **Không** — 404 blocker submit |
| Field ASC đã điền trên ASC console | **Không claim** — checklist docs ☐; chưa có screenshot ASC UI |
| App Store production submit | **Không** |

---

## 1. Mục đã đủ (docs + evidence trên repo / Issue)

### 1.1 S1 — Listing metadata + ASC fields (#151–#153)

| Mục | Evidence | Exact SHA |
| --- | --- | --- |
| Copy listing VI/EN + keywords | [`docs/asc/listing-metadata.md`](../asc/listing-metadata.md) · Issue [#152](https://github.com/hangndat/ticket-solution/issues/152) | Tip pre-merge PR #170: `b1232f53d5fc9352283423b4feea3a8493c140e4` · Merge: `91e8c0fff75f038d8583b71303d70b4bd96e11d2` |
| Checklist field ASC (bundle / category / URLs / rating) | [`docs/asc/asc-fields-checklist.md`](../asc/asc-fields-checklist.md) · Issue [#153](https://github.com/hangndat/ticket-solution/issues/153) | Cùng PR #170 (merge trên) |
| Pointer mobile | `apps/mobile/ASC-METADATA.md` | Cùng PR #170 |
| Handoff S1+S3 | [`docs/reviews/D10-ASC-S1-S3-METADATA.md`](./D10-ASC-S1-S3-METADATA.md) | Content gốc worker: `dd6f7bed1556b9b7971f9fbaac476f84a2bbcac0` (file trên main qua #170) |
| Issue comments | [#151](https://github.com/hangndat/ticket-solution/issues/151), [#152](https://github.com/hangndat/ticket-solution/issues/152) | Tip / merge như trên |

**Ghi chú DoD #170:** Fail lần 1 (EN Promotional Text 182 > 170) trên `6f559fad0d3d3d9efd19389108bd05d64a7141d4`; đã sửa ≤170; tip trước merge `b1232f53d5fc9352283423b4feea3a8493c140e4`. PR #170 **MERGED**.

### 1.2 S3 — Privacy nutrition + App Review notes (#157–#159)

| Mục | Evidence | Exact SHA |
| --- | --- | --- |
| Privacy Nutrition Labels + policy URL (docs) | [`docs/asc/privacy-nutrition.md`](../asc/privacy-nutrition.md) · [#158](https://github.com/hangndat/ticket-solution/issues/158) | PR #170 tip / merge như §1.1 |
| Draft privacy policy (host trước submit) | [`docs/asc/privacy-policy-draft.md`](../asc/privacy-policy-draft.md) | Cùng PR #170 |
| App Review notes + tài khoản demo (fixture) | [`docs/asc/app-review-notes.md`](../asc/app-review-notes.md) · [#159](https://github.com/hangndat/ticket-solution/issues/159) | Cùng PR #170 |
| Index docs ASC | [`docs/asc/README.md`](../asc/README.md) | Cùng PR #170 |
| Issue comments | [#157](https://github.com/hangndat/ticket-solution/issues/157) | Cùng tip / merge |

### 1.3 S2 — Screenshots & preview (#154–#156)

| Mục | Evidence | Exact SHA |
| --- | --- | --- |
| Checklist kích thước / slot ASC | [`docs/ops/D10-SCREENSHOTS-CHECKLIST.md`](../ops/D10-SCREENSHOTS-CHECKLIST.md) | Tip PR #181: `4ba381d1035e8864a9fb1e0d6d4be1fcb3a06d2e` · Merge: `b672de852c163a24bcd9f3b5f680786aa14f7cb6` |
| Capture notes (sim local) | [`docs/reviews/d10-screenshots-notes.md`](./d10-screenshots-notes.md) | Cùng tip `4ba381d…` |
| PNG local (gitignored) | `apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/*.png`, `ipad-13/01-events.png`, `manifest.json` | Capture host only — **không** trong git |
| DoD | Issue [#155](https://github.com/hangndat/ticket-solution/issues/155) comment · `docs/reviews/D10-PR-181-DOD.md` (nếu còn trên branch DoD) | Reviewed SHA: `4ba381d1035e8864a9fb1e0d6d4be1fcb3a06d2e` · **PASS with known gap** |
| Preview video | **N/A** có chủ đích (storyboard = 5 PNG iPhone 6.9") | Documented trong notes / checklist § T2 |

**Phương thức:** `xcrun simctl io` + AXe HID — **không** EAS Cloud.

### 1.4 S4 — Local archive + TestFlight prep (#160–#162)

| Mục | Evidence | Exact SHA |
| --- | --- | --- |
| Archive local `xcodebuild` Team `BLUA62D52G` | [`docs/reviews/D10-S4-T1-ARCHIVE.md`](./D10-S4-T1-ARCHIVE.md) · [#161](https://github.com/hangndat/ticket-solution/issues/161) · PR [#204](https://github.com/hangndat/ticket-solution/pull/204) | Tip duyệt: `3629a526a3f9f0b6cc61e94645f796f61e3d0d0c` · Source archive: `f4e079d8266d8ad56af9411d92ea4ed03390becc` · main sau merge evidence: `e7e5beb48971ed3fb3d6c12312702a37b214aee4` |
| DoD archive | [`docs/reviews/D10-S4-T1-ARCHIVE-DOD.md`](./D10-S4-T1-ARCHIVE-DOD.md) · PR [#207](https://github.com/hangndat/ticket-solution/pull/207) | **PASS** trên tip `3629a526a3f9f0b6cc61e94645f796f61e3d0d0c` |
| TestFlight internal **prep** (commands + gaps) | [`docs/reviews/D10-S4-T2-TESTFLIGHT-PREP.md`](./D10-S4-T2-TESTFLIGHT-PREP.md) · [#162](https://github.com/hangndat/ticket-solution/issues/162) · PR [#205](https://github.com/hangndat/ticket-solution/pull/205) | Tip duyệt: `1a1dee47cd6862447c500133330df9134465e37e` · main sau merge DoD: `361deddeea7a83e628ece69d9ed6307d08fc7468` |
| DoD TF prep | [`docs/reviews/D10-S4-T2-TESTFLIGHT-PREP-DOD.md`](./D10-S4-T2-TESTFLIGHT-PREP-DOD.md) · PR [#208](https://github.com/hangndat/ticket-solution/pull/208) | **PASS with known gap** trên `1a1dee47cd6862447c500133330df9134465e37e` |
| Story #160 đóng | Comment [#160](https://github.com/hangndat/ticket-solution/issues/160): #161 + #162 DoD pass (gap upload documented) | — |

**Archive:** `ARCHIVE SUCCEEDED` · path local gitignored `apps/mobile/.expo/archives/Vemoki-D10-S4-T1.xcarchive` · signing Apple Development (Automatic) · version `0.1.0` build `9`.

---

## 2. Mục thiếu / gap (không bịa “đã upload ASC”)

| # | Gap | Chặn gì | Evidence / nguồn |
| --- | --- | --- | --- |
| G1 | `https://vemoki.com/privacy` còn **404** | Submit App Store / điền Privacy Policy URL sống | `D10-ASC-S1-S3-METADATA.md`, comments #151/#157 |
| G2 | Field ASC UI chưa có evidence “đã điền” (checklist ☐; chưa screenshot ASC che secret) | Claim “metadata ASC live” | `asc-fields-checklist.md` cột Điền ASC |
| G3 | Screenshots PNG **chưa upload** vào ASC Media | Listing complete trên console | `d10-screenshots-notes.md` Limits; DoD #181 known gap |
| G4 | iPad màn phụ có thể cần retake (a11y duplicate labels) | Chất lượng media iPad | `d10-screenshots-notes.md` |
| G5 | TestFlight **chưa upload** IPA | Internal TF distribution | #162: ASC Issuer unset; thiếu App Store provisioning `BLUA62D52G` / `com.hangndat.ticket` |
| G6 | Archive ký Development (chưa export Distribution IPA) | IPA / TF upload path | #161 DoD limitation |
| G7 | Credential demo production — chỉ paste ASC, không vào git | Ops submit | `app-review-notes.md` / metadata handoff |
| G8 | App Store **production submit** | Store live | Ngoài scope D10 prep; **không** làm trong #164 |

Các gap G1–G8 **không** làm fail mục tiêu #164 (tổng hợp checklist docs + evidence). Chúng **chặn** claim “đã submit / đã upload ASC/TF”.

---

## 3. Ma trận Story → artifact → SHA (tra cứu nhanh)

| Story / Task | Issue | PR | Artifact chính | Exact SHA (duyệt / tip) |
| --- | --- | --- | --- | --- |
| S1 listing + fields | #151–#153 | [#170](https://github.com/hangndat/ticket-solution/pull/170) | `docs/asc/*`, `D10-ASC-S1-S3-METADATA.md` | `b1232f53d5fc9352283423b4feea3a8493c140e4` (tip) / `91e8c0fff75f038d8583b71303d70b4bd96e11d2` (merge) |
| S2 screenshots | #154–#156 | [#181](https://github.com/hangndat/ticket-solution/pull/181) | `D10-SCREENSHOTS-CHECKLIST.md`, `d10-screenshots-notes.md` | `4ba381d1035e8864a9fb1e0d6d4be1fcb3a06d2e` (tip) / `b672de852c163a24bcd9f3b5f680786aa14f7cb6` (merge) |
| S3 privacy + review | #157–#159 | #170 | `privacy-*.md`, `app-review-notes.md` | Cùng #170 |
| S4-T1 archive | #161 | [#204](https://github.com/hangndat/ticket-solution/pull/204) / DoD [#207](https://github.com/hangndat/ticket-solution/pull/207) | `D10-S4-T1-ARCHIVE.md` (+ DOD) | `3629a526a3f9f0b6cc61e94645f796f61e3d0d0c` |
| S4-T2 TF prep | #162 | [#205](https://github.com/hangndat/ticket-solution/pull/205) / DoD [#208](https://github.com/hangndat/ticket-solution/pull/208) | `D10-S4-T2-TESTFLIGHT-PREP.md` (+ DOD) | `1a1dee47cd6862447c500133330df9134465e37e` |
| S5-T1 checklist (này) | #164 | _(PR này)_ | `docs/reviews/D10-S5-T1-ASC-CHECKLIST.md` | `git rev-parse HEAD` trên branch `hangndat/d10-s5-t1-asc-checklist` |

---

## 4. Checks (task #164)

- Docs-only: thêm file checklist này; **không** sửa `apps/**` runtime; **không** EAS Cloud; **không** App Store / TestFlight submit.
- Nguồn: đọc `docs/reviews/D10-*`, `docs/asc/**`, comments Issues #151 / #157 / #160 (+ #152/#155/#161/#162 liên quan).
- Không bịa upload ASC: mọi mục “đã upload / đã submit” ghi **Không** hoặc gap.

## 5. Verdict handoff (implementer)

**Artifacts complete for Chờ duyệt** — checklist tổng hợp đủ để nghiệm thu docs metadata D10 prep.  
**Không** claim App Store submitted / TestFlight uploaded / privacy URL live / ASC console filled.

Coordinator: spawn Cursor DoD reviewer độc lập (`reviewer-dod`) trên **exact tip SHA** của PR #164; không self-merge.
