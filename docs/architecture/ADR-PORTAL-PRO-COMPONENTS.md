# ADR — Portal: Ant Design Pro Components trên Next.js App Router

| Trường | Giá trị |
| --- | --- |
| Artifact | `docs/architecture/ADR-PORTAL-PRO-COMPONENTS.md` |
| Ngày | **2026-10-20** |
| Trạng thái | **Đã chấp nhận** — coordinator chốt; ADR ghi lại, không đảo quyết định |
| Role | `architect` · [`docs/agents/roles/architect.md`](../agents/roles/architect.md) · Mode **Thiết kế** |
| Task | `task_f6419afe1664` |
| Base SHA đã đối chiếu | `550bab1739a49e4afc90c0db554bad7b1740249a` (`hangndat/d1-portal-pro`) |
| Tiền đề | **O16** (`ANTD-CORE-FIRST`, portal riêng) · **ADR-20** · [`PORTAL-ANTD-UX.md`](../design/PORTAL-ANTD-UX.md) · shell hiện tại `apps/portal/src/components/portal-shell.tsx` |

Architecture impact: **Có** — dependency UI, layout shell, pattern màn vận hành; **không** đổi OIDC/BFF trust boundary.

---

## 1. Bối cảnh

Portal staff (`apps/portal`, `portal.vemoki.com`) chạy **Next.js 16** App Router với **antd 6.6.6** và **`@ant-design/nextjs-registry`** (SSR/style isolation). O16 chọn Ant Design thuần làm kit mặc định và **không** scaffold Umi / Ant Design Pro template; ProComponents lúc đó **không** mặc định.

Sau P0/P1 và nhánh nav nhóm (sider tự viết trong `portal-shell`), màn vận hành (danh sách, form cấu hình, KPI tóm tắt) cần pattern lặp lại: layout trang, bảng có filter/pagination, form dày field, statistic cards. Tự xây trên antd thuần khả thi nhưng chi phí UX/consistency cao so với gói Pro* đã chuẩn hóa cho admin.

Ranh giới auth hiện hữu: **OIDC Auth Code + BFF cookie** trên App Router (`apps/portal` route handlers / session), host-only cookie, không Umi `request` interceptors. Mọi thay đổi UI phải **không** kéo scaffold đổi entry auth hoặc chạm `apps/web` (Gate `app.vemoki.com`), `apps/api`, hay Gate mobile.

---

## 2. Phương án đã xem xét

| Phương án | Lợi | Hại | Kết luận |
| --- | --- | --- | --- |
| **A — Giữ antd thuần + shell custom** | Khớp O16 nguyên văn; ít dependency | ProTable/ProForm/PageContainer phải tự lặp; sider/menu drift với Pro ecosystem | **Không chọn** cho wave Pro |
| **B — `@ant-design/pro-components` 2.8.x** | Bản ổn định quen thuộc trên npm | Peer **antd 4/5** — **lệch** antd 6 đã pin | **Cấm** |
| **C — Umi / Ant Design Pro scaffold** | ProLayout + routing + data flow có sẵn | Thay App Router + BFF OIDC; conflict O16 và ADR-20 portal topology | **Cấm** |
| **D — Pro Components 3.1.x trên stack hiện tại** | Peer **antd ^6**; dùng lẻ ProLayout/ProTable/… trong App Router | Gói **pre-release**; cần pin exact và theo dõi breaking | **Chọn** |

---

## 3. Quyết định (đã chốt)

