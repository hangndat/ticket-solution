# D11 — DoD revalidation · Web khách attendee claim fix (PR #243 / #234)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_21a236f0-3b3b-4af7-b784-deda294a7875` · Task `task_c06c9f1e6560` · Dispatch `ctx_9bdbf0970b1e` · **≠** fix implementer `ctx_c190c52aa187` |
| Scope | PR [#243](https://github.com/hangndat/ticket-solution/pull/243) · Issue [#234](https://github.com/hangndat/ticket-solution/issues/234) · ownership **`apps/web` only** · revalidation sau FAIL `docs/reviews/D11-PR-243-WEB-ATTENDEE-DOD.md` (SHA `808f8c5…`) |
| Commit SHA | `8cb4891ba60423bce79fe3a6a9f04b5c443151b9` (exact tip `gh pr view 243` / CI run head) |
| Prior FAIL | OIDC/C-I jargon trên claim chrome + UAT `/claim` → `error.tsx` |
| Architecture impact | **Không** — claim chrome snapshot + VI copy; không đổi OpenAPI/contracts/authz/RLS |
| Merge | **Không** — reviewer không merge |

## Revalidation checklist (từ FAIL trước)

| Mục | Kết luận |
| --- | --- |
| `claim-form.tsx` plain VI (không OIDC/C-I trên chrome mặc định) | **Met** — tip gồm `abc2b11` (copy VI) + `8cb4891` (ổn định snapshot, bỏ `<details>` JSON debug). Chrome: «Đăng nhập bằng đúng email…», CTA «Đăng nhập rồi quay lại nhận lời mời», empty «Chưa có mã lời mời». Source scan tip: không `OIDC` / `C-I` / `C-F` / `Guest claim` / `Keycloak` trong claim page/form. |
| Headless UAT `/claim` → form/empty, không `error.tsx` | **Met** — artifact worktree fix `d11-web-attendee-243-fix` @ SHA tip: `apps/web/.uat-artifacts/d11-234-claim.png` (03:24, 1280×1445). Visual: chrome claim VI + empty-token `SurfaceState`, **không** «Không tải được trang này.» |
| CI web xanh trên tip mới | **Met** — [run 39062355303](https://github.com/hangndat/ticket-solution/actions/runs/39062355303) `head_sha=8cb4891ba60423bce79fe3a6a9f04b5c443151b9` · `web`+`ci`+`changes`+`turbo-persist` success; BE/mobile/DB skipped (path filter). `test` 151 pass / 0 fail; `test:routes` 1 pass (assert claim HTML plain VI + không error boundary string). |
| Reviewer độc lập ≠ implementer trên exact SHA mới | **Met** — session/dispatch này ≠ `ctx_c190c52aa187` |

## Root cause đã đóng (verify source)

`useSyncExternalStore` `getSnapshot` trước đây trả object mới mỗi lần → vòng lặp `Object.is` → route `error.tsx`. Tip cache `cachedLocationSnapshot` + `EMPTY_LOCATION` ổn định; `dynamic = 'force-dynamic'` trên `claim/page.tsx`.

## AC còn lại (kế thừa PASS từ review `808f8c5` + tip)

| AC / gate | Kết luận |
| --- | --- |
| Guest home / event demo / brand ≥2 tenant | **Met** (prior + không regress claim-only tip) |
| AC-A1…A4 redeem messages / FORM_VERSION_STALE | **Met** — CI unit vẫn xanh trên tip |
| Auth/BFF fail-closed; không mock auth production | **Met** |
| Claim copy VI dễ hiểu | **Met** (blocker đóng) |
| Real-app headless UAT claim surface | **Met** (blocker đóng) |

## Findings

### Blocker

Không còn.

### Known gap (chấp nhận cho Task này — không nuốt gate claim)

1. **Chưa redeem live authenticated trên IdP thật** — evidence vẫn fail-closed + unit AC-A1/A2/A4 + headless claim empty chrome. Gap đã ghi trên PR body / prior should-fix; **không** tuyên bố pilot / redeem E2E IdP. Coordinator có thể merge sau khi đủ gate integration riêng; gap này không reopen FAIL claim.

### Nit

2. UAT full suite (home/redeem/auth/brand) vẫn là PNG ~02:09 trên worktree cũ; tip chỉ re-chụp claim. Không chặn — claim là surface FAIL trước đây; home/redeem/auth không đổi hành vi trên `8cb4891`.

## Security / authz (nhẹ)

Không đổi auth contract/RLS; fail-closed OIDC unconfigured giữ; bỏ debug JSON intent khỏi guest chrome là cải thiện. Không yêu cầu `reviewer-security` riêng.

## Verdict rationale

Hai blocker FAIL trước (jargon OIDC/C-I + UAT claim → error boundary) đã đóng trên exact SHA `8cb4891…` với CI web xanh và screenshot claim VI. AC claim/revalidation checklist đủ. **PASS with known gap** (live IdP redeem). Reviewer **không merge**.
