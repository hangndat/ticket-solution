# PORTAL — Story/Task triển khai (P0+P1 đã duyệt)

| Trường | Giá trị |
| --- | --- |
| Vai trò | Epic planner — **không** code / spawn / GitHub mutate |
| Agent | `cursor` |
| Run / Task / Dispatch | `run_34fde1e32ed1` / `task_5cd80d44ef3e` / `ctx_86fb71bf5406` |
| Base | `c7e344847b1acf1688302fef513b277fc8f18973` |
| Primary | [`PORTAL-ROADMAP.md`](./PORTAL-ROADMAP.md) + **O16** + **ADR-20** [`docs/ops/ADR-20-PORTAL-ADMIN.md`](../ops/ADR-20-PORTAL-ADMIN.md) |
| Manifest | [`portal-task-manifest.json`](./portal-task-manifest.json) |
| Architecture impact | **Có** |

## Board đã mở (không tạo lại S0)

| Issue | Vai trò |
| --- | --- |
| Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) | PORTAL P0+P1 |
| Story [#407](https://github.com/hangndat/ticket-solution/issues/407) | Docs/handoff S0 |
| [#408](https://github.com/hangndat/ticket-solution/issues/408) | Planner (Task này) |
| [#409](https://github.com/hangndat/ticket-solution/issues/409) | Architect ADR-20 — **đã có output**; không tạo `T-ARCH-ADR` mới |
| [#410](https://github.com/hangndat/ticket-solution/issues/410) | PD handoff/parity |

Manifest dưới đây = Story/Task **implementation** để coordinator tạo tiếp (S1…S6). **Không** nhân bản S0/#408–#410.

---

## Reconcile source + WIP

| Quan sát @ base | Hệ quả Task |
| --- | --- |
| `apps/portal` chưa có | `T-COORD-WS` + `T-WEB-FOUND` |
| ADR-20: `ticket-admin-web` + callback **`/api/auth/callback`** (không `/api/admin/auth/*` mới) | Web foundation theo ADR; không Task BE audience trừ gap Nest **thật** sau đo |
| ADR-20: thin `@ticket/web-session` (coordinator) | Gộp vào `T-COORD-WS` |
| Gaps Nest: members/invites, platform list, import CTR, invitations, codes, audit GET | BE Tasks dưới — **implement** multi-step import (không cắt sync làm mất parity) |
| BFF pending: chỉ approve/deny | Wire GET trong `T-WEB-OPS` (G-R2) |
| PR D13 #394/#396/#397/#401 | **Out** — không trùng O13 mobile/ticket-link/ops/apex |
| Queue ~7 PR D13 | Feature coding **chờ** WIP; docs/handoff tiếp tục |

**OUT:** multi-event BI, enterprise SSO, billing, payment/Wallet/Android, Gate migrate, prod DNS/deploy.

**Cap:** ≤1 feature coding `web` (`apps/portal` ± dual-run `apps/web`) và ≤1 `backend` cùng lúc. Reviewer DoD/security = **JIT khi PR** (không tạo Issue `T-REV-*` giả).

**Ownership web duyệt:** `apps/portal/**` (+ dual-run tối thiểu `apps/web` khi Task ghi). Role path: `docs/agents/roles/<id>.md`.

---

## Wave đề xuất (fan-out tối đa dưới WIP)

```text
Wave A (docs/WIP cho phép foundation):
  T-COORD-WS ∥ T-COORD-CTR-M ∥ (BE slot) T-BE-MEMBERS
  → sau WS: T-WEB-FOUND   [deps ADR-20 artifact đã có #409 — không chờ Task architect mới]

Wave B:
  T-COORD-CTR-T → T-BE-TYPES ∥ reviewers JIT
  → T-WEB-PREP (serial web; gồm Gate link trong shell)

Wave C:
  T-COORD-CTR-I → T-BE-IMPORT-INV (multi-step) → T-WEB-OPS
  T-BE-INV-CLAIM (app. attendee) khi BE slot trống

Wave D:
  T-COORD-CTR-F → T-BE-FILTERS ∥ T-WEB-HARDEN → DoD/security JIT

Wave E (P1.1):
  T-COORD-CTR-A → T-BE-PLATFORM-LIST | T-BE-AUDIT-CODES | T-BE-P-HEALTH (serial BE)
  → T-WEB-ADV (audit + platform zone serial)

Wave F (P1.2 local only):
  T-COORD-LOCAL-CUT ∥ T-WEB-DUALRUN → T-UAT-PORTAL → milestone DoD JIT
  // CẤM production DNS/deploy
```

**Deps artifact thật:** contract → BE → web consumer. ADR-20 **đã accept** → web auth **không** chờ Issue architect mới. `T-BE-MEMBERS` **không** dep ADR.

---

## Stories / Tasks (gọn — đủ P0/P1)

### S1 — P0.1 Nền tảng

| ID | Role | Paths | Deps | Pri | AC |
| --- | --- | --- | --- | --- | --- |
| `T-COORD-WS` | coordinator | `apps/portal`, `packages/web-session` (hoặc tên chốt), lockfile, CI | — | P0 | Stub Next portal; extract thin web-session (origin/CSRF/cookie factories/post-login); pin exact antd+registry; CI path filter; interim copy-lock chỉ nếu bị chặn (ADR-20 §4). |
| `T-COORD-CTR-M` | coordinator | `packages/contracts`, OpenAPI process | — | P0 | H-M1…H-M4 handoff. |
| `T-BE-MEMBERS` | `backend` | `apps/api`, `packages/backend` | `T-COORD-CTR-M` | P0 | Members/invites list+mutate; RLS/last-Owner; mask email. |
| `T-WEB-FOUND` | `web` | `apps/portal` | `T-COORD-WS` (+ ADR-20) | P0 | AntdRegistry VI; login `ticket-admin-web` PKCE; callback `/api/auth/callback`; host-only cookie; CSRF fail-closed; refresh_token grant gap đóng trên portal BFF; **GATE-STAY-APP** link/report tới `app./gate` trong shell (không Task riêng). |

### S2 — P0.2 Chuẩn bị sự kiện

| ID | Role | Paths | Deps | Pri | AC |
| --- | --- | --- | --- | --- | --- |
| `T-COORD-CTR-T` | coordinator | `packages/contracts` | — | P0 | G-T1 types/sources GET. |
| `T-BE-TYPES` | `backend` | `apps/api`, `packages/backend` | `T-COORD-CTR-T` | P0 | List types/sources cursor. |
| `T-WEB-PREP` | `web` | `apps/portal` | `T-WEB-FOUND`, `T-BE-TYPES`, `T-BE-MEMBERS` | P0 | Một Task: shell overview O12 + events wizard/CRUD + types/quota + content/brand/publish + staff directory. Không UUID tay; publish≠redeem≠Gate. |

### S3 — P0.3 Khách / vé / day-of

| ID | Role | Paths | Deps | Pri | AC |
| --- | --- | --- | --- | --- | --- |
| `T-COORD-CTR-I` | coordinator | `packages/contracts` | — | P0 | H-I1 **implement** CTR multi-step (không cắt sync mất parity) + H-I2. |
| `T-BE-IMPORT-INV` | `backend` | `apps/api`, `apps/worker`, `packages/backend` | `T-COORD-CTR-I` | P0 | Import job + invitations API thật (worker/MinIO); no mock UAT. |
| `T-BE-INV-CLAIM` | `backend` | `apps/api`, `packages/backend` | `T-COORD-CTR-I` | P0 | H-I3 claim trên **app.** |
| `T-WEB-OPS` | `web` | `apps/portal` | `T-WEB-FOUND`, `T-BE-IMPORT-INV` | P0 | Import/invitations UI; **GET pending BFF (G-R2)**; approve/deny; CS/resend; notifications; report; export/recovery. |

### S4 — P0.4 Hardening

| ID | Role | Paths | Deps | Pri | AC |
| --- | --- | --- | --- | --- | --- |
| `T-COORD-CTR-F` | coordinator | `packages/contracts` | — | P0 | G-R1 / G-N1 / G-E1. |
| `T-BE-FILTERS` | `backend` | `apps/api`, `packages/backend` | `T-COORD-CTR-F` | P0 | Filters + exports history. |
| `T-WEB-HARDEN` | `web` | `apps/portal` | `T-WEB-PREP`, `T-WEB-OPS` | P0 | Parity 100% BA matrix; a11y/perf sample; wire filters. |

### S5 — P1.1 Audit / Platform

| ID | Role | Paths | Deps | Pri | AC |
| --- | --- | --- | --- | --- | --- |
| `T-COORD-CTR-A` | coordinator | `packages/contracts` | — | P1 | H-A1/H-C1/H-P1/H-P2 theo ADR-20 §7.1: **không** `audit.read` mới; event audit = `report.read` + event assignment; codes = `inventory.import` masked; platform audit `/v1/platform/audit` Operator MFA; ACR=2. |
| `T-BE-PLATFORM-LIST` | `backend` | `apps/api`, `packages/backend` | `T-COORD-CTR-A` | P1 | `GET /platform/tenants`; MFA operator. (Có thể kéo sớm sau members nếu BE slot trống.) |
| `T-BE-AUDIT-CODES` | `backend` | `apps/api`, `packages/backend` | `T-COORD-CTR-A` | P1 | Event audit GET (`report.read`); codes browse masked (`inventory.import`); platform audit endpoint riêng. **Không** permission migration hàng loạt / role mới. |
| `T-BE-P-HEALTH` | `backend` | `apps/api`, `packages/backend` | `T-COORD-CTR-A` | P1 | Health + grant revoke gaps. |
| `T-WEB-ADV` | `web` | `apps/portal` | `T-WEB-FOUND`, `T-BE-AUDIT-CODES`, `T-BE-PLATFORM-LIST` | P1 | Audit UI + `PLATFORM-PORTAL-ZONE` `/platform` (session Operator tách). |

### S6 — P1.2 Cutover prep local

| ID | Role | Paths | Deps | Pri | AC |
| --- | --- | --- | --- | --- | --- |
| `T-COORD-LOCAL-CUT` | coordinator | docs runbook / realm **local** | ADR-20, P0 DoD | P1 | Keycloak URI portal local; dual-run runbook; rollback trên giấy. **Cấm** DNS/TLS/prod. Không trùng PR #397. |
| `T-WEB-DUALRUN` | `web` | `apps/portal`, `apps/web` (banner tối thiểu) | `T-WEB-HARDEN` | P1 | Banner dual-run; deep-link allowlist; không redirect POST BFF mù. |
| `T-UAT-PORTAL` | `web` | `scripts`, portal UAT artifacts | `T-WEB-DUALRUN` | P1 | Headless portal + regression app./gate; exact SHA. |

### Optional (không tạo Issue trừ gap đo được)

| Trigger | Action |
| --- | --- |
| Nest audience/guard thật sự lệch ADR-20 sau foundation | Task BE riêng — **không** pre-create cancelled |
| Reviewer | Spawn JIT / PR `Chờ duyệt`; Role `reviewer-dod` ± `reviewer-security` |

---

## Gap coverage (BACKEND-GAPS)

| Gap | Task |
| --- | --- |
| H-M1…H-M4 | CTR-M + BE-MEMBERS + WEB-PREP staff |
| G-T1 | CTR-T + BE-TYPES |
| H-I1/H-I2 (multi-step) | CTR-I + BE-IMPORT-INV + WEB-OPS |
| H-I3 | BE-INV-CLAIM |
| G-R2 | WEB-OPS |
| G-R1/G-N1/G-E1 | CTR-F + BE-FILTERS + WEB-HARDEN |
| H-P1/H-P2 | CTR-A + BE-PLATFORM-LIST + BE-P-HEALTH + WEB-ADV |
| H-A1/H-C1 | CTR-A + BE-AUDIT-CODES + WEB-ADV |
| G-D1 multi-event | **OUT** |

---

## Coordinator notes

1. Tạo Story S1…S6 + Tasks từ manifest; link parent Epic #406.
2. Commit docs wave root — worker **không** commit đụng authors khác.
3. Tôn trọng WIP D13 trước feature wave; idle-fill review/fix trước.
4. Integration theo ủy quyền Epic; deploy prod = Task riêng.

## Checks phiên planner

```text
git rev-parse HEAD  # c7e344847b1acf1688302fef513b277fc8f18973
# ADR-20 present docs/ops/ADR-20-PORTAL-ADMIN.md
# Issues #406–#410 exist — S0 not recreated
# Manifest: no T-REV-*, no T-ARCH-ADR, no T-BE-OIDC pre-create
# Import: implement multi-step (not sync cut)
```
