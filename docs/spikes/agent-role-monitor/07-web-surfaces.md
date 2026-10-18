# 07 — Bề mặt web / hiển thị (Agent Role Effectiveness Monitor)

**Role:** `web` · `docs/agents/roles/web.md`  
**Architecture impact:** Có — quyết định có/không đưa monitor vào `apps/web` (chỉ spike; không implement UI).  
**Phạm vi file:** chỉ tài liệu này. Không sửa `apps/web`, không đụng `01`–`06`.

## 1. Mục tiêu đánh giá

So sánh ba bề mặt hiển thị kết quả monitor (cost/token, chất lượng output, RAM/CPU theo Role catalog) và chọn **MVP**:

| Option | Mô tả |
| ------ | ----- |
| **(A)** | Trang nội bộ trong `apps/web` (portal Vemoki) |
| **(B)** | Static report — markdown trong repo và/hoặc CI artifact |
| **(C)** | CLI-only (Orca / script local; không UI web) |

Tiêu chí: auth, deploy, fit sản phẩm Vemoki, effort, privacy/attribution.

## 2. Neo hiện trạng `apps/web` (đọc nhẹ — không code)

Cấu trúc Next.js App Router (quan sát qua tree + graph readiness; không sửa file):

| Surface | Path | Auth / audience |
| ------- | ---- | --------------- |
| Tenant admin | `/admin` | Session OIDC BFF + `requireAdminCapabilityOrHome` |
| Platform console | `/platform` | Platform OIDC riêng (`PLATFORM_OIDC_*`, ACR MFA) |
| Gate / claim / redeem / marketing | `/gate`, `/claim`, `/redeem`, `/marketing` | Attendee / public / tenant flows |
| BFF | `app/api/auth/*`, `app/api/bff/*` | Cookie session → Nest upstream |

Điểm quan trọng cho spike:

- Portal đã có **report sự kiện** (`src/admin/report.ts`) — đây là báo cáo ticket/quota/CS, **không** phải agent observability.
- Nav capabilities (`src/nav/capabilities.ts`) gắn membership/platform permissions sản phẩm — chưa có capability “agent ops”.
- Auth production path: Keycloak OIDC + BFF; rule web: không thêm Clerk/Auth0/mock trên production path.
- Consumer tự nhiên của Role monitor là **coordinator / reviewer / operator nội bộ**, không phải tenant organizer hay attendee.

## 3. Ma trận tradeoff

### (A) Trang nội bộ trong `apps/web`

| Chiều | Đánh giá |
| ----- | -------- |
| **Auth** | Phải gắn `/platform` (operator) hoặc tạo route + capability mới. Tenant `/admin` **sai audience** (lộ telemetry agent cho staff sự kiện). Platform OIDC + MFA đủ chặt nhưng cần policy “ai được xem token/cost”. |
| **Deploy** | Đi cùng release portal; cần BFF proxy + (có thể) API Nest cho telemetry — phụ thuộc data plane `06`. Deploy prod cần ủy quyền riêng. |
| **Fit Vemoki** | **Thấp cho MVP.** Portal = sản phẩm vé/event; monitor Role = tooling vận hành agent. Trộn hai narrative làm phình nav, a11y/UAT surface, và rủi ro privacy (prompt/token metadata). |
| **Effort** | Cao: route + guard + empty/loading/denied states + UAT headless + có thể OpenAPI. Không làm được đúng khi chưa có contract telemetry. |
| **Ưu** | UX realtime, một chỗ với platform console nếu sau này có “ops suite”. |
| **Nhược** | Coupling sản phẩm–tooling; WIP/review slice web; architecture impact lớn. |

### (B) Static report (markdown / CI artifact)

