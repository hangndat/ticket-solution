# Kế hoạch Epic — Single-code redemption (global resolve)

> **Trạng thái:** **IN PROGRESS — user đã duyệt triển khai** (coding trên branch `hangndat/Single-code`; chưa prod / store).

| Trường | Giá trị |
| --- | --- |
| **Artifact kiến trúc** | [`docs/architecture/single-code-redemption.md`](../architecture/single-code-redemption.md) |
| **Base SHA thiết kế** | `6ba435ebfaf810e2a15149761e16abd193368280` |
| **Architecture impact** | Có — schema registry, SDF resolver, contracts, web+iOS UX, migration |
| **Board** | [Project #3](https://github.com/users/hangndat/projects/3) — Issues **chưa tạo** (coordinator sau review) |

**Phân loại hoàn thành:**

| Mốc | Ý nghĩa |
| --- | --- |
| **Design complete (mục này)** | Hai doc architecture + plan; quyết định ghi rõ |
| **Code complete** | PR merge `main` + CI theo Task |
| **Acceptance complete** | Reviewer ≠ implementer, exact SHA, AC Project |
| **Pilot ready** | Physical UAT + collision remediation + flags prod |

---

## 1. Tóm tắt sản phẩm

Attendee nhập **một mã** tại bất kỳ đâu trên web/iOS → đăng nhập nếu cần → server **resolve** tổ chức/sự kiện/loại vé → hiển thị tên công khai + form/terms → xác nhận → **issue** qua transaction hiện có.

**Khuyến nghị kỹ thuật:** Routing group + digest aliases; namespace **reserve toàn đời**; `AMBIGUOUS` quarantine **catalog-wide**; global resolve chỉ sau migration sạch (architecture doc §4–7, revision 2026-10-20).

---

## 2. Acceptance criteria (đề xuất)

### AC-1 Resolve (attendee)

- [ ] `POST /v1/redemptions/resolve` yêu cầu bearer; anonymous 401.
- [ ] Response chỉ metadata công khai + form/terms publish; **không** phát vé, không hold mã, không trừ quota.
- [ ] Invalid **hoặc** ambiguous legacy → cùng user copy; không liệt kê event khác.

### AC-2 Issue (unchanged semantics)

- [ ] `POST …/redemptions` với `tenantId/eventId` từ resolve + `Idempotency-Key` UUID.
- [ ] MANUAL approval, quota, consent, outbox, idempotency replay — hành vi giống baseline `issue.ts`.
- [ ] **Global flow:** `X-Redemption-Resolve-Token` **bắt buộc** (actor + routing_group + tenant/event + code binding).
- [ ] **Tenant-bound flow:** không token; hành vi D4 unchanged.

### AC-3 Routing & import

- [ ] Mọi insert có raw: group + candidate + alias **cho tất cả** `SUPPORTED_PEPPER_VERSIONS` trong cùng TX serialized.
- [ ] `routing_key` và `(pepper_version, code_hmac)` alias **UNIQUE vĩnh viễn** — tombstone không reuse.
- [ ] Dry-run báo `duplicateRoutingKey` / `duplicateDigestAlias` / `namespaceReserved`.

### AC-4 Legacy migration & global gate

- [ ] Backfill: multi-candidate cùng alias → `resolution = AMBIGUOUS` (mọi status); không route theo AVAILABLE.
- [ ] `single_code_resolve_global` chỉ bật khi **platform-wide** `AMBIGUOUS` count = 0 — **không** per-tenant pick candidate.

### AC-5 Client

- [ ] Web: entry nhập mã không chọn event (global hoặc home).
- [ ] iOS: tương tự; draft park qua login **không** đưa mã vào URL.
- [ ] Cùng DTO `packages/contracts`.

### AC-6 Security

- [ ] Rate limit user + IP + per-hmac failure bucket.
- [ ] Không raw code trong log/URL/audit.
- [ ] Reviewer-security pass trên resolver SDF + token binding.

---

## 3. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| Legacy HMAC collision — single input không usable | **Cao** nếu data thật trùng | Quarantine `AMBIGUOUS`; global flag off; remediation reissue mã mới |
| Resolver SDF lỗi → leak cross-tenant | **Cao** | Code review + sec; chỉ projection công khai; no dynamic SQL |
| Miss insert path → registry drift | Trung bình | Graph/CRG `redemption_codes` callers; integration test mọi import |
| UX stale resolveToken | Thấp | Re-resolve; clear copy |
| Pepper rotation / cross-version alias | Trung bình | Insert check all digests; legacy không rehash; doc limitation §6.4 |
| Mobile dirty tree conflict | Trung bình | iOS Task rebase `main` sau merge BE/contracts |

---

## 4. Rollout (không authorize prod deploy)

1. **Design review** — user duyệt roadmap product (§8); kỹ thuật đã reconcile trong architecture doc.
2. **Contracts PR** — resolve DTO, `RESOLVE_TOKEN_*` errors, flow enum `global|tenant_bound`.
3. **Migration PR** — `code_routing_*` tables + SDF + backfill (**không** prod until authorized).
4. **BE resolve API** — deploy với `single_code_resolve_global=off`.
5. **Remediation** — staff xử lý quarantine; reissue mã mới; đếm `AMBIGUOUS→0`.
6. **Web ∥ iOS** — global entry + token header; event page giữ legacy path.
7. **Flag on (platform)** — staging khi quarantine sạch.
8. **DoD** — sec + dod; physical UAT global input.
9. **Prod** — task riêng (chưa ủy quyền).

---

## 5. Epic → Story → Task (proposal)

> ID `SCR-*` = **Single Code Redemption** — coordinator tạo GitHub Issues khi user duyệt.

### Epic (parent)

**SCR-E1 — Đổi mã một ô nhập (global resolve)**  
Owner: coordinator. DoD Epic: AC §2 + evidence pilot staging.

### Stories

| Story | Mô tả |
| --- | --- |
| **SCR-S1** | Backend registry + resolver + migration |
| **SCR-S2** | Contracts + OpenAPI |
| **SCR-S3** | Web attendee entry + flow |
| **SCR-S4** | iOS attendee entry + flow |
| **SCR-S5** | Remediation tooling + ops runbook |
| **SCR-S6** | Review security + DoD |

### Tasks (ownership slice)

| Task ID | Role / slice | Paths (chính) | Deps |
| --- | --- | --- | --- |
| **SCR-T1** | `backend` | migration `code_routing_*`, insert hooks (all digest aliases), SDF resolve | — |
| **SCR-T2** | `backend` | `apps/api` route `POST /v1/redemptions/resolve`, rate limit wiring | SCR-T1, SCR-T3 |
| **SCR-T3** | coordinator → contracts | `packages/contracts`, OpenAPI regen | — (∥ T1 schema draft) |
| **SCR-T4** | `backend` | Backfill + quarantine report; mark `AMBIGUOUS` groups | SCR-T1 |
| **SCR-T5** | `web` | Global/home redeem entry, resolve→issue UI, BFF if needed | SCR-T3, SCR-T2 |
| **SCR-T6** | `ios` | `apps/mobile` redeem entry (read-only main), draft intent + resolve client | SCR-T3, SCR-T2 |
| **SCR-T7** | `reviewer-security` | Threat model resolver/token/logs | SCR-T2 exact SHA |
| **SCR-T8** | `reviewer-dod` | AC §2 + CI | T5,T6,T2 merged |
| **SCR-T9** | coordinator / ops | `docs/ops` runbook pepper + flag; **không** prod execute | SCR-T4 |

**Không gộp:** BE + web + iOS trên một PR (git-workflow).

---

## 6. Waves (chỉ dependency thật)

```text
Wave 0 (design)     [DONE this task] architecture + plan docs
Wave 1              SCR-T3 contracts ∥ SCR-T1 migration/registry (schema agreed)
Wave 2              SCR-T2 API resolve ∥ SCR-T4 backfill/report
Wave 3              SCR-T5 web ∥ SCR-T6 iOS   (sau contracts tip)
Wave 4              SCR-T7 security ∥ SCR-T8 dod (SHA tích hợp)
Wave 5              SCR-T9 ops docs + pilot flag (ủy quyền riêng)
```

- **Không** spawn coding trước user review roadmap (AGENTS.md).
- Mobile worktree dirty: iOS worker **checkout sạch** hoặc branch mới từ `main` integrated.

---

## 7. Test matrix (tối thiểu)

| Layer | Chi tiết |
| --- | --- |
| Unit | `hashRedemptionCode`, registry insert, token bind |
| API | resolve auth, rate limit, generic errors |
| Integration | import duplicate global; issue idempotency regression |
| E2E web | login → resolve → form → ticket |
| iOS | draft park → login → resolve → issue |
| Sec | AMBIGUOUS không leak; token actor binding; no namespace reuse |
| Physical | 1 device thật nhập mã printed |

---

## 8. User review (product)

| # | Nội dung cần duyệt |
| --- | --- |
| P1 | Mở Epic single-code global input + amend PRD M07 |
| P2 | Chấp nhận global input **tắt** đến khi ambiguity quarantine = 0 (event-page redeem vẫn có) |
| P3 | Remediation collision = phát **mã mới**, không recycle namespace |

Fork kỹ thuật (routing DDL, multi-pepper insert, resolveToken chỉ global, flag platform) — **đã chốt** trong [`single-code-redemption.md`](../architecture/single-code-redemption.md). User duyệt roadmap → coordinator tạo Issues + wave 1.

---

## 9. Liên kết

- Kiến trúc chi tiết: [`single-code-redemption.md`](../architecture/single-code-redemption.md)
- PRD M06–M07: [`PRD.md`](../PRD.md)
- Issue transaction: [`TECHNICAL-DESIGN.md`](../TECHNICAL-DESIGN.md) §8
- Import semantics: [`PORTAL-CONTRACT-HANDOFF.md`](../architecture/PORTAL-CONTRACT-HANDOFF.md)
