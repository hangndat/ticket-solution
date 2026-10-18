# D13 — Checklist field App Store Connect (reuse D10)

**Epic D13:** [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story S3-T1 (ops điền UI)  
**Reuse D10:** [#153](https://github.com/hangndat/ticket-solution/issues/153) / Epic [#150](https://github.com/hangndat/ticket-solution/issues/150) — ☐ dưới đây = **ASC UI chưa có evidence điền**; docs ≠ đã paste  
**Mục đích:** checklist điền ASC cho bundle `com.hangndat.ticket` — **prep only**, không submit.  
**Evidence screenshot:** chụp màn hình ASC sau khi điền (che API key / signing); gắn comment Issue khi có. Docs này là nguồn giá trị field.

---

## 1. App identity

| Field | Giá trị | Nguồn / ghi chú | Điền ASC |
| --- | --- | --- | --- |
| Apple Developer Team | `BLUA62D52G` (Hang Nguyen Dat — personal) | `apps/mobile/app.config.ts` → `ios.appleTeamId` | ☐ |
| Bundle ID | `com.hangndat.ticket` | `ios.bundleIdentifier` | ☐ |
| SKU (ASC, một lần) | `vemoki-ios` (gợi ý; đổi nếu ASC đã tạo SKU khác) | Chọn khi tạo app record | ☐ |
| Primary language | English (U.S.) | Listing EN primary; VI thêm localization | ☐ |
| App name (ASC) | Vemoki | [listing-metadata.md](./listing-metadata.md) | ☐ |
| Privacy Policy URL | `https://vemoki.com/privacy` | Host **HTTP 200** (đối chiếu 2026-10-18) — xem [privacy-nutrition.md](./privacy-nutrition.md); ☐ = ASC chưa paste | ☐ |
| Subtitle | Event tickets & gate check-in | listing-metadata | ☐ |

**Cấm:** dùng team công ty khác trên máy (`3WHS6JDYV2` / SCHMELER ERUNG).

---

## 2. Pricing & availability

| Field | Giá trị đề xuất | Điền ASC |
| --- | --- | --- |
| Price | Free | ☐ |
| Availability | **Chưa chốt** — đề xuất D13: chỉ **Việt Nam** lần publish đầu; **không** chọn All cho đến khi user xác nhận (S7-T1) | ☐ |
| Pre-order | No | ☐ |
| Apple Arcade | No | ☐ |

---

## 3. App Information

| Field | Giá trị đề xuất | Điền ASC |
| --- | --- | --- |
| Category primary | Entertainment | ☐ |
| Category secondary | Business | ☐ |
| Content rights | Does not contain third-party content you do not have rights to (hoặc declare đúng nếu có brand event) | ☐ |
| Age rating | Questionnaire → dự kiến **4+** (không UGC công khai, không gambling, không violence) — **chạy wizard ASC và lưu kết quả** | ☐ |
| Copyright | `2026 Hang Nguyen Dat` | ☐ |

---

## 4. Version information (version string khớp binary)

| Field | Giá trị | Điền ASC |
| --- | --- | --- |
| Version | `0.1.0` (khớp `app.config.ts` `version`) | ☐ |
| Copyright (version) | `2026 Hang Nguyen Dat` | ☐ |
| Description / Keywords / URLs / What’s New | Copy từ [listing-metadata.md](./listing-metadata.md) | ☐ |
| Support URL | `https://vemoki.com` | ☐ |
| Marketing URL | `https://vemoki.com` (optional) | ☐ |
| Promotional Text | EN/VI theo listing | ☐ |

Localization: thêm **Vietnamese** với copy VI trong listing-metadata.

---

## 5. App Review Information

| Field | Giá trị | Điền ASC |
| --- | --- | --- |
| Contact name | Hang Nguyen Dat | ☐ |
| Contact phone | *[điền số thật trong ASC UI — không commit vào git]* | ☐ |
| Contact email | `hangndat@gmail.com` (Apple ID developer) hoặc alias support khi có | ☐ |
| Demo account | Xem [app-review-notes.md](./app-review-notes.md) — paste vào ASC, không coi là prod secret | ☐ |
| Notes | Dán nội dung App Review notes | ☐ |
| Attachment | Optional: PDF short walkthrough nếu cần | ☐ |
| Sign-in required | **Yes** | ☐ |

---

## 6. Version release

| Field | Giá trị | Điền ASC |
| --- | --- | --- |
| Release | **Manually release this version** (khuyến nghị pilot) | ☐ |
| Phased release | Optional sau khi approved | ☐ |

**Không** chọn submit for review từ checklist docs này.

---

## 7. Build / signing (liên quan binary — Story archive riêng)

| Mục | Kỳ vọng | Trạng thái docs |
| --- | --- | --- |
| Archive | Local Xcode / `xcodebuild` · Team `BLUA62D52G` | Ngoài S1 — ☐ |
| EAS Cloud Build | **Cấm** | N/A |
| `aps-environment` | `production` trước Archive/TestFlight (`APS_ENVIRONMENT=production`) | ☐ |
| Export compliance | `ITSAppUsesNonExemptEncryption: false` trong `app.config.ts` | Sẵn trong config |
| Encryption question ASC | Standard encryption / exempt — khớp Info.plist | ☐ |

---

## 8. Capabilities / entitlements (đối chiếu)

| Capability | Cần? | Ghi chú |
| --- | --- | --- |
| Push Notifications | Yes | `UIBackgroundModes: remote-notification` + APNs |
| Camera | Yes (staff scan) | Usage string: “Scan ticket QR codes at the gate.” |
| Associated Domains | Chỉ khi đã cấu hình Universal Links production | Hiện scheme `vemoki` / `ticketsolution` |
| In-App Purchase | No (MVP không bán trong app) | — |
| Sign in with Apple | Không bắt buộc nếu OIDC Keycloak là IdP chính; ASC có thể hỏi — trả lời theo [app-review-notes.md](./app-review-notes.md) | ☐ |

---

## 9. Checklist nghiệm thu docs (#153)

- [x] Bundle ID / Team / SKU gợi ý ghi rõ  
- [x] Category, URLs, version, copyright, review contact fields  
- [x] Export compliance tham chiếu config  
- [x] Ghi rõ **chưa submit**  
- [ ] Screenshot ASC đã điền (sau thao tác tay trên ASC — gắn Issue #153)  

Khi dán xong trên ASC: comment Issue #153 với ngày + (tuỳ chọn) ảnh che secret; **không** tick “submitted for review” trừ khi task phát hành riêng ủy quyền.
