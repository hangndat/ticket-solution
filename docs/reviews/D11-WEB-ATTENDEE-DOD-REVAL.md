# DoD revalidation — D11-S4-T1 Web khách (Issue #234 / PR #243)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Orca `term_5f40e5a7-93e4-41aa-9769-c4274d457b22` · task `task_4d7b16ca5da9` · dispatch `ctx_a8f559d4606c` · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Agent cursor |
| Independence | ≠ implementer `ctx_6756ef543c9b` / `ctx_b30eba237c63` · ≠ prior FAIL reviewer `ctx_fe695bb695c4` |
| Scope | Issue #234 · PR #243 (merged) · `apps/web` claim/redeem/home · Architecture impact: Không |
| Commit SHA (PR tip) | `8cb4891ba60423bce79fe3a6a9f04b5c443151b9` |
| Squash merge on `main` | `9daf4d2ed79fa594a0ec87aaeb323921fc5d0952` |
| Prior FAIL (không kế thừa) | `808f8c5e9e2d66a91280375902a76edfa0e76f3f` — claim-form còn jargon OIDC/C-I/C-F |
| Verdict | **PASS** |

## Checklist

### 1. claim-form guest copy: không OIDC / C-I / C-F / Keycloak jargon

**PASS.** Blob tại tip SHA:

- `apps/web/app/claim/claim-form.tsx` — chrome VI plain: «Đăng nhập bằng đúng email đã được mời…»; labels «Đường dẫn tổ chức/sự kiện», «Mã lời mời»; CTA «Nhận lời mời» / «Đăng nhập rồi quay lại nhận lời mời». `rg` guest-facing: **0** match `OIDC|Keycloak|C-I|C-F|Guest claim`.
- `apps/web/app/claim/page.tsx` — title/intro VI plain; **0** match jargon trên tip (metadata không còn «Keycloak»).
- Chỉ còn path nội bộ `/api/bff/claim` (không render cho guest copy).

Fix chuỗi: `abc2b11` (plain VI claim) → `8cb4891` (stabilize + assert).

### 2. Commit `8cb4891` (stabilize claim chrome) không phá AC VI

**PASS.** Diff tip chỉ:

- Cache `useSyncExternalStore` snapshot (`EMPTY_LOCATION` + `sameClaimLocation`) — tránh infinite-loop → `error.tsx`.
- Gỡ `<details>` debug intent JSON khỏi guest chrome.
- `routes.integration.mjs` assert HTML claim: có «Nhận lời mời sự kiện» / «Chưa có mã lời mời» / «Đăng nhập rồi quay lại nhận lời mời»; **không** có `OIDC`, `C-I`, `C-F`, `Guest claim`, `Keycloak`, «Không tải được trang này».

Guest copy VI từ `abc2b11` được giữ; không tái đưa jargon.

### 3. CI web xanh trên PR tip trước merge

**PASS (ghi nhận check-runs, không re-run full CI).**

| Check | Conclusion | `head_sha` |
| ----- | ---------- | ---------- |
| `web` | **success** | `8cb4891ba60423bce79fe3a6a9f04b5c443151b9` |
| `ci` | **success** | same |
| `changes` | **success** | same |
| `turbo-persist` | **success** | same |

- Workflow: [CI run 39062355303](https://github.com/hangndat/ticket-solution/actions/runs/39062355303) · `conclusion=success` · `head_sha=8cb4891…`
- PR #243 `headRefOid` khớp tip; merge squash `9daf4d2…`.

## Spot-check home / redeem (scope)

- Home tip: hero VI plain, CTA «Đổi mã lấy vé», DEMO surfaces rõ — không OIDC/Keycloak trong guest chrome.
- Redeem tip: intro VI plain («Đổi mã lấy vé…»). Comment code `OIDC`/`BFF` trong module server không render guest.

## Findings

- Không blocker / should-fix cho guest claim jargon trên tip.
- Nit (ngoài AC revalidation): worktree local HEAD `e8512d00…` trên branch worker **không** trùng tip — review neo blob `git show 8cb4891:…` / merge `9daf4d2`, không neo working tree stale.
- Prior FAIL artifact `docs/reviews/D11-WEB-ATTENDEE-DOD.md` không có trên `main` (chỉ Issue comment); revalidation này là artifact PASS độc lập.

## Limitations

- Không chạy lại full `pnpm --filter @ticket/web test` locally — dựa CI `web` success exact tip SHA + blob/integration assertions.
- Không UAT headless lại trong session này (CI routes.integration đã assert claim HTML trên tip).
- Không merge/revert; không đổi Project Status (coordinator).

## Verdict

**PASS** — revalidation trên exact SHA `8cb4891ba60423bce79fe3a6a9f04b5c443151b9` (merge `9daf4d2…`). Prior FAIL trên `808f8c5…` không kế thừa.
