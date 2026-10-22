# D13 — Phát hành công khai App Store (Vemoki)

> **Đã duyệt triển khai:** user “duyệt”, 2026-10-18. Epic [#301](https://github.com/hangndat/ticket-solution/issues/301). Run thực thi `run_1af161001850`. Các phần nói “chưa duyệt/chờ review” bên dưới là baseline lập kế hoạch; approval hiện tại cho phép triển khai end-to-end đến publish sau các cổng bắt buộc. Territory chưa chốt, không tự chọn All.

| Trường | Giá trị |
| ------ | ------- |
| Vai trò | Epic planner (`orca-epic-orchestrator.mdc`) — **không** role coding catalog |
| Agent | `cursor` (theo `orca-agent-routing-coordinator.mdc`) |
| Ngày soạn | 2026-10-18 |
| Orca task / dispatch | `task_ea2a717daa59` / `ctx_396c6aac3233` |
| Ownership file | **Chỉ file này** — không sửa `apps/**`, `docs/ops/RUNBOOK.md`, board, không commit/push/PR/merge |
| Board (authority) | [Project #3](https://github.com/users/hangndat/projects/3) |
| Worktree HEAD lúc soạn | `f551b6d2bdc06742f74a49a0970cb2bfae2f4e0e` |
| Deploy tip prod đã đối chiếu (D12) | `0a65f3c2f2d51357ee1a6270151d279758188fb7` |

**Ủy quyền hiện tại:** lập **roadmap / plan để user review trước feature coding**. User đã đặt mục tiêu **publish App Store** — sau khi roadmap được duyệt, **không** dựng thêm gate “xin ủy quyền submit” lần nữa; các cổng còn lại là **dữ kiện** (account/legal/territory đã chốt, credential, go/no-go runtime, Apple processing). Phê duyệt roadmap vẫn là cổng trước coding/ops dispatch.

**Architecture impact (bước lập kế hoạch này):** **Không** — chỉ phân Story/Task. Mỗi Task dưới đây tự đánh giá; giao Role `architect` khi còn quyết định kỹ thuật chưa giải quyết (xem cột AI).

**Territory (BA khuyến nghị — chờ user chốt):** So sánh VN vs All: [D13-TERRITORY-GATE-DECISION.md](../reviews/D13-TERRITORY-GATE-DECISION.md) (2026-10-19). **Mặc định đề xuất:** Availability **chỉ Việt Nam** lần Ready for Sale đầu (Price vẫn **Free**; không IAP). **Chưa** thao tác ASC — user phải xác nhận một dòng trước S3 Availability / S7-T1. **Không** chọn All countries cho đến khi user chọn leo thang §Territory gate bên dưới. S3 pricing/availability và S7 evidence territory **phải khớp** cùng một lựa chọn.

**Không phải:** code complete · acceptance complete · pilot ready · App Store public. Upload IPA / TestFlight / “Waiting for Review” / “Pending Developer Release” **không** = publish.

---

## 0. Outcome Epic (Definition of Publish)

Epic D13 **Hoàn thành** trên Project #3 chỉ khi có **evidence publish công khai** đồng thời:

| Field | Yêu cầu nghiệm thu |
| ----- | ------------------ |
| **App Store URL** | Link công khai kiểu `https://apps.apple.com/.../id…` (hoặc tương đương region storefront) mở được không cần đăng nhập ASC |
| **Version** | `CFBundleShortVersionString` (+ build nếu cần) khớp binary **Ready for Sale** / đang phục vụ trên storefront |
| **Territory** | Ít nhất một quốc gia/region đã chọn trong ASC **Availability** có trạng thái bán công khai (ghi rõ danh sách hoặc “All” + screenshot/export che secret) |
| **Exact SHA** | Source tip đã archive/upload/submit được ghi trong `docs/reviews/D13-*` + DoD độc lập |
| **Runtime** | Binary store trỏ API/OIDC/privacy **production** thật (`vemoki.com` / `api.vemoki.com` / `auth.vemoki.com`) — không staging giả làm prod |

### 0.1 Không đủ để claim publish

| Cột mốc | Được ghi nhận như | Không được gọi là |
| ------- | ----------------- | ----------------- |
| Local archive / export IPA | Evidence build | Publish |
| Upload ASC / processing xanh | Evidence upload | Publish |
| TestFlight Internal/External | Evidence phân phối thử | Publish |
| Submit for Review / In Review | Evidence review loop | Publish |
| Approved nhưng Manual Release chưa bấm | Evidence approval | Publish |
| **Ready for Sale + URL/version/territory evidence** | **Publish** | — |

### 0.2 Phân loại bằng chứng

| Loại | Nghĩa |
| ---- | ----- |
| **Fact** | Board / `gh` / artifact + exact SHA / HTTP quan sát lúc viết |
| **Inference** | Kết luận từ fact + PRD/TD/DECISION |
| **Unknown / blocker** | Chưa xác minh — **không bịa** agreement/legal/credential |

---

## 1. Baseline board & evidence tái sử dụng

### 1.1 Project #3 (fact — `gh project item-list 3 --owner hangndat --limit 200`, 2026-10-18)

| Issue | Status | Ghi chú |
| ----- | ------ | ------- |
| [#150](https://github.com/hangndat/ticket-solution/issues/150) D10 Epic | **Hoàn thành** | Metadata + archive **prep**; không submit |
| [#222](https://github.com/hangndat/ticket-solution/issues/222) D11 Epic | **Hoàn thành** | UX/UI production scope đã nghiệm thu đợt |
| [#293](https://github.com/hangndat/ticket-solution/issues/293) D12 Epic | **Đang làm** | Parent còn mở dù child coding xong |
| [#294](https://github.com/hangndat/ticket-solution/issues/294) / [#295](https://github.com/hangndat/ticket-solution/issues/295) / [#296](https://github.com/hangndat/ticket-solution/issues/296) | **Hoàn thành** | Web / BE / coordinator D12 |
| [#7](https://github.com/hangndat/ticket-solution/issues/7) | **Chưa lên lịch** | Hủy ngoài phạm vi (Android/payment/seat/Wallet) |

Snapshot bảng ROADMAP ngày 17/10 (D10 “Chưa lên lịch”) là **lịch sử** — board thắng.

### 1.2 Ma trận tái sử dụng D10 / D12 (theo SHA — không làm lại nếu vẫn đúng tip)

| Artifact | Exact SHA / tip | Được tái sử dụng cho | Phải làm lại / làm mới khi |
| -------- | --------------- | -------------------- | -------------------------- |
| Listing + privacy nutrition + review notes docs | Tip PR #170 `b1232f53d5fc9352283423b4feea3a8493c140e4` · merge `91e8c0fff75f038d8583b71303d70b4bd96e11d2` | Copy nguồn paste ASC | Copy lệch O06 / SDK / account-deletion thật; hoặc Apple đổi field bắt buộc |
| Screenshots checklist + sim capture notes | Tip PR #181 `4ba381d1035e8864a9fb1e0d6d4be1fcb3a06d2e` · merge `b672de852c163a24bcd9f3b5f680786aa14f7cb6` | Slot kích thước ASC | UI đổi lớn sau tip; PNG local mất; iPad retake |
| Local archive S4-T1 | Tip duyệt `3629a526a3f9f0b6cc61e94645f796f61e3d0d0c` · source archive `f4e079d8266d8ad56af9411d92ea4ed03390becc` | Lịch sử S4 | Binary store phải archive **tip submit** mới |
| Local archive S5-T2 | Source tip `ed873a2046fbff26c69e6d828a90e3515b458f62` · version `0.1.0` (9) · Team `BLUA62D52G` | Chứng minh toolchain local | Tip `apps/mobile` đã diverge → archive lại trên tip D13 |
| TF prep checklist | Tip `1a1dee47cd6862447c500133330df9134465e37e` | Lệnh export/upload | Gap upload vẫn mở — **không** coi prep = uploaded |
| ASC checklist tổng hợp | [D10-S5-T1-ASC-CHECKLIST.md](../reviews/D10-S5-T1-ASC-CHECKLIST.md) | Gap list G1–G8 | Cập nhật trạng thái gap khi đóng |
| O06 + anonymize BE | PR #297–#299 · deploy tip `0a65f3c2f2d51357ee1a6270151d279758188fb7` | Policy + migrate prod | Copy App Review notes D10 còn câu “retention chưa finalize” → **stale** cần refresh |
| Privacy URL live | Deploy evidence [D12-DEPLOY-PROD-2026-10-18.md](../reviews/D12-DEPLOY-PROD-2026-10-18.md); quan sát planner `curl -sI https://vemoki.com/privacy` → **HTTP 200** | Đóng gap D10 G1 (URL 404) | Chỉ khi URL lại ≠ 200 hoặc copy lệch O06 |
| D12 GO/NO-GO | [D12-RELEASE-GO-NO-GO.md](../reviews/D12-RELEASE-GO-NO-GO.md) · deploy SHA **`0a65f3c2f2d51357ee1a6270151d279758188fb7`** | Fact: SMTP vẫn Mailpit; APNs device DELIVERED / on-call từng ghi gap — **tái xác minh** trước store, **không suy từ D10** | Không dùng để claim store/pilot ready |
| Toolchain local (coordinator read-only) | `xcodebuild -version` → **Xcode 26.5 (17F42)**; `xcrun --sdk iphoneos --show-sdk-version` → **26.5** | Inventory máy build | **Chưa** kết luận ASC upload eligibility — cần **S1-T3** đối chiếu requirement live |

**Quy tắc stale:** evidence D10/D12 **không** tự đủ cho binary/version mới. Mọi Task store phải ghi **tip SHA archive** và revalidate gap checklist; reuse = trích dẫn SHA cũ + xác nhận còn đúng, không copy verdict PASS cũ sang tip mới.

### 1.3 Gap D10 còn mở tại lúc D10 đóng (fact) — trạng thái D13

| ID | Gap D10 | Trạng thái quan sát 2026-10-18 | Task D13 |
| -- | ------- | ------------------------------ | -------- |
| G1 | `vemoki.com/privacy` 404 | **Đóng phần URL** (200 sau D12 deploy) — vẫn cần khớp Privacy Nutrition + in-app | S2-T1, S3-T* |
| G2 | ASC UI chưa điền / chưa screenshot | **Còn mở** | S3-T1 |
| G3 | Screenshots chưa upload ASC | **Đóng phần en-US** (2026-10-18: 10 COMPLETE; xem `D13-S3-T2-SCREENSHOTS.md`) — chưa submit | S3-T2 |
| G4 | iPad media chất lượng | **Retake + upload COMPLETE** (2026-10-18) | S3-T2 |
| G5 | TestFlight chưa upload IPA | **Còn mở** (prep ≠ upload) | S4-T2 |
| G6 | Archive Development, chưa Distribution IPA | **Còn mở** | S4-T1 |
| G7 | Demo credential chỉ paste ASC | **Ops** — không vào git | S5-T2 |
| G8 | Production submit | **Còn mở** — mục tiêu D13 | S6 / S7 |

---

## 2. Blockers / agreements / credentials (không bịa)

| Hạng mục | Trạng thái | Ai đóng | Chặn Task |
| -------- | ---------- | ------- | --------- |
| Apple Developer Program membership (personal `BLUA62D52G`) | Fact: đang dùng cho archive D10 | User / account owner | Mọi Task iOS ký |
| Paid Applications / Free Apps Agreement, banking, tax trên ASC | **Unknown** — chưa có evidence trong repo | User trên ASC | S6 submit / S7 release nếu Apple chặn |
| App Store Connect API Key + Issuer trên máy build | Fact lịch sử: Key file từng có; Issuer **unset** trong #162; máy/ops có thể đã đổi — **re-verify, không giả định** | Operator local | S4-T2 upload CLI |
| App Store distribution provisioning `BLUA62D52G` + `com.hangndat.ticket` | Fact #162: thiếu trên máy lúc prep | Operator / Xcode Automatic | S4-T1 export IPA |
| Demo reviewer accounts trên **prod** IdP | Docs fixture trong `app-review-notes.md` — **chưa** claim đã provision prod | Coordinator + BA | S5-T2 |
| SMTP internet (Porkbun/Postfix) | Fact D12 GO/NO-GO: còn Mailpit; thiếu secret operator | User/ops | Không chặn cứng ASC upload; **có thể** fail App Review nếu email/redeem phụ thuộc SMTP |
| Export compliance / encryption answers | Docs prep (`ITSAppUsesNonExemptEncryption` pattern) — điền lại trên bản ASC version | iOS/coordinator | S3 / S6 |
| Legal privacy policy “đã duyệt luật sư” | **Unknown** — chỉ có draft + page live O06 | User | Không bịa; nếu cần counsel thì escalate |
| Mục tiêu publish + duyệt roadmap | User đã nêu publish; sau duyệt roadmap **không** xin lại quyền submit mang tính nghi thức | Coordinator theo roadmap | S4+ / S6 / S7 khi credential + territory + runtime gates đủ |
| Territory VN vs All | **Chưa chốt** — BA khuyến nghị **VN only** ([memo](../reviews/D13-TERRITORY-GATE-DECISION.md)); leo thang thêm quốc gia sau E0 | User (E0) → ops ASC | S3 §Pricing & Availability · S7-T1 · S7-T3 evidence |

**Cấm:** Expo/EAS Cloud Build; upload source/signing lên EAS; tạo cloud SaaS runtime; in hoặc commit secret. Credential chỉ được sử dụng qua cơ chế local được ủy quyền, không đưa vào log/evidence.

### 2.1 Territory gate (VN vs All) — BA 2026-10-19

Artifact đầy đủ: [D13-TERRITORY-GATE-DECISION.md](../reviews/D13-TERRITORY-GATE-DECISION.md).

| Lựa chọn | S3 (Pricing & Availability) | S7 (release + evidence) |
| --- | --- | --- |
| **A — VN only (đề xuất)** | Free; Availability **Vietnam** | Manual release; S7-T3 ghi rõ **Vietnam** + screenshot Availability |
| **B — All storefront** | Free; Availability **All** (hoặc danh sách rộng) | S7-T3 ghi All/danh sách; ops/support ngầm toàn cầu — **không** khuyến nghị lần đầu |

**Leo thang (sau publish VN):** user + BA memo ngắn → coordinator thêm quốc gia trên ASC (thường không cần binary mới) → cập nhật `D13-PUBLISH-EVIDENCE.md`. **Cấm** worker tự đổi ASC Availability; **cấm** S3 chọn All khi S7 vẫn “chờ user”.

---

## 3. Hai pha ủy quyền

```text
Pha A — Roadmap review (AUTHORIZED — artifact này)
  Plan D13 (planner) → user review / chỉnh
        ↓
Pha B — Thực thi store (SAU khi user duyệt roadmap; mục tiêu publish đã bao gồm upload/submit/release trong scope)
  Wave fan-out theo §6 → DoD exact-SHA → publish evidence §0
```

| Cổng | Điều kiện | Không suy ra |
| ---- | --------- | ------------ |
| Research/plan complete | File này + user review | Được upload/submit |
| Binary ready | Local Distribution archive + tip SHA | Publish |
| In Review | ASC state | Publish |
| **Published** | §0 URL + version + territory + DoD | Pilot SLO / SMTP |

---

## 4. Epic → Story → Task

**Bundle / product:** `com.hangndat.ticket` · **Vemoki** · Team **`BLUA62D52G`** only.  
**AI** = Architecture impact (Có | Không).

### Epic D13 — Phát hành công khai App Store

**Outcome:** §0. **Parent board:** Issue mới (draft §7) — chưa tạo trên GitHub trong task planner này.

---

### Story S1 — Làm mới eligibility & roadmap store (docs)

Mục tiêu: đối chiếu Apple guidelines / ASC hiện hành với O06 + binary/runtime; đóng gói review cho user trước coding.

| Task | Ownership | Role ID | Path role | AI | Acceptance (rút gọn) |
| ---- | --------- | ------- | --------- | -- | -------------------- |
| **S1-T1** BA: Privacy / account deletion / data collection vs guidelines mới nhất | `docs/**` | `product-ba` | `docs/agents/roles/product-ba.md` | Không | Diff `docs/asc/privacy-*` + page live vs Guideline 5.1.1 / Account Deletion; liệt kê lệch O06 anonymize; artifact `docs/reviews/D13-S1-T1-PRIVACY-ELIGIBILITY.md` + exact source SHA; **không** bịa counsel |
| **S1-T2** BA: SDK / Privacy Nutrition / third-party SDK declarations | `docs/**` | `product-ba` | `docs/agents/roles/product-ba.md` | Không* | Inventory SDK trong app (Expo/RN modules) khớp Nutrition Labels; flag nếu cần cập nhật labels; artifact + SHA. *Nếu phát sinh thay đổi contract telemetry → escalate `architect` |
| **S1-T3** Xác minh **live** yêu cầu Xcode/iOS SDK khi upload ASC | `docs/reviews` | `product-ba` (+ ios xác nhận toolchain) | `docs/agents/roles/product-ba.md` | Không | Đối chiếu [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) (thông báo Xcode 26 / iOS 26 SDK từ **2026-04-28**) với trang submitting hiện hành (có thể ghi SDK khác — **không chốt số thiếu screenshot/export ngày chạy Task**); ghi Xcode/SDK máy `26.5` / `17F42` chỉ là inventory; artifact `docs/reviews/D13-S1-T3-SDK-ELIGIBILITY.md` + ngày đối chiếu |
| **S1-T4** Planner reconcile sau user review (+ territory chốt) | `docs/plans` | *(planner — không catalog)* | — | Không | Cập nhật wave/deps / territory; **không** tự mở coding |

\*Trigger architect riêng: **S1-T2b** (optional) Role `architect` / `docs/agents/roles/architect.md` — AI **Có** nếu S1-T2 phát hiện cần đổi privacy SDK reporting hoặc network security khác ADR hiện hành.

**Nguồn Apple bắt buộc đọc trong S1 (không thay evidence ngày chạy Task):**

- Account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Version release option: https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/
- Upcoming SDK/Xcode requirements: https://developer.apple.com/news/upcoming-requirements/?id=04282026a

**Deps:** không. **Song song:** S1-T1 ∥ S1-T2 ∥ S1-T3.

---

### Story S2 — Runtime production sẵn cho bản store

Mục tiêu: chứng minh binary sẽ nói chuyện với prod thật; không dùng staging giả.

| Task | Ownership | Role ID | Path role | AI | Acceptance |
| ---- | --------- | ------- | --------- | -- | ---------- |
| **S2-T1** Coordinator: tái xác minh runtime prod (API/OIDC/privacy/APNs/SMTP/on-call) | root / `docs/reviews` | *(coordinator — không catalog)* | — | Không | Baseline deploy SHA `0a65f3c2f2d51357ee1a6270151d279758188fb7` từ D12-GO-NO-GO — **đo lại**, không suy từ D10; SMTP Mailpit vs internet; APNs DELIVERED device; on-call; `/privacy` 200 — **không** claim pilot ready |
| **S2-T2** BE verify: account anonymize path sẵn trên prod tip | `apps/api` + packages backend (verify/tests; coding chỉ nếu lệch) | `backend` | `docs/agents/roles/backend.md` | Không† | Đối chiếu migrate O06 + `POST /v1/me/account-deletion-requests` / job anonymize trên tip; test hoặc smoke có SHA; security review nếu đụng authz |
| **S2-T3** Web: privacy page + deep links support URL khớp ASC | `apps/web` | `web` | `docs/agents/roles/web.md` | Không | Headless UAT `scripts/web-uat.sh` (hoặc HTTP) trên tip; Support/Marketing URL sống |

†Nếu S2-T2 cần đổi contract erasure → **S2-T2a** `architect` (AI Có) trước consumer.

**Deps:** S2-T1 có thể song song S1. S2-T2/T3 sau user duyệt Pha B (hoặc song song nếu chỉ verify không đổi code).  
**Hard dep publish:** mọi luồng email bắt buộc cho đăng nhập/nhận vé/reviewer phải gửi và nhận được email thật. Mailpit không đủ cho luồng đó; S6 bị chặn nếu chưa có evidence hoặc scope thay thế được user duyệt.

---

### Story S3 — Điền ASC metadata + media (reuse D10)

| Task | Ownership | Role ID | Path role | AI | Acceptance |
| ---- | --------- | ------- | --------- | -- | ---------- |
| **S3-T1** Điền ASC fields + screenshot console (che secret) | ops ASC + `docs/reviews` | `ios`‡ | `docs/agents/roles/ios.md` | Không | Checklist `asc-fields-checklist.md` chuyển ☑ có evidence ảnh; Privacy URL = live; Age rating wizard lưu kết quả |
| **S3-T2** Upload screenshots (và retake nếu cần) | `apps/mobile` artifacts + ASC | `ios` | `docs/agents/roles/ios.md` | Không | Slot iPhone bắt buộc + iPad theo checklist; không EAS; ghi build UI tip |
| **S3-T3** Refresh App Review notes + demo access sau O06 | `docs/asc` (+ paste ASC) | `product-ba` | `docs/agents/roles/product-ba.md` | Không | Xóa ngôn ngữ “retention chưa finalize”; khớp anonymize ≤30d; Sign-in required fields |

‡Coordinator có thể thực hiện paste ASC nếu Task ghi ownership coordinator; Role `ios` khi đụng binary/media sizes.

**Deps:** S1-T1 (privacy copy) trước S3-T3; G1 URL live (đã có) trước S3-T1. S3-T1 ∥ S3-T2 sau S1 privacy OK.

---

### Story S4 — Local signed Distribution archive + upload

| Task | Ownership | Role ID | Path role | AI | Acceptance |
| ---- | --------- | ------- | --------- | -- | ---------- |
| **S4-T1** Archive + export IPA `app-store-connect`, Team `BLUA62D52G` | `apps/mobile` | `ios` | `docs/agents/roles/ios.md` | Không | `expo prebuild` local + `xcodebuild archive` + export IPA; version/build ghi evidence; **cấm** EAS Cloud; không dùng team công ty |
| **S4-T2** Upload IPA → ASC (TestFlight processing) | `apps/mobile` + ASC | `ios` | `docs/agents/roles/ios.md` | Không | Build processing xanh; ghi build number; Internal TF optional; **≠ publish** |
| **S4-T3** Physical-device smoke trên build đã upload (attendee + staff camera) | device + `docs/reviews` | `ios` | `docs/agents/roles/ios.md` | Không | Device thật (không chỉ Simulator); headless sim bổ sung OK nhưng **không** thay camera/push device khi AC yêu cầu |

**Deps:** S1-T3 (SDK eligibility), S2-T1 (prod endpoints), S5-T1 và mọi sửa mobile đã merge + DoD/CI trước S4-T1; không archive trước thay đổi hành vi cuối. S4-T2 sau S4-T1. S4-T3 sau S4-T2 processing.  
**Credential blockers:** §2 provisioning / ASC API.

---

### Story S5 — Privacy in-app, account deletion, reviewer access

| Task | Ownership | Role ID | Path role | AI | Acceptance |
| ---- | --------- | ------- | --------- | -- | ---------- |
| **S5-T1** iOS: lối Account deletion + link Privacy trong app | `apps/mobile` | `ios` | `docs/agents/roles/ios.md` | Không | Guideline account deletion: vào được từ app, không chỉ web; evidence screenshot/device; tip SHA |
| **S5-T2** Provision / verify demo reviewer trên prod | ops IdP + docs | coordinator (+ `product-ba` copy) | — / `product-ba.md` | Không | Hai tài khoản attendee/staff hoạt động trên prod; paste ASC; **không** commit mật khẩu |
| **S5-T3** Headless UAT web companion paths nêu trong Review notes | `apps/web` | `web` | `docs/agents/roles/web.md` | Không | `scripts/web-uat.sh` artifact path + SHA |
| **S5-T4** DoD + security (authz deletion / demo roles) | review only | `reviewer-dod` + `reviewer-security` | `docs/agents/roles/reviewer-dod.md`, `reviewer-security.md` | Không | Exact SHA; session ≠ implementer; artifact `docs/reviews/D13-S5-*-DOD.md` |

**Deps:** S2-T2 (BE deletion) trước hoặc ∥ S5-T1; S5-T2 trước S6. S5-T4 sau PR S5.

---

### Story S6 — Submit for Review + vòng từ chối

| Task | Ownership | Role ID | Path role | AI | Acceptance |
| ---- | --------- | ------- | --------- | -- | ---------- |
| **S6-T1** Submit version cho App Review (ủy quyền rõ) | ASC + evidence | `ios` / coordinator | `docs/agents/roles/ios.md` | Không | State In Review; ghi timestamp + build; **≠ publish** |
| **S6-T2** Triage Rejection / Message Center | docs + fix ownership đúng slice | `product-ba` triage → BE/web/ios fix | theo slice | Có nếu Apple bắt đổi kiến trúc | Mỗi vòng: findings → Task fix → revalidate SHA → resubmit; không spin vô hạn không escalate |
| **S6-T3** DoD từng vòng resubmit | review | `reviewer-dod` (± security) | `reviewer-dod.md` | Không | Exact SHA binary/source từng vòng |

**Deps:** S3 + S4-T3 (device smoke PASS) + S5-T2 + S5-T4 (review PASS). Roadmap đã duyệt + go/no-go đạt trước S6-T1; không xin lại quyền submit.

---

### Story S7 — Release control + evidence publish công khai

| Task | Ownership | Role ID | Path role | AI | Acceptance |
| ---- | --------- | ------- | --------- | -- | ---------- |
| **S7-T1** Chọn mô hình release (Automatic vs Manual) + territory | ASC | coordinator | — | Không | Theo [ASC release option](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/); territory **chỉ sau user E0** ([territory memo](../reviews/D13-TERRITORY-GATE-DECISION.md) — đề xuất **VN only**); screenshot Availability khớp S3 |
| **S7-T2** Bấm release / confirm Ready for Sale khi Approved | ASC | coordinator | — | Không | State bán công khai; **đây mới là publish path** |
| **S7-T3** Thu evidence URL + version + territory | `docs/reviews` | `product-ba` hoặc coordinator | `product-ba.md` | Không | Artifact `docs/reviews/D13-PUBLISH-EVIDENCE.md` đủ §0 |
| **S7-T4** Milestone DoD Epic | review | `reviewer-dod` | `reviewer-dod.md` | Không | PASS trên tip; headless UAT + local archive evidence + publish evidence; **không** yêu cầu deploy prod mới trừ khi binary phụ thuộc tip chưa deploy |

**Deps:** S6 Approved → S7-T2. S7-T1 có thể chốt sớm (sau S3). S7-T3 sau S7-T2.

---

### Story S8 — Đóng Epic / đồng bộ board (coordinator)

| Task | Ownership | Role ID | AI | Acceptance |
| ---- | --------- | ------- | -- | ---------- |
| **S8-T1** Đóng Issue con + Epic khi §0 + DoD đủ | Project #3 | coordinator | Không | Status **Hoàn thành**; comment VI + link evidence; không đóng chỉ vì `worker_done` |
| **S8-T2** Quyết định đóng hoặc giữ D12 #293 | Project #3 | coordinator | Không | Tách store publish khỏi pilot SMTP nếu user chấp nhận; **không** tự claim pilot ready |

---

## 5. DoD chung mỗi Task coding / ops có PR

1. Review độc lập exact SHA (`reviewer-dod`; thêm `reviewer-security` nếu authz/RLS/deletion/secrets).  
2. Merge `main` + CI xanh khi Task yêu cầu tích hợp.  
3. Evidence commands/logs/screenshots path; không chỉ `worker_done`.  
4. Headless UAT khi chạm web/iOS UI; physical-device khi AC camera/push/store binary.  
5. Local signed build only — **cấm** EAS Cloud.  
6. Architecture impact Có → đối chiếu handoff/ADR; drift → Task `architect` kiểm tra SHA.

Milestone Epic thêm: (a) headless UAT evidence, (b) local iOS archive tip submit, (c) deploy prod chỉ nếu ủy quyền/cần runtime, (d) `docs/reviews/*` + publish §0.

---

## 6. Dependencies thật & wave bề rộng tối đa

```text
Pha A (đã chạy planner):
  [plan file này] → USER REVIEW ROADMAP

Pha B — Wave 1 (max fan-out, sau duyệt roadmap; chưa cần IPA):
  S1-T1 ∥ S1-T2 ∥ S1-T3 ∥ S2-T1 ∥ S2-T2(verify) ∥ S2-T3(verify)
  (+ S1-T2b architect chỉ nếu S1-T2 mở quyết định)
  Territory user chốt có thể song song (blocker mềm cho S7-T1, không chặn Wave 1)

Wave 2 (ASC prep + binary — song song theo ownership; một feature Dispatch / slice):
  S3-T3 (sau S1-T1) ∥ S3-T1 ∥ S3-T2
  S4-T1 (sau S1-T3, S2-T1 và S5-T1/fix mobile đã merge + review/CI) → S4-T2 → S4-T3
  S5-T1 (sau/∥ S2-T2) ∥ S5-T2 ∥ S5-T3
  rồi S5-T4 reviewers (có thể nhiều PR ∥)

Wave 3 (submit — sau roadmap và go/no-go):
  S6-T1 → (optional loop S6-T2 + fixes + S6-T3)

Wave 4 (publish):
  S7-T1 (nếu chưa) → S7-T2 → S7-T3 → S7-T4 → S8-T1 ∥ S8-T2
```

**Không serialize giả:** không chờ cả Story S1 đóng mới mở S2 verify; SMTP chỉ không chặn công việc độc lập; không được miễn luồng email bắt buộc khi publish.  
**WIP:** nếu ≥3 `Chờ duyệt` — ưu tiên reviewer/fix trước feature store mới.

**Loại khỏi wave khi:** thiếu agreement/credential §2; cùng slice iOS đang có Dispatch archive; roadmap chưa được duyệt hoặc go/no-go chưa đạt.

---

## 7. Draft bodies — Epic / Story / Task (để coordinator đồng bộ board)

> Planner **không** tạo Issue/sửa board. Coordinator copy/chỉnh sau user duyệt roadmap.

### 7.1 Epic (draft)

```markdown
## Tiêu đề
[D13] Phát hành công khai App Store — Vemoki

## Thân
**Mục tiêu:** Đưa app iOS `com.hangndat.ticket` (Vemoki) lên App Store **công khai**, với evidence: App Store URL + version + territory (xem `docs/plans/D13-APP-STORE-RELEASE-PLAN.md` §0).

**Không đủ:** upload IPA, TestFlight, In Review, Approved nhưng chưa release.

**Tái sử dụng:** D10 #150 (metadata/archive prep) và D12 #294–#296 / deploy `0a65f3c…` theo SHA — không làm lại từ đầu; revalidate gap.

**Ràng buộc:** local Xcode/fastlane only; cấm EAS Cloud; Team `BLUA62D52G`; không tạo cloud resource; submit/release chỉ khi Task ủy quyền.

**Architecture impact:** Không ở cấp Epic plan; đánh giá từng Task.

**DoD Epic:** §0 + milestone gates (headless UAT, local archive tip, review exact-SHA, publish evidence).
```

### 7.2 Stories (draft titles)

1. `[D13-S1] Làm mới eligibility privacy/SDK/Xcode-ASC & roadmap store`  
2. `[D13-S2] Runtime production sẵn cho bản store`  
3. `[D13-S3] Điền ASC metadata + upload media (reuse D10)`  
4. `[D13-S4] Local Distribution archive, upload ASC/TestFlight`  
5. `[D13-S5] Account deletion, privacy in-app, reviewer access`  
6. `[D13-S6] Submit for Review + vòng từ chối`  
7. `[D13-S7] Release control + evidence publish công khai`  
8. `[D13-S8] Đóng Epic / đồng bộ board & quan hệ D12`

### 7.3 Task body template (mỗi Task)

```markdown
## Vai trò chuyên môn (bổ sung)
- Role ID: <product-ba|architect|backend|web|ios|reviewer-dod|reviewer-security>
- File: docs/agents/roles/<id>.md
- Agent: cursor (orca-agent-routing-coordinator.mdc)
- Architecture impact: Có | Không — <lý do>
- Parent: Epic D13 / Story Dx-Sy
- Reuse SHA: <danh sách SHA D10/D12 được phép trích dẫn>
- Cấm: EAS Cloud; commit secrets; coi TestFlight = publish

## Acceptance
- [ ] Evidence đúng tip SHA (archive/submit)
- [ ] DoD độc lập exact-SHA khi Chờ duyệt
- [ ] Headless UAT / physical-device theo AC Task
- [ ] Cập nhật gap checklist D13 (không bịa ASC state)
```

Chi tiết AC từng Task: bảng §4. Coordinator gắn Status `Sẵn sàng` chỉ sau user duyệt roadmap + đủ credential cho Task đó.

---

## 8. Liên kết evidence chính

| Chủ đề | Path |
| ------ | ---- |
| Plan này | `docs/plans/D13-APP-STORE-RELEASE-PLAN.md` |
| Territory gate (VN vs All) | `docs/reviews/D13-TERRITORY-GATE-DECISION.md` |
| ASC docs | `docs/asc/*` |
| D10 checklist gaps | `docs/reviews/D10-S5-T1-ASC-CHECKLIST.md` |
| D10 archive | `docs/reviews/D10-S4-T1-ARCHIVE.md`, `D10-S5-T2-IOS-ARCHIVE.md` |
| D10 TF prep | `docs/reviews/D10-S4-T2-TESTFLIGHT-PREP.md` |
| D12 deploy / GO-NO-GO | `docs/reviews/D12-DEPLOY-PROD-2026-10-18.md`, `D12-RELEASE-GO-NO-GO.md` |
| O06 | `docs/DECISION-LOG.md`, `docs/ops/O06-OPTIONS.md` |
| Roles | `docs/agents/README.md` |

---

## 9. Limitations (planner)

- Không đọc secret; không xác minh Paid Apps Agreement / banking ASC (Unknown §2).  
- Không sửa board; Issue numbers D13 chưa tồn tại — draft only.  
- Không chạy archive/upload/submit trong task này.  
- `docs/ops/RUNBOOK.md` đang dirty trên worktree — **không đụng**.  
- CRG MCP không dùng (docs-only theo brief).  
- ROADMAP.md snapshot có thể lệch board — chỉ tin Project #3 cho Status.  
- Account deletion copy trong `app-review-notes.md` (D10) **stale tương đối** sau O06 — phải refresh ở S3-T3/S1-T1 trước submit.

---

## 10. Khuyến nghị coordinator (sau user duyệt roadmap)

1. Tạo Epic/Story/Task trên Project #3 từ §7; Status ban đầu `Sẵn sàng` cho Wave 1 docs/verify.  
2. Sau duyệt roadmap: **không** xin lại quyền submit mang tính nghi thức — chỉ chặn khi thiếu dữ kiện §2 / territory / S2 go-no-go / Apple processing.  
3. Trước Wave 2 iOS: operator đóng credential gaps §2 (Issuer, distribution profile).  
4. Chốt territory với user **E0** (đề xuất VN — [memo](../reviews/D13-TERRITORY-GATE-DECISION.md)); sau đó S3 Availability ∥ S7-T1. Giữ D12 #293 tách; các luồng email bắt buộc phải có delivery thật trước submit.  
5. Spawn max fan-out theo §6; reviewer ≠ implementer; mọi claim publish chỉ sau S7-T3.  
6. Parent Epic D13 trên GitHub: `Chưa lên lịch` / chờ review roadmap — chưa coding dispatch.
