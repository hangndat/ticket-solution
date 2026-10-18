# D13-BA — Privacy / SDK / App Review eligibility (S1-T1 · S1-T2 · S3-T3)

| Trường | Giá trị |
| ------ | ------- |
| Role | `product-ba` · `docs/agents/roles/product-ba.md` |
| Agent | `cursor` (`orca-agent-routing.mdc`) |
| Epic | [#301](https://github.com/hangndat/ticket-solution/issues/301) |
| Stories / Tasks GitHub | **Chưa tạo** ngoài Epic #301 lúc viết (2026-10-18) — gắn Story S1/S3 khi planner/coordinator mở Issue |
| Architecture impact | **Không** — reconcile docs vs source; không đổi telemetry/contract |
| Ownership paths | Chỉ `docs/asc/**` + file này |
| Source tip đọc apps/O06 (exact SHA) | `f551b6d2bdc06742f74a49a0970cb2bfae2f4e0e` (`origin/main` lúc BA) |
| Docs PR tip (exact SHA DoD) | `3b6a540e05cfeb89f614c9ec6e24c1ff5f60a1ad` · [PR #308](https://github.com/hangndat/ticket-solution/pull/308) |
| Ngày đối chiếu | **2026-10-18** (UTC) |
| Plan | `docs/plans/D13-APP-STORE-RELEASE-PLAN.md` (main worktree) |

---

## 1. Apple guidelines đã browse (primary)

| Chủ đề | URL | Ghi chú ngày 2026-10-18 |
| ------ | --- | ---------------------- |
| Account deletion 5.1.1(v) | https://developer.apple.com/support/offering-account-deletion-in-your-app/ | Phải **khởi tạo trong app**; được link web để hoàn tất; không chỉ deactivate; được mất thời gian hợp lý nếu thông báo; không bắt phone/email CS (trừ ngành regulated 5.1.1(ix)) |
| App Review Guidelines — Privacy | https://developer.apple.com/app-store/review/guidelines/#privacy | Living doc; privacy section áp dụng nộp app |
| User privacy & data use | https://developer.apple.com/app-store/user-privacy-and-data-use/ | Nutrition Labels + ATT; ATT không áp dụng MVP (không tracking) |
| Privacy manifest files | https://developer.apple.com/documentation/bundleresources/privacy_manifest_files | Xcode gộp manifest third-party → Privacy Report |
| Third-party SDK requirements | https://developer.apple.com/support/third-party-SDK-requirements/ | Hermes nằm trong list “commonly used”; ads/Firebase **không** có trong deps trực tiếp Vemoki |

**Không** claim counsel/legal đã duyệt policy.

---

## 2. O06 + live privacy (fact)

| Fact | Evidence |
| ---- | -------- |
| O06 đã chốt | `docs/DECISION-LOG.md` O06 · `docs/ops/O06-OPTIONS.md` — anonymize ≤30d; vé 365d; audit 730d; object ≤90d; single-region |
| BE wired account anonymize | `packages/backend/src/retention-o06.ts` (`O06_ACCOUNT_ANONYMIZE_MAX_DAYS = 30`) · `packages/backend/src/account-deletion.ts` (`policyStatus: RESOLVED`, ACK schedules ≤30d) — merge D12 tip liên quan `0a65f3c2f2d51357ee1a6270151d279758188fb7` |
| Ticket/object jobs | Stubs `NO_JOB_FRAMEWORK` trong `retention-o06.ts` — **policy documented**, enforcement 365d/90d chưa đủ job (ghi limitation; không bịa đã chạy) |
| Live privacy URL | `curl -sI https://vemoki.com/privacy` → **HTTP 200**; VI + EN copy retention khớp O06 |
| Live vs draft | Trang marketing **ngắn hơn** [privacy-policy-draft.md](../asc/privacy-policy-draft.md) (thiếu camera / deletion path chi tiết) |

---

## 3. In-app account deletion vs 5.1.1(v)

| Kiểm tra | Kết quả tại tip |
| -------- | --------------- |
| Entry in app | Có: `apps/mobile/src/screens/account.tsx` → `SessionScopedAccountDeletionPanel`; CTA **Yêu cầu xóa tài khoản** |
| API | `POST /v1/me/account-deletion-requests` (+ GET current) |
| Inform timeline | **Lệch:** UI copy `account-deletion-copy.ts` vẫn nói **“O06 chưa chốt”** / không hẹn ngày — **stale** so với DECISION-LOG + BE `RESOLVED` |
| Full delete vs deactivate | Request → anonymize pipeline (BE); không chỉ “disable” |
| CS phone/email bắt buộc | Không — phù hợp guidance |

**Finding mở (S5-T1 iOS — ngoài scope BA):** phải cập nhật copy in-app khớp O06 ≤30d trước submit; docs ASC đã refresh (Review notes) nhưng reviewer thấy UI cũ vẫn fail minh bạch.

---

## 4. SDK / Nutrition (S1-T2)

Inventory direct deps: xem bảng trong [privacy-nutrition.md](../asc/privacy-nutrition.md).

- Tracking / ads SDK: **Không**  
- Push: APNs via `expo-notifications` (Device ID Linked)  
- Camera: `expo-camera` scan-only  
- Secure storage: `expo-secure-store` on-device  
- Checked-in `PrivacyInfo.xcprivacy`: **không** có trong tip — dựa Expo module manifests sau prebuild; **revalidate Privacy Report** ở S4 trước upload  

**Architect escalate?** **Không** lúc này — không phát hiện cần đổi telemetry/contract. Mở S1-T2b chỉ nếu thêm SDK thu thập/tracking hoặc Nutrition lệch ADR.

---

## 5. Docs ASC đã cập nhật (PR này)

| File | Thay đổi chính |
| ---- | -------------- |
| `docs/asc/privacy-nutrition.md` | D13 header; URL 200; SDK inventory; checklist |
| `docs/asc/privacy-policy-draft.md` | Account deletion path + 5.1.1(v); ghi live page thinner |
| `docs/asc/app-review-notes.md` | Xóa “retention chưa finalize”; O06 ≤30d / 730d |
| `docs/asc/listing-metadata.md` | Reconcile Gate offline queue (D7/D11); keywords **per locale**; đếm keyword EN=83; version mismatch blocker |
| `docs/asc/asc-fields-checklist.md` | Privacy URL 200; territory **chưa chốt** (đề xuất VN); version ASC vs `0.1.0` source |
| `docs/asc/README.md` | D13 status + remaining work |

**Non-goals giữ:** không sửa `apps/**`; không EAS Cloud; không claim ASC đã điền; không commit prod password; không legal counsel claim; không tự chọn territories.

---

## 6. Checks (docs consistency — không test mirror)

| Check | Kết quả |
| ----- | ------- |
| Privacy URL links trong ASC docs → `https://vemoki.com/privacy` | Consistent |
| Retention numbers 30 / 365 / 730 / 90 khớp O06 + draft + nutrition + review notes | Consistent |
| `app-review-notes.md` không còn “finalize” / “chưa chốt” retention | Consistent |
| Source `account-deletion-copy.ts` vẫn stale | **Documented finding** — không sửa apps trong PR này |
| Story/Task Issue IDs | Chỉ #301 — comment gắn khi Issue con xuất hiện |

---

## 7. Findings còn mở (handoff coordinator)

1. **S5-T1:** Fix copy O06 in-app (`account-deletion-copy.ts`) — bắt buộc trước submit.  
2. **Version `1.0.0`:** coordinator chốt public đầu; docs listing/checklist dùng `1.0.0` + “First App Store release”; iOS bump binary + ASC `1.0`→`1.0.0` (không duplicate) — BA không claim upload / không sửa apps.  
3. **S3-T1:** Paste Nutrition + listing + fields ASC + screenshot (G2).  
4. **S2-T3 (optional but recommended):** Làm giàu `/privacy` live với camera + deletion path từ draft.  
5. **S5-T2:** Demo reviewer prod — ASC only.  
6. **S7-T1:** User chốt territory (đề xuất VN) — BA không chọn All.  
7. **S4:** Privacy Report sau local prebuild (Hermes / required-reason APIs).  
8. **BE limitation:** ticket/object retention jobs còn stub — không chặn Nutrition Labels.  
9. Board: tạo Story/Task Issues S1-T1/T2, S3-T3 gắn #301 nếu chưa có.

---

## 8. Verdict BA

| Mục | Verdict |
| --- | ------- |
| S1-T1 docs eligibility vs guidelines | **PASS (docs)** — lệch copy in-app ghi rõ, không ẩn |
| S1-T2 SDK vs Nutrition | **PASS (docs)** — không ads; revalidate Privacy Report ở archive |
| S3-T3 Review notes O06 | **PASS (docs)** — sẵn paste ASC |
| ASC UI filled / store submit | **NOT claimed** |
| Legal counsel | **Unknown / not claimed** |

Reviewer DoD độc lập: exact SHA tip PR (sau push), không reuse verdict D10.