| Mã | Quyết định |
| --- | --- |
| `PORTAL-STACK-UNCHANGED` | Giữ **Next.js 16** + **antd 6.6.6** + **`@ant-design/nextjs-registry`** — không nâng/hạ framework chỉ vì Pro |
| `PORTAL-PRO-DEPS` | Thêm **`@ant-design/pro-components@3.1.15-7`** (peer antd `^6`). **Pin exact** trong `apps/portal/package.json`; cập nhật `pnpm-lock.yaml` chỉ trong Task được phép cài dependency này. **Cấm** `2.8.x`. **Cấm** `latest` / range thả nổi |
| `PORTAL-PRO-NO-UMI` | **Không** migrate sang Umi hoặc Ant Design Pro scaffold — OIDC BFF + App Router là ranh giới auth/session |
| `PORTAL-PRO-LAYOUT` | **ProLayout** thay sider/menu shell tự viết trong portal shell (giữ logic capability/RBAC và product links ở layer portal, không đẩy auth vào Pro config global) |
| `PORTAL-PRO-SCREENS` | Màn vận hành ưu tiên **PageContainer**, **ProTable**, **ProForm**, **StatisticCard** (và Pro* liên quan trong cùng gói khi cần) — không bắt buộc dùng toàn bộ catalog Pro |
| `PORTAL-OWNERSHIP` | Chỉ **`apps/portal`** (+ lockfile khi cài dep). **Không** `apps/web`, `apps/api`, Gate, iOS, shared contracts trừ khi coordinator mở Task riêng |

---

## 4. Hệ quả

### 4.1 Kỹ thuật

- **Registry & RSC:** Tiếp tục bọc `AntdRegistry` ở root layout; Pro components render trong client boundaries theo pattern Next + antd 6 (không giả định Umi `plugin-model`).
- **Theme:** `ConfigProvider` / Design Token Vemoki áp cho cả antd và Pro* (Pro kế thừa token antd 6).
- **Shell:** Migration từ `portal-shell` custom sider → ProLayout: map menu từ `nav/capabilities` hiện có; giữ deep link, locale VI mặc định (O04), EN additive khi P2.
- **Data:** ProTable/ProForm gọi API/BFF hiện có — không thêm client-side permission array; authz vẫn server deny-by-default.
- **Bundle:** Thêm một dependency lớn; tree-shake import named từ `@ant-design/pro-components`; tránh import cả preset Umi.

### 4.2 Vận hành & rủi ro

| Rủi ro | Giảm thiểu |
| --- | --- |
| `3.1.x` pre-release | Pin **exact** `3.1.15-7`; nâng version chỉ qua PR + changelog Pro; coordinator duyệt |
| API Pro đổi giữa pre-release | Test `typecheck` + lint portal; smoke UAT shell/menu sau migrate |
| Lệch doc O16 «ProComponents không mặc định» | O16 = không scaffold Pro **template**; ADR này **bổ sung** gói component lẻ — không đảo Gate/platform |

### 4.3 Handoff coding

| Hạng mục | Owner | Ghi chú |
| --- | --- | --- |
| `pnpm add @ant-design/pro-components@3.1.15-7` trong `apps/portal` | Web portal worker | Lockfile trong cùng PR |
| ProLayout + menu/RBAC | Web portal | Parity với nav nhóm đã UAT |
| Màn ops (table/form/stats) | Web portal + PD states | Theo `PORTAL-ANTD-UX` / BA AC |
| CI `apps/portal` build/typecheck | Coordinator nếu pipeline gap | Không đổi root tooling trong Task ADR |

### 4.4 Xác minh (evidence mong đợi)

- `pnpm --filter @ticket/portal build` và `typecheck` xanh trên SHA PR.
- Local/prod smoke: đăng nhập OIDC → ProLayout menu theo role; không regress spinner/login (tham chiếu UAT nav 2026-10-19).
- Không import Pro từ `apps/web` / shared package chưa được phép.

---

## 5. Việc không làm (non-goals)

| OUT | Lý do |
| --- | --- |
| Umi, `@umijs/max`, Ant Design Pro repo template | Phá App Router + BFF OIDC |
| `@ant-design/pro-components` **2.8.x** | Peer antd 4/5 |
| Migrate Gate / marketing / attendee sang Pro | O16 `GATE-STAY-APP` |
| Thêm SaaS auth hoặc đổi Keycloak flow | ADR-09 / ADR-11 |
| Dùng `latest` hoặc caret mở cho Pro pre-release | Rủi ro CI/production drift |
| Sửa `apps/api` contracts chỉ để khớp Pro column magic | Contract do BE Task riêng |

---

## 6. Kết luận

**Đủ để triển khai trong scope `apps/portal`.** Coordinator đã chốt stack và phiên bản Pro; worker implementation follow §4.3–4.4. Thay đổi peer antd major hoặc chuyển sang Umi yêu cầu ADR mới + user/coordinator — không suy diễn từ Task cài Pro Components.
