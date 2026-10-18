# D13-S1-T3 / #316 — SDK / Xcode upload eligibility (đối chiếu live)

| Trường | Giá trị |
| ------ | ------- |
| Task | S1-T3 / Issue **#316** (Epic D13) |
| Ngày đối chiếu | **2026-10-18** |
| Role | `ios` |
| Agent / session | Cursor worker `task_9f3d64a5a2da` / `ctx_cf9f7aacafed` |
| Worktree tip khi viết | xem tip commit trên PR (cập nhật sau push) |
| Nguồn PRIMARY | Apple Upcoming Requirements — SDK minimum |

## 1. Nguồn Apple (live 2026-10-18)

### 1.1 Upcoming Requirements — PRIMARY (hiện hành)

| | |
| --- | --- |
| URL | https://developer.apple.com/news/upcoming-requirements/?id=04282026a |
| Index | https://developer.apple.com/news/upcoming-requirements/ |
| Tiêu đề | **SDK minimum requirements** |
| Hiệu lực | **Since April 28, 2026** |
| Nội dung quan sát | Apps uploaded to App Store Connect must be built with **Xcode 26 or later** using an SDK for **iOS 26** / iPadOS 26 / tvOS 26 / visionOS 26 / watchOS 26. |

**Không nhầm** với yêu cầu tương lai trên trang Submitting (mục 1.3).

### 1.2 App Store Connect Help — Upload builds

| | |
| --- | --- |
| URL | https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds |
| Bảng Supported Xcode Versions (iOS app) | **Built using Xcode 26 or later** |
| Note cùng trang | *"Starting in 2026, you'll be required to use **Xcode 14** or later to upload…"* — **lệch số** so với bảng / upcoming-requirements. |

### 1.3 Submitting apps — yêu cầu **tương lai** (không phải minimum hiện hành)

| | |
| --- | --- |
| URL | https://developer.apple.com/app-store/submitting/ |
| Quan sát | Khuyến khích build với **Xcode 27**; **Starting April 2027**, iOS/iPadOS apps must be built with **iOS & iPadOS 27 SDK or later**, and target iOS 15 or later. |

→ Đây là **cửa sổ Apr 2027**, **không** thay thế primary gate Xcode 26 / iOS 26 SDK kể từ 2026-04-28.

## 2. Screenshot inventory (headless, no mouse)

Phương thức: Playwright `chromium.launch({ channel: 'chrome', headless: true })` · capturedAt `2026-10-18T08:08:09.104Z`

| id | URL | Artifact (gitignored) | bytes |
| -- | --- | ---------------------- | ----- |
| upcoming-requirements-primary | `…/upcoming-requirements/?id=04282026a` | `apps/mobile/.uat-artifacts/sdk-eligibility-2026-10-18/upcoming-requirements-primary.png` | 154368 |
| upcoming-requirements-index | `…/upcoming-requirements/` | `…/upcoming-requirements-index.png` | 912972 |
| upload-builds-help | ASC Help upload-builds | `…/upload-builds-help.png` | 458526 |
| submitting-apps | `…/app-store/submitting/` | `…/submitting-apps.png` | 1323927 |

Metadata máy: `apps/mobile/.uat-artifacts/sdk-eligibility-2026-10-18/inventory.json`

## 3. Inventory máy build (fact)

| Kiểm tra | Kết quả |
| -------- | ------- |
| `xcodebuild -version` | **Xcode 26.5** · Build **17F42** |
| `xcrun --sdk iphoneos --show-sdk-version` | **26.5** |
| `xcrun --sdk iphoneos --show-sdk-build-version` | **23F73** |
| `xcode-select -p` | `/Applications/Xcode.app/Contents/Developer` |
| Deployment target (local `ios/` generated) | **IPHONEOS_DEPLOYMENT_TARGET = 16.4** |
| Team mục tiêu | `BLUA62D52G` (personal) |
| Bundle | `com.hangndat.ticket` · version `1.0.0` |

## 4. Kết luận (có điều kiện)

| Câu hỏi | Verdict |
| ------- | ------- |
| Inventory khớp PRIMARY upcoming (Xcode 26 + iOS 26 SDK since 2026-04-28)? | **Có** — 26.5 / 26.5 |
| Có nhầm với minimum Xcode 27 / iOS 27 SDK (Apr 2027)? | **Không** — đó là yêu cầu tương lai trên submitting page |
| Tuyên bố “ASC upload luôn accept” chỉ từ inventory? | **Không** — Help còn note Xcode 14; processing/rejection vẫn phụ thuộc Apple lúc upload binary |
| Archive/upload | **Chưa** — cần merge + review; **không** EAS Cloud |

**Fact:** máy đạt mức Upcoming Requirements SDK tối thiểu hiện hành (2026-04-28).  
**Inference:** binary build bằng toolchain này *có khả năng* thỏa primary SDK gate.  
**Unknown / residual:** validation thật chỉ sau archive/upload; Help note “Xcode 14” vs bảng “Xcode 26” chưa thể tự chốt tại client.
