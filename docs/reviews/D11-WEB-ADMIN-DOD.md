# DoD — D11 Web Admin (PR #238 / Issue #229)

## Meta

| Trường | Giá trị |
| ------ | ------- |
| Scope | `apps/web` — workspace admin theo việc, ngữ cảnh, readiness / publish gate |
| Issue | [#229](https://github.com/hangndat/ticket-solution/issues/229) |
| PR | [#238](https://github.com/hangndat/ticket-solution/pull/238) |
| Parent Epic | #228 |
| Ownership | web only |

---

## Lần 1 — FAIL (superseded; không tái dùng)

| Trường | Giá trị |
| ------ | ------- |
| Commit SHA | `8cb02639302cd717ee1460611819aa8ab26400e4` |
| Reviewer | DoD độc lập trước fix (coordinator ghi nhận trên Issue #229) |
| Verdict | **FAIL** |

### Blockers (đã đóng bởi fix `1e48a02…`)

1. `tests/routes.integration.mjs` còn assert copy cũ «Cấu hình sự kiện» → CI `test:routes` đỏ.
2. Publish chưa gắn checklist / `publishReady`.
3. Jargon CSRF / Idempotency / PATCH / `expectedRevision` trên chrome chính.

### Should-fix

- Mật độ form (không blocker DoD lần này).

---

## Lần 2 — Revalidation (exact tip)

| Trường | Giá trị |
| ------ | ------- |
| Commit SHA | `1e48a025955ce75810664d747e5380eb22205362` |
| Reviewer / session | Orca worker `term_b57c7821-3f3b-49de-940c-9a5a5f14f31f` · task `task_71f9a5e25aca` · dispatch `ctx_db2d3deb83ae` · Role `reviewer-dod` (+ skim `reviewer-security`) |
| Independence | ≠ fix implementer `ctx_faf3b6aa1d3d` / `task_9d2349b7894d` |
| Worktree HEAD | Verified `git rev-parse HEAD` == tip trước review |
| Verdict | **PASS with known gap** |

### Đóng blocker prior FAIL (verified, not trusted)

| # | Claim | Evidence trên tip |
| - | ----- | ----------------- |
| 1 | routes không còn assert «Cấu hình sự kiện» | Diff `1e48a02`: assert → `Không gian quản trị sự kiện`, `Chuẩn bị`, `Cổng · báo cáo sự kiện`, `admin-tech-details`. `rg` workspace: **0** hit «Cấu hình sự kiện». CI `test:routes` trên tip: ✔ pass (job web, run bên dưới). |
| 2 | Publish gated by `publishReady` | `config-brand-panel.tsx`: early return + nút disabled khi `!publishReady`; UAT check `publish gated disabled when !publishReady`. `readiness.ts` + `admin-readiness.test.ts` (null capacity = OK). |
| 3 | CSRF / Idempotency / PATCH / expectedRevision → tech disclosure | `<details class="admin-tech-details">` cho create / metadata / publish; UUID Tenant/Event ID trong «Chi tiết kỹ thuật (ID)». |
| 4 | CI xanh trên tip | Run [39055174498](https://github.com/hangndat/ticket-solution/actions/runs/39055174498) · `head_sha=1e48a025955ce75810664d747e5380eb22205362` · conclusion **success** · `test:routes` ✔ · turbo lint/typecheck/test/build web ✔ |
| 5 | Brand UAT known gap documented | `d11-admin-workspace-handoff.json` trên tip: `usedTenantIntercept=true`, live `/me/tenants` **401**, `verdictNote` = PASS with known gap — **không** claim real IdP tenants |

### Checks reviewer chạy / xác nhận

```text
git rev-parse HEAD
# 1e48a025955ce75810664d747e5380eb22205362

pnpm --filter @ticket/web test
# 148 pass / 0 fail (local, tip)

gh api …/actions/runs/39055174498
# conclusion=success, head_sha=1e48a02…
# CI log: test:routes ✔ production routes … (956ms)
```

Headless artifacts (gitignored, present in worktree):

- `apps/web/.uat-artifacts/d11-admin-tenant-a.png`
- `apps/web/.uat-artifacts/d11-admin-tenant-b.png`
- `apps/web/.uat-artifacts/d11-admin-mobile-390.png`
- `apps/web/.uat-artifacts/d11-admin-workspace-handoff.json` (SHA tip, intercept gap explicit)
- `apps/web/.uat-artifacts/handoff.md`

Spot-check: handoff JSON khớp tip SHA; UAT checklist (job nav, tech details, publish gated, ≥2 tenant switch fixture) recorded. Brand switch dựa fixture intercept — **known gap**, không waive thành PASS sạch.

### Security skim (`reviewer-security`)

- Publish gate là UI; copy vẫn ghi backend enforce — không thấy bypass CSRF Origin / double-submit trên BFF admin trong diff.
- Jargon kỹ thuật ẩn UI; mutation path vẫn dùng `expectedRevision` / Idempotency-Key / CSRF qua BFF.
- Không mở mock auth production path trong scope PR.

### Findings

| Severity | Item | Ghi chú |
| -------- | ---- | ------- |
| Known gap (chấp nhận) | Headless brand UAT dùng intercept `/me/tenants` khi live 401 | Gap có chủ đích, ghi trong UAT script + handoff JSON; **không** claim real session tenants. Không phải acceptance bắt buộc “live IdP trong CI”. |
| Nit | Form admin vẫn dày (should-fix từ FAIL cũ) | Không blocker DoD Task #229 |

### Limitations

- Reviewer không re-run Playwright UAT trong session này; dựa artifact tip + CI + source verification.
- Không merge; không đổi Project Status (coordinator).

### Verdict rationale

Prior FAIL blockers trên `8cb0263…` **đã đóng** trên tip `1e48a02…`. CI xanh exact SHA. Acceptance UI/job IA + publish readiness có evidence. Brand multi-tenant headless còn **known gap** intercept — hợp lệ theo spec revalidation → **PASS with known gap**.