| Chiều | Đánh giá |
| ----- | -------- |
| **Auth** | Không cần OIDC portal. Bảo vệ bằng quyền git/CI/artifact store (private repo, GitHub Actions artifacts). Không expose tenant. |
| **Deploy** | Không deploy portal. Artifact gắn commit/Run/SHA — khớp evidence DoD (`docs/reviews/*`, comment Project #3). |
| **Fit Vemoki** | **Tốt cho MVP nội bộ.** Khớp “đo nhẹ process” trên board; không đụng UX tenant. |
| **Effort** | Thấp–trung bình: script generate markdown từ `worker-list` / log / (sau này) OTel export; CI job optional. |
| **Ưu** | Durable, reviewable, diff được; phù hợp spike → synthesis `00`. |
| **Nhược** | Không live; cần regenerate; dễ stale nếu không ghi exact SHA/Run id. |

### (C) CLI-only

| Chiều | Đánh giá |
| ----- | -------- |
| **Auth** | Host local / Orca session; không portal session. Coordinator đã dùng `ORCA orchestration …` trong mailbox loop. |
| **Deploy** | Không. Phân phối = binary/skill/script trên máy operator. |
| **Fit Vemoki** | **Tốt cho vòng lặp điều phối.** README spike ghi rõ: `worker-list --json` đã có lifecycle/provider, **chưa** token/CPU per role — CLI là nơi mở rộng tự nhiên. |
| **Effort** | Thấp nhất cho slice hiển thị: parse JSON → bảng Role × metric; có thể reuse pattern agent-top (live CPU/MEM/tokens) ở lớp host, không qua Next.js. |
| **Ưu** | Nhanh, khớp Orca; không đụng ownership web; dễ iterate metric taxonomy từ `01`. |
| **Nhược** | Không “share link” cho người ngoài terminal; cần (B) nếu muốn evidence bất biến trên PR/Issue. |

## 4. Khuyến nghị MVP

### Bề mặt MVP chính: **(C) CLI-only**

**Lý do (tóm tắt):**

1. Audience = coordinator/operator trên host Orca — đã sống trong CLI; không cần portal session.
2. Zero deploy / zero đụng `apps/web` — đúng constraint spike và ownership web role (chỉ docs).
3. Unblock sớm trước data plane đầy đủ: làm giàu output từ `worker-list` + log/artifact local; gắn Role ID khi Dispatch có role trong spec.
4. Architecture impact thấp hơn (A): không thêm capability/nav/BFF vào sản phẩm Vemoki.

### Bề mặt kèm theo (cùng MVP, không thay C): **(B) static markdown export**

- Một lệnh CLI (hoặc CI) ghi `docs/spikes/…/reports/<run-id>.md` hoặc artifact CI kèm **exact SHA + Run/Dispatch ids**.
- Phục vụ DoD / retro / `00-synthesis` mà không mở surface portal.
- Effort biên nhỏ nếu CLI đã render bảng — chỉ thêm `--format md` / redirect.

### Hoãn: **(A) trang trong `apps/web`**

Điều kiện mở lại (sau MVP, không trong spike UI):

- Data plane (`06`) có contract ổn định + retention/privacy rõ.
- Audience xác nhận = **platform operator only** (không `/admin` tenant).
- Product/BA chấp nhận “ops tooling” trong portal vs tool riêng.
- Effort ước lượng: route + guard + BFF + UAT headless ≥ 1 Task web riêng, sau contract.

**Không** đặt monitor Role cạnh event report tenant — tránh nhầm “báo cáo sự kiện” với “hiệu quả agent”.

## 5. Gợi ý shape MVP (không implement)

```text
# Live (C)
orca … worker-list --json | role-monitor summarize --by role
# → bảng: role_id | dispatches | outcome | duration | (token/cpu khi có)

# Durable (B)
… same … --format md > docs/spikes/agent-role-monitor/reports/<run>.md
# header: SHA, runId, generated_at, gaps (thiếu telemetry = explicit)
```

Trạng thái UI nếu sau này làm (A): reuse `surface-state` (empty / loading / ready / error / denied) — nhưng **không** là gate MVP.

## 6. Rủi ro / giới hạn spike này

- Graph/community overview hiện nghiêng backend/admin-event; không thay quan sát tree `apps/web` ở §2.
- Chưa đọc sâu `01`–`06` (constraint ownership) — khuyến nghị bề mặt giả định taxonomy + data plane sẽ feed CLI/MD; nếu `06` chọn push-only vào portal API, cần revisit (A) trong synthesis.
- CLI không thay privacy policy: không in prompt/PII; aggregate theo Role ID.

## 7. Acceptance checklist (Task web)

- [x] Đánh giá (A)/(B)/(C) theo auth, deploy, fit Vemoki, effort.
- [x] Khuyến nghị bề mặt MVP + lý do: **CLI-only (C) + export markdown (B); hoãn portal (A).**
- [x] Không implement UI; không sửa `apps/web`; chỉ file này.
