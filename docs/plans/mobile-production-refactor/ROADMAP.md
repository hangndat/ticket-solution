# Roadmap Epic #580 — Refactor trải nghiệm production (mobile)

> **Refactor app production — Issue #580, 20/10/2026:** [Issue và phê duyệt](https://github.com/hangndat/ticket-solution/issues/580), [gói handoff](README.md). “O18” trong các bảng lịch sử bên dưới là nhãn cũ của gói mobile; [DECISION-LOG.md](../../DECISION-LOG.md) dùng O18 cho Portal, không phải authority mobile. [README.md](README.md) thắng `archive/`.

> **Đối chiếu 24/10/2026:** đây là roadmap và ma trận gap tại thời điểm thiết kế, không phải danh sách task live. Wave 1 đã có PR #586, #587 và #597 merge; Issue #580 đã đóng. §1, §4, §7 và §8 giữ nguyên để truy vết đề xuất ban đầu. Trạng thái hiện hành lấy từ [Project #3](https://github.com/users/hangndat/projects/3), PR và evidence exact SHA; các AC/UAT chưa được xác nhận chỉ bằng việc merge. Xem [README](README.md).

| Trường | Giá trị |
| --- | --- |
| **Epic GitHub** | [#580](https://github.com/hangndat/ticket-solution/issues/580) |
| **Run** | `run_526c9a272efd` |
| **Base SHA đọc code** | `6ba435ebfaf8` (main) + dirty `apps/mobile` (~105 paths — [IOS-AUDIT.md](IOS-AUDIT.md)) |
| **Planner** | Dexter · planner · Cost tier `cheap` |
| **Architecture impact** | **Có** |
| **Synthesis inputs** | [BA-RESEARCH.md](BA-RESEARCH.md) · [PD-HANDOFF.md](PD-HANDOFF.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [IOS-AUDIT.md](IOS-AUDIT.md) |

**Phân loại hoàn thành:**

| Mốc | Epic #580 |
| --- | --- |
| **Design complete** | Gói plan + ROADMAP + artifacts §10 — **user duyệt 20/10/2026** (mockup mobile/web + roadmap) |
| **Code complete** | PR merge `main` theo Task ownership |
| **Acceptance complete** | Reviewer ≠ implementer, exact SHA, AC §6, UAT iPhone (đội) |
| **Pilot ready** | TF/Archive + UAT vật lý + AC §6 đủ trên integrated SHA |

---

## 1. Evidence — hiện trạng vs O18 (tóm tắt)

| Hạng mục | Quyết định O18 | Gap (code / contract) | Nguồn |
| --- | --- | --- | --- |
| **API origin** | Luôn `https://api.vemoki.com` mọi **dev + runtime**; chỉ test inject transport | `getApiBaseUrl()` vẫn đọc env/extra | [IOS-AUDIT §2](IOS-AUDIT.md), `config.ts` |
| **Catalog** | Platform published, **không** `EXPO_PUBLIC_TENANT_SLUG` | Client tenant-scoped ADR-19; BE chưa có list đa tenant | [ARCHITECTURE §4.1](ARCHITECTURE.md), `catalog-context.ts` |
| **Account / push** | JTBD; không jargon/CTA trùng; permission thật + moment | Account + `push-status.tsx` như audit | [PD-HANDOFF](PD-HANDOFF.md), [BA §5](BA-RESEARCH.md) |
| **Staff / ví** | 3 tab; ẩn ví guest | WIP dirty tree ~aligned; cần **preserve/regression** khi integrate | [IOS-AUDIT §5–6](IOS-AUDIT.md) |
| **Redeem** | Auth gate + draft park | Tenant-bound OK; global → **SCR** | [BA D-SCR-01](BA-RESEARCH.md) |

**Dirty tree:** sau roadmap approval — **snapshot / diff handoff / branch** từ tree user; **không** `cherry-pick` commit không tồn tại; **không** reset wt user.

---

## 2. Quyết định đã chốt (không hỏi lại)

1. **Catalog:** mọi sự kiện PUBLIC + published toàn platform; không tenant slug env cho Events home ([README](README.md), [BA D-EVT-01](BA-RESEARCH.md)).
2. **API host:** runtime **luôn** `https://api.vemoki.com` (OIDC theo bake `auth.vemoki.com`); **không** env override, local URL, demo fallback trên app — **kể cả Debug/Metro**; unit/integration **chỉ** inject `fetchImpl`/transport ([BA D-API-01](BA-RESEARCH.md)).
3. Account, push moment, staff 3 tab, guest wallet, redeem auth, SCR tách, RLS/fail-closed, UAT iPhone — như README O18.

---

## 3. Khuyến nghị kỹ thuật (planner — không phải gate user)

| ID | Chọn | Ghi chú |
| --- | --- | --- |
| **K-API-01** | `GET /v1/public/events` (cursor, `PublishedEventListResponse`) | [ARCHITECTURE phương án A](ARCHITECTURE.md); per-tenant routes giữ cho detail/deep link |
| **K-API-02** | `getApiBaseUrl()` / OIDC public getters → hằng prod allowlist; bỏ qua env/extra cũ; không trả null vì cấu hình cũ | **Không** điều kiện `getApsEnvironment()` — áp dụng mọi runtime |
| **K-WALLET-01** | `GET /v1/me/tickets` optional `tenantId` (W1) | [ARCHITECTURE §6.2](ARCHITECTURE.md); tách khái niệm catalog slug vs ví UUID |
| **K-PUSH-01** | Primer in-context (N1) — [PD-HANDOFF §4](PD-HANDOFF.md) | Không cold-start prompt |
| **K-STAFF-01** | T8 chỉ **preserve + regression** navigation/gate đã có trong WIP | Không feature refactor staff mới trong #580 |
| **K-INTEGRATE-01** | Một **iOS worker** / một dispatch cho cùng `apps/mobile` slice — paths **tuần tự** hoặc một Task integration coherent | Cấm wave song song T6∥T7∥T8 coding cùng slice |

**ADR:** amendment “platform public catalog” — owner Architect ([ARCHITECTURE.md](ARCHITECTURE.md)); coordinator cấp ID.

**Gate coding:** user **roadmap review** (product O18), không re-ask requirement catalog/API prod.

---

## 4. Epic → Story → Task (đề xuất lúc lập kế hoạch 20/10)

Prefix **MPR**. Persona theo [docs/agents/README.md](../../agents/README.md).

### Epic **MPR-E580**

Parent [#580](https://github.com/hangndat/ticket-solution/issues/580). DoD: AC §6 + `docs/reviews/MPR-*` + UAT §6.

### Stories

| Story | Mô tả | Arch impact |
| --- | --- | --- |
| **MPR-S1** | Contracts freeze + BE platform catalog | Có |
| **MPR-S2** | iOS transport + Events consumer | Có |
| **MPR-S3** | PD handoff (done) → Account UX | Không |
| **MPR-S4** | Push permission UX | Có |
| **MPR-S5** | Staff navigation preserve/regression | Không |
| **MPR-S6** | Redeem auth + draft (tenant-bound) | Có (SCR sau) |
| **MPR-S7** | Review + UAT vật lý | — |

### Tasks

| Task | Role · Persona | Paths | Deps (thật) | Cost | Arch |
| --- | --- | --- | --- | --- | --- |
| **MPR-T1** | `backend` · **Gonic** hoặc **Colin** | `apps/api` `GET /v1/public/events`, tests published | **MPR-T2** merge (contract freeze) | standard | Có |
| **MPR-T2** | coordinator · contracts | `packages/contracts`, OpenAPI | — | standard | Có |
| **MPR-T3** | `ios` · Zico | `identity/config.ts`, `catalog-context.ts`, `published-event-api.ts`, `events.tsx`, copy | **T1+T2** integrated tip | standard | Có |
| **MPR-T4** | `ios` · Zico | `account.tsx`, `screen-state-copy.ts`, `push/*` (Account + moment) | [PD-HANDOFF](PD-HANDOFF.md) (T5 artifact **done**) | standard | Có |
| **MPR-T5** | `product-design` · Liv | [PD-HANDOFF.md](PD-HANDOFF.md) (đã giao) | — | **standard** | Có |
| **MPR-T6** | `ios` · Zico | `redeem.tsx`, `redeem-draft-intent.ts`, auth gates | — (không phụ thuộc catalog T3) | standard | Có |
| **MPR-T7** | `ios` · Zico | Staff tab/gate **regression only**; gate UAT/fixture routes Release | [IOS-AUDIT](IOS-AUDIT.md) handoff sau approval | standard | Không |
| **MPR-T8** | `reviewer-dod` + `reviewer-security` · **James · dod+sec** | exact SHA tích hợp | T1–T7 merged | **standard** | Có |
| **MPR-T9** | `ios` + coordinator | UAT checklist iPhone thật, `docs/reviews/MPR-UAT-*` | T8 PASS | standard | — |

**Ghi chú Task:**

- **T3** gộp transport pin (K-API-02) + catalog consumer — một dispatch iOS, không tách worker song song.
- **T4** gộp Account + push (trước là T6∥T7) — thứ tự nội bộ: layout/copy → permission state machine ([PD §9](PD-HANDOFF.md)).
- **T5** design artifact hoàn tất; không block spawn T4 (PD đã handoff).
- **T6** redeem polish **không** dep T3/T4 (tránh dep giả redeem→catalog).
- **T7** không re-implement staff refactor; preserve WIP qua snapshot/branch; AC regression §6.
- **T8** một session James **dod+sec** cùng SHA ([orca routing](../../../.cursor/rules/orca-agent-routing-core.mdc)).
- **T9** owner **iOS + coordinator** chạy UAT trên iPhone thật (đội); user không bắt buộc làm tester; ghi blocker thật nếu thiếu thiết bị/quyền.

**Web (optional):** **MPR-W1** nếu Architect ghi consumer web cần `GET /v1/public/events` — không chặn iOS.

**CI/staging:** inject transport/mock; không deploy prod / mutate DB prod.

---

## 5. Dependency graph (rút gọn)

```text
T2 (contracts) ──► T1 (BE) ──► T3 (iOS catalog+host)
T5 (PD done) ─────────────────► T4 (iOS account+push)
T6 (redeem) ── independent catalog branch
T7 (staff regression) ── after roadmap approval + IOS-AUDIT handoff
T1..T7 merge ──► T8 (James dod+sec) ──► T9 (UAT)
```

Song song **được:** **T2 ∥ T1** chỉ khi T1 đọc draft contract (không merge consumer trước freeze); thực tế ưu tiên **T2 → T1**. **T3 ∥ T4 ∥ T6** chỉ khi **khác worker và không path conflict** — coordinator vẫn **không** spawn hai iOS worker cùng `apps/mobile` trong một wave.

---

## 6. Acceptance criteria (thực kiểm)

### AC-CAT — T1, T2, T3

- [ ] `GET /v1/public/events` unauthenticated; predicate ADR-19; không admin fields.
- [x] iOS Events **không** `getTenantSlug()`; misconfig ≠ thiếu slug env. (MPR-T3)
- [ ] Lỗi/empty tách bạch; không fixture fallback ([IOS-AUDIT B1](IOS-AUDIT.md)).

### AC-API — T3 (K-API-02)

- [x] Mọi runtime (Debug + Release): origin `https://api.vemoki.com`; test inject transport only. (MPR-T3 `getApiBaseUrl`)
- [x] Env/extra URL lạ **không** đổi getters; unit test HOST-2. (MPR-T3)

### AC-ACC / AC-PUSH — T4 ([PD-HANDOFF §8](PD-HANDOFF.md), [BA §9](BA-RESEARCH.md))

- [ ] AC-A1…A8 PD; AC-ACC-01 BA; không CTA redeem trên Account; không toggle giả quyền OS.

### AC-NAV — T7

- [ ] Staff 3 tab; guest ẩn ví; **không** regression gate scan ([K-STAFF-01](README.md)).
- [ ] UAT/fixture routes gated Release ([IOS-AUDIT B2](IOS-AUDIT.md)) nếu trong scope T7.

### AC-REDEEM — T6

- [ ] Auth gate + draft park; không mã trong URL. Global SCR → workstream riêng.

### AC-REVIEW — T8

- [ ] Verdict PASS/FAIL; catalog public + push binding + không leak draft.

### AC-UAT — T9

- [ ] Checklist iPhone thật: Events platform → login → ví → redeem → push moment → staff (nếu eligible).
- [ ] Evidence `docs/reviews/MPR-UAT-*`; simulator không thay PASS.

---

## 7. Waves (không chồng iOS slice)

```text
Wave 0   Design package + ROADMAP finalize                    [now]
Wave 1   MPR-T2 contracts → MPR-T1 BE (sau freeze tip)
Wave 2   MPR-T3 iOS (catalog + host)  ∥  optional prep T6/T7 docs
Wave 3   MPR-T4 iOS (account + push)   — một worker, tuần tự nội bộ
Wave 4   MPR-T6 iOS redeem  (có thể trước T4 nếu worker rảnh — khác path)
Wave 5   MPR-T7 iOS staff regression (preserve WIP handoff)
Wave 6   MPR-T8 James dod+sec (one SHA)
Wave 7   MPR-T9 physical UAT (iOS/coordinator)
```

**Cấm:** một wave spawn **T4 ∥ T6 ∥ T7** cùng lúc trên cùng iOS worktree.

---

## 8. Đề xuất Issues GitHub (snapshot trước triển khai)

| Issue | Title (VI) | Task |
| --- | --- | --- |
| #NEW-MPR-1 | Contracts: OpenAPI platform events list | T2 |
| #NEW-MPR-2 | BE: `GET /v1/public/events` | T1 |
| #NEW-MPR-3 | iOS: API prod cố định + catalog platform | T3 |
| #NEW-MPR-4 | iOS: Tài khoản + thông báo production | T4 |
| #NEW-MPR-5 | iOS: Redeem auth + draft intent | T6 |
| #NEW-MPR-6 | iOS: Staff navigation regression | T7 |
| #NEW-MPR-7 | Review dod+sec MPR | T8 |
| #NEW-MPR-8 | UAT iPhone Epic 580 | T9 |

PD artifact **#580** — không Issue coding (T5 done).

---

## 9. Workstream SCR (single-code)

Không migration/flag prod trong #580. Sau SCR contracts/BE: Task iOS global redeem **tách Epic**. Tham chiếu [kế hoạch SCR](../SINGLE-CODE-REDEMPTION-PLAN.md), [`docs/architecture/single-code-redemption.md`](../../architecture/single-code-redemption.md).

---

## 10. Artifact synthesis (handoff coordinator)

| Artifact | Điểm planner đã gắn vào ROADMAP |
| --- | --- |
| [BA-RESEARCH.md](BA-RESEARCH.md) | D-API-01, D-EVT-01, push 4 lớp, AC tổng hợp |
| [PD-HANDOFF.md](PD-HANDOFF.md) | IA phương án A, N1 push, AC-A* → T4 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | K-API-01/02, W1 wallet, deps BE→iOS |
| [IOS-AUDIT.md](IOS-AUDIT.md) | B1–B6, dirty handoff, T7 scope, Dexter screenshot evidence |

**Planner worker (20/10):** roadmap đủ để soạn specs; danh sách Issue §8 là đề xuất ban đầu, không dùng để tạo lại task đã triển khai.
