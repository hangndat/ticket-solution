# D13-S1-T3 — SDK / Xcode upload eligibility (đối chiếu live)

| Trường | Giá trị |
| ------ | ------- |
| Task | S1-T3 (Epic D13 / #301) |
| Ngày đối chiếu | **2026-10-18** |
| Role | `ios` (toolchain xác nhận) |
| Agent / session | Cursor worker `task_309e6a5978a2` / `ctx_284cb2cea2d7` |
| Worktree tip khi viết | *(điền SHA tip PR sau commit)* |

## 1. Nguồn Apple (live ngày chạy)

### 1.1 Upcoming Requirements (primary)

- URL: https://developer.apple.com/news/upcoming-requirements/?id=04282026a  
- Tiêu đề quan sát: **SDK minimum requirements**  
- Nội dung (tóm tắt, không bịa thêm): From **April 28, 2026**, apps uploaded to App Store Connect must be built with **Xcode 26 or later** using an SDK for **iOS 26** / iPadOS 26 / tvOS 26 / visionOS 26 / watchOS 26.

### 1.2 App Store Connect Help — Upload builds (submitting)

- URL: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds  
- Bảng **Supported Xcode Versions** (ngày đối chiếu): iOS app **Built using Xcode 26 or later** (upload client có thể thấp hơn theo bảng).  
- **Mâu thuẫn / ghi chú cùng trang:** dòng note *"Starting in 2026, you'll be required to use **Xcode 14** or later to upload…"* — **không khớp** số **Xcode 26** ở bảng / upcoming-requirements.  
- **Quy tắc Task:** **không** tự chốt eligibility khi nguồn Apple mâu thuẫn; ghi cả hai + inventory máy.

## 2. Inventory máy build (fact)

| Kiểm tra | Kết quả |
| -------- | ------- |
| `xcodebuild -version` | **Xcode 26.5** · Build **17F42** |
| `xcrun --sdk iphoneos --show-sdk-version` | **26.5** |
| `xcrun --sdk iphoneos --show-sdk-build-version` | **23F73** |
| `xcode-select -p` | `/Applications/Xcode.app/Contents/Developer` |
| Team mục tiêu | `BLUA62D52G` (personal) — không dùng team công ty khi archive |

## 3. Kết luận (có điều kiện)

| Câu hỏi | Verdict |
| ------- | ------- |
| Inventory có khớp upcoming-requirements (Xcode 26 + iOS 26 SDK)? | **Có** — 26.5 / 26.5 |
| Có được tuyên bố “ASC upload luôn accept” chỉ từ inventory? | **Không** — Help page còn note Xcode 14; processing/rejection vẫn phụ thuộc Apple lúc upload |
| Hành động tiếp | Archive/upload (S4) trên tip sau DoD; nếu Apple reject SDK → escalate với log altool/Transporter, không đổi EAS Cloud |

**Fact:** máy đạt mức **Upcoming Requirements 2026-04-28**.  
**Inference:** binary build bằng toolchain này *có khả năng* thỏa primary SDK gate.  
**Unknown:** Apple có enforce note “Xcode 14” vs bảng “Xcode 26” thế nào tại thời điểm upload thật — chỉ biết sau S4-T2 processing.
