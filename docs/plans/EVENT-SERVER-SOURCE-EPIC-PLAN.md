# Epic #254 — Nguồn sự kiện từ server (bỏ fixture hardcode client)

| Trường | Giá trị |
| --- | --- |
| Epic | [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| Orca Run | `run_86f42281f748` |
| Vai trò soạn | Epic planner (`orca-epic-orchestrator.mdc`) — **không** role coding catalog |
| Agent | `cursor` (`orca-agent-routing-coordinator.mdc`) |
| Ngày soạn | 2026-10-18 |
| Baseline inventory SHA | `e8512d0055e0e9d6585007e8363b6224a7138b12` (worktree `epic254-planner`) |
| Board | [Project #3](https://github.com/users/hangndat/projects/3) — Status động; file này **không** tự `Hoàn thành` |
| Ngôn ngữ | Tiếng Việt (giữ ID, path, API, SHA) |

**Phân loại bằng chứng:** mục inventory = **quan sát** source/docs tại SHA trên. Story/Task/DAG = **đề xuất planner** (cập nhật khi BA/PD/Architect handoff về). `worker_done` ≠ DoD ≠ pilot ready.

**Non-goals (Epic):** không mở rộng MVP ngoài published event / admin CMS đã có; không deploy prod / store submit trừ ủy quyền riêng; không đổi auth/RLS; **được giữ** fixture/demo-seed **trên server** (D9) cho local — client không hardcode nội dung sự kiện làm nguồn hiển thị chính.

---

## 1. Inventory ngắn (fixture vs API)

### 1.1 Client còn hardcode / fixture làm nguồn hiển thị

| Surface | Path | Quan sát |
| --- | --- | --- |
| Web home catalog | `apps/web/app/page.tsx` + `apps/web/src/events.ts` | List + link từ `demoEventRoutes()` / `findDemoEvent` (Sunburst FUN FEST, Northline Form & Forum) — **nguồn chính** trang chủ |
| Web public event page | `apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx` | `generateStaticParams` + render qua `findDemoEvent`; media qua `demoMediaForEventId` |
| Web demo media pack | `apps/web/src/demo-media.ts` | Map id fixture (`fixture-fun-fest`, …) — phụ thuộc catalog hardcode |
| iOS events home | `apps/mobile/src/screens/events.tsx` + `apps/mobile/src/data/demo-events.ts` | FlatList **demo** (`demo-fun` / `demo-studio`) là nội dung mặc định; published list chỉ load khi bấm CTA |
| iOS fixture route | `apps/mobile/src/app/events/fixture/[eventId].tsx` | Deep link fixture tường minh |
| iOS detail fixture branch | `apps/mobile/src/screens/event-detail.tsx` | `fixture=true` → `findDemoEvent`; published path riêng (fail-closed) |

### 1.2 API / client đã có (nhưng Nest public còn thiếu)

| Lớp | Path / endpoint | Quan sát |
| --- | --- | --- |
| Contract (nhẹ) | `packages/contracts` `PublicEvent` | Catalog projection tối giản (id/slug/name/startsAt/…) |
| TD contract | `docs/TECHNICAL-DESIGN.md` §10 | `GET /public/tenants/{slug}/events/{slug}` — published-only |
| Nest OpenAPI | `apps/api/openapi.json` | **Không** có path `/v1/public/tenants/...` (chỉ admin `/v1/tenants/{tenantId}/events...`) |
| Nest controllers | `apps/api/src/*.ts` | Event admin + config publish + branding **tenantId**; **chưa** PublicController list/detail theo slug |
| Published form (BE lib) | `packages/backend/src/published-form.ts`, `config-publish.ts` | Đọc payload theo `published_config_version` — dùng redeem/claim; **chưa** expose public catalog HTTP |
| Web BFF detail | `apps/web/app/api/bff/public/tenants/[tenantSlug]/events/[eventSlug]/route.ts` | Proxy `forwardPublic` → Nest; sẽ 404 cho đến khi Nest có route |
| Web BFF list | — | **Chưa** có `.../events` (không slug) |
| Web redeem/claim | `apps/web/src/redeem/published-schema.ts` | Đã load form/terms published qua BFF (không hardcode nội dung event page) |
| iOS published client | `apps/mobile/src/published/published-event-api.ts` (+ `types.ts`) | `GET /v1/public/tenants/{slug}/events` + `.../{eventSlug}`; fail-closed; **không** fallback demo |
| Evidence gap | `docs/reviews/D9-E2E-WEB-IOS-TICKET*.md` | curl local+prod Nest `Cannot GET /v1/public/...` → **404** (known gap backend) |
| Server demo seed | `packages/backend/src/demo-seed.ts` + `docs/demo/D9-DEMO-DATASET.md` | D9 `demo-fun` / `demo-studio` + publish snapshot — **được giữ** cho local |

### 1.3 Kết luận inventory (suy luận planner)

1. **Nguồn chuẩn chưa đóng vòng:** client iOS + BFF web đã gọi contract TD, nhưng Nest **thiếu** public published routes → HTTP 200 catalog chưa có.
2. **Web public marketing surfaces** vẫn 100% fixture hardcode (`events.ts`); lệch tenant/slug so với D9 seed (`sunburst`/`northline` vs `demo-fun`/`demo-studio`).
3. **iOS** đã tách published vs fixture đúng hướng fail-closed; việc còn lại là **promote published làm nguồn chính** + thu hẹp fixture về nhãn demo tường minh (không xóa seed server).
4. Architecture impact **có**: thêm Nest public projection (+ có thể BFF list); có thể thống nhất shape `PublicEvent` (contracts) với `PublishedEventDetail` (iOS local types / sections/faq/form).

---

## 2. Story → Task DAG (ownership + Role ID)

> Issue GitHub Story/Task **chưa tạo** trên board tại thời điểm plan — ID dưới đây là **slug đề xuất** để coordinator mở Issue. Cập nhật số Issue khi tạo.

```text
Epic #254
├── S0 Discovery / design (wave hiện tại — song song)
│   ├── T-BA   product-ba
│   ├── T-PD   product-design
│   └── T-ARCH architect handoff (docs; không role coding catalog)
├── S1 Backend public published catalog          [dep: S0 ARCH (+ BA AC)]
│   ├── T-BE-1 Nest GET list + detail (+ tests)
│   └── T-REV-BE reviewer-dod (± reviewer-security)
├── S2 Web public surfaces từ server             [dep: S1 merge SHA hoặc contract freeze]
│   ├── T-WEB-1 Home + /t/.../events/... + BFF list nếu thiếu
│   └── T-REV-WEB reviewer-dod
├── S3 iOS public surfaces từ server             [dep: S1 merge SHA hoặc contract freeze]
│   ├── T-IOS-1 Promote published list/detail; demote fixture UI
│   └── T-REV-IOS reviewer-dod
├── S4 Coordinator contract / OpenAPI / docs     [dep mềm: song song S1 nếu chỉ regen sau BE]
│   └── T-COORD-1 OpenAPI + contracts sync + ROADMAP note (không Hoàn thành Epic)
└── S5 Milestone gates                           [dep: S2+S3 merged + DoD]
    ├── T-UAT headless web (+ iOS sim)
    └── T-IOS-BUILD local Expo prebuild + xcodebuild (Team BLUA62D52G)
```

### 2.1 Story S0 — Discovery (đang chạy wave 1)

| Task slug | Role ID | Path role | Ownership / artifact | Deps thật |
| --- | --- | --- | --- | --- |
| `T-BA` | `product-ba` | `docs/agents/roles/product-ba.md` | AC, inventory BA, gaps P0; docs only | — |
| `T-PD` | `product-design` | `docs/agents/roles/product-design.md` | Flow public event + empty/error/loading từ server; handoff UI | Soft: BA AC (có thể song song skeleton) |
| `T-ARCH` | *(không catalog coding)* | — | Nguồn chuẩn, contract public list/detail, migration bỏ demo catalog client, seed server giữ | Soft: inventory planner + BA |

### 2.2 Story S1 — Backend public catalog

| Task slug | Role ID | Path role | Scope | Deps thật |
| --- | --- | --- | --- | --- |
| `T-BE-1` | `backend` | `docs/agents/roles/backend.md` | `apps/api`, `packages/backend` (+ DB tests nếu cần): implement `GET /v1/public/tenants/{tenantSlug}/events` (cursor) và `GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}` — **chỉ** projection published; 404 draft/unknown; không lộ admin fields; reuse `published_config_version` / brand snapshot / sections từ publish path | **Hard:** Architect contract freeze (path + DTO). Soft: BA AC |
| `T-REV-BE` | `reviewer-dod` (+ `reviewer-security` nếu chạm projection/authz) | `docs/agents/roles/reviewer-dod.md` | Exact SHA PR BE; session ≠ implementer | `T-BE-1` → `Chờ duyệt` |

### 2.3 Story S2 — Web

| Task slug | Role ID | Path role | Scope | Deps thật |
| --- | --- | --- | --- | --- |
| `T-WEB-1` | `web` | `docs/agents/roles/web.md` | `apps/web` only: home + `/t/.../events/...` lấy từ BFF/server; empty/error/loading theo PD; **không** dùng `events.ts` làm nguồn chính; giữ nhãn demo nếu còn surface fixture tường minh; thêm BFF list proxy nếu Nest list có mà BFF thiếu | **Hard:** S1 public detail (+ list nếu home cần). Soft: PD handoff |
| `T-REV-WEB` | `reviewer-dod` | `docs/agents/roles/reviewer-dod.md` | Exact SHA PR web | `T-WEB-1` → `Chờ duyệt` |

### 2.4 Story S3 — iOS

| Task slug | Role ID | Path role | Scope | Deps thật |
| --- | --- | --- | --- | --- |
| `T-IOS-1` | `ios` | `docs/agents/roles/ios.md` | `apps/mobile` only: Events home ưu tiên `fetchPublishedEventList`; detail published mặc định; fixture chỉ route/nhãn demo tường minh; **không** fallback fixture khi API lỗi; local build only (không EAS Cloud) | **Hard:** S1 list/detail HTTP 200 trên môi trường UAT. Soft: PD copy/states |
| `T-REV-IOS` | `reviewer-dod` | `docs/agents/roles/reviewer-dod.md` | Exact SHA PR iOS | `T-IOS-1` → `Chờ duyệt` |

### 2.5 Story S4 — Coordinator

| Task slug | Role ID | Path role | Scope | Deps thật |
| --- | --- | --- | --- | --- |
| `T-COORD-1` | *(coordinator — không coding catalog)* | — | Root: sync OpenAPI/`packages/contracts` nếu S1 đổi contract; ghi chú ROADMAP/scope; **không** merge hộ ngoài ủy quyền; không sửa `apps/web|mobile` trừ tooling UAT scripts nếu cần | Soft: sau S1 tip SHA |

### 2.6 Story S5 — Milestone gates (Epic đóng)

| Task slug | Role | Scope | Deps |
| --- | --- | --- | --- |
| `T-UAT` | coordinator / ownership hỗ trợ | Headless web (`scripts/web-uat.sh`) + iOS (`scripts/sim-uat.sh`); artifact `apps/web/.uat-artifacts/`, `apps/mobile/.uat-artifacts/`; cite exact SHA | S2+S3 merged + CI xanh |
| `T-IOS-BUILD` | `ios` hoặc gate owner | Local Expo prebuild + xcodebuild/fastlane; Team `BLUA62D52G`; **không** EAS Cloud | S3 merged |
| Review index | `reviewer-dod` | `docs/reviews/*` + exact SHA then-chốt | Sau UAT/build |

**Deploy prod:** chỉ khi task/Epic ủy quyền riêng — **không** gate mặc định Epic #254.

---

## 3. Ready queue & wave đề xuất

### 3.1 Wave 1 (đang chạy — bề rộng tối đa discovery)

| Slot | Task | Lý do in-wave |
| --- | --- | --- |
| ✅ | Epic planner (file này) | Phân DAG / inventory |
| ✅ | `T-BA` | Docs độc lập path |
| ✅ | `T-PD` | Docs/design độc lập path |
| ✅ | `T-ARCH` | Architecture handoff độc lập |

**Loại khỏi Wave 1 (coding):** toàn bộ `T-BE-1` / `T-WEB-1` / `T-IOS-1` — **thiếu hard dep** Architect contract freeze (+ BA AC). Không spawn feature coding trước handoff.

### 3.2 Wave 2 (sau S0 handoff — đề xuất fan-out)

| In-wave | Task | Ghi chú |
| --- | --- | --- |
| ✅ | `T-BE-1` | Unblock Nest public; ownership BE |
| ✅ | `T-COORD-1` (phần contract stub/OpenAPI prep) | Song song nếu không đụng cùng file `T-BE-1` — nếu conflict path → tuần tự sau tip BE |
| ❌ | `T-WEB-1` / `T-IOS-1` | Chờ **merge SHA** (hoặc contract freeze + mock chỉ khi Architect cho phép) của public routes |
| ❌ | Reviewers | Chưa có PR |

### 3.3 Wave 3 (sau S1 merged + CI xanh)

| In-wave | Task | Ghi chú |
| --- | --- | --- |
| ✅ | `T-WEB-1` ∥ `T-IOS-1` | Cùng consumer contract; ownership khác path → **song song bắt buộc** |
| ❌ | `T-REV-*` | Sau từng PR `Chờ duyệt` |
| ❌ | S5 gates | Sau merge consumer + DoD |

### 3.4 Wave 4 (review / backpressure)

Khi ≥1 PR `Chờ duyệt`: spawn **mọi** `reviewer-dod` độc lập cùng wave (≠ implementer). WIP đầy (≥3 `Chờ duyệt` / ≥2 PR cùng slice) → ưu tiên review/fix trước feature mới (`github-project-tracking.mdc`).

### 3.5 Lý do loại khỏi wave (checklist planner)

| Lý do hợp lệ | Áp dụng |
| --- | --- |
| Hard dep artifact thiếu | Wave 1→2: thiếu Nest public / Architect DTO |
| Cùng ownership đang có feature Dispatch | Một PR BE tại một thời điểm |
| WIP / hàng đợi duyệt đầy | Trì hoãn feature; vẫn parallel reviewers |
| **Không hợp lệ** | “Làm tuần tự Story cho dễ”; chờ cả Story đóng khi Task khác Story đã unblocked |

---

## 4. Milestone gates (đóng Epic #254)

Theo `github-project-tracking.mdc` § Milestone / Epic DoD:

| Gate | Yêu cầu Epic #254 |
| --- | --- |
| (a) Headless UAT | Web: home + event detail lấy từ server (seed D9); empty/error không hiện fixture-as-published. iOS: list/detail published từ API; fail-closed. Artifact + commands trong `docs/reviews/*` hoặc Issue |
| (b) Local iOS build | Bắt buộc (chạm `apps/mobile`): Expo prebuild local + xcodebuild; Team `BLUA62D52G`; không EAS Cloud |
| (c) Deploy prod | **Không** mặc định — chỉ khi ủy quyền riêng |
| (d) Review artifacts | `docs/reviews/*` + exact SHA cho BE/web/iOS then-chốt |

Phân biệt: **code complete** (PR) ≠ **acceptance complete** (DoD+CI+evidence) ≠ **pilot ready**.

---

## 5. Acceptance / DoD gợi ý theo slice (để BA tinh chỉnh)

| Slice | AC tối thiểu (đề xuất) |
| --- | --- |
| BE | curl `GET /v1/public/tenants/demo-fun/events` → 200 + items từ seed published; draft → 404; không PII admin |
| Web | `/` và `/t/{tenant}/events/{slug}` không đọc `findDemoEvent` làm nguồn chính; 404/unreachable có empty/error theo PD |
| iOS | Events tab load published không cần CTA “chỉ demo”; API lỗi ≠ hiện demo như published |
| Chung | Server D9 seed vẫn chạy local; client fixture (nếu còn) gắn nhãn demo tường minh |

---

## 6. Handoff & cập nhật plan

| Nguồn | Khi có artifact | Planner action |
| --- | --- | --- |
| BA | `docs/plans/*254*` / Issue comment AC | Cập nhật §5 + ưu tiên P0 |
| PD | `docs/design/*` flow/states | Gắn AC UI vào `T-WEB-1` / `T-IOS-1` |
| Architect | contract DTO + quyết định list shape | Khóa Wave 2 `T-BE-1`; điều chỉnh deps web/iOS |
| Coordinator | Issue # Story/Task trên Project #3 | Thay slug → số Issue; không đổi Status `Hoàn thành` từ planner |

**Tại thời điểm soạn:** sibling worktree `epic254-ba` / `epic254-pd` / `epic254-architect` **chưa** có file `*EVENT*254*` riêng — plan dựa inventory; **cập nhật** khi handoff về (không spawn worker con từ planner).

---

## 7. Anti-patterns (Epic này)

```text
❌ Web/iOS fallback sang events.ts / demo-events khi Nest 404
❌ Xóa packages/backend demo-seed “cho sạch” (cần cho local)
❌ Một PR trộn apps/api + apps/web + apps/mobile
❌ Planner/BA/PD tự code ownership slice
❌ Tuyên bố pilot / Hoàn thành Epic chỉ vì worker_done
✅ Nest public → merge → web ∥ iOS → reviewers song song → UAT headless + iOS local build
```

---

## 8. Liên kết

- Epic: https://github.com/hangndat/ticket-solution/issues/254
- Rules: `.cursor/rules/orca-epic-orchestrator.mdc`, `orca-parallel-workers.mdc`, `github-project-tracking.mdc`, `uat-headless.mdc`
- Roles: [docs/agents/README.md](../agents/README.md)
- TD public: `docs/TECHNICAL-DESIGN.md` §10
- D9 seed: `docs/demo/D9-DEMO-DATASET.md`, `docs/reviews/D9-DEMO-SEED.md`
- Known Nest gap: `docs/reviews/D9-E2E-WEB-IOS-TICKET-DOD.md`
