# D11 — DoD review · Web khách attendee (PR #243 / #234)

| Trường | Giá trị |
| --- | --- |
| Verdict | **FAIL** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_3a54fb42-4893-4ae8-8559-6e085c674351` · Task `task_77f1e0d52029` · Dispatch `ctx_77ac9d173457` · **≠** implementer (branch `hangndat/d11-web-attendee-234`) |
| Scope | PR [#243](https://github.com/hangndat/ticket-solution/pull/243) · Issue [#234](https://github.com/hangndat/ticket-solution/issues/234) (D11-S4-T1 / B2-web-home+redeem) · ownership **`apps/web` only** · không đụng PR #250 |
| Commit SHA | `808f8c5e9e2d66a91280375902a76edfa0e76f3f` (exact tip `gh api …/pulls/243` · = worktree HEAD) |
| Source verify | `/Users/admin/orca/workspaces/ticket-solution/d11-web-attendee-234` (read/verify only) |
| Architecture impact | **Không** — copy/chrome/UX guest; không đổi OpenAPI/contracts/authz/RLS |
| Graph | `code-review-graph-ticket` stale vs tip → **source + tests + CI + UAT artifacts thắng** |

## Changed paths (PR tip — 14 files)

```text
apps/web/app/auth/auth-session.tsx
apps/web/app/auth/page.tsx
apps/web/app/claim/page.tsx
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/app/redeem/page.tsx
apps/web/app/redeem/redeem-form.tsx
apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx
apps/web/src/redeem/form-fields.tsx
apps/web/src/redeem/messages.ts
apps/web/src/site-chrome.tsx
apps/web/tests/redeem-messages.test.ts
apps/web/tests/redeem-poll.test.ts
apps/web/tests/routes.integration.mjs
```

Không đụng BE / mobile / lockfile / contracts. Ownership slice sạch.

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `gh api …/pulls/243 --jq .head.sha` | `808f8c5e9e2d66a91280375902a76edfa0e76f3f` |
| CI run [39057401787](https://github.com/hangndat/ticket-solution/actions/runs/39057401787) | **success** — jobs `web` + `ci` + `changes` + `turbo-persist` xanh; BE/mobile/DB skipped (đúng path filter) |
| `pnpm --filter @ticket/web test` (cwd worktree tip) | **151 pass** / 0 fail (gồm AC-A2/A3/A4 unit) |
| Headless UAT artifacts (worktree, gitignored) | Có: `d11-234-{home,redeem,auth,claim,brand-sunburst,brand-northline}.png` — **chụp ~02:09** trước tip fix `808f8c5` (~02:16); tip chỉ sửa `routes.integration.mjs` |
| Visual review screenshots | Home / redeem fail-closed / auth fail-closed / brand Sunburst≠Northline: **OK**. Claim: **error.tsx** (không phải chrome claim) |

## AC verification

| AC / gate | Kết luận |
| --- | --- |
| Guest home: plain VI, Demo nhãn rõ, CTA Đổi mã, bỏ Invite thành viên (PD guest IA) | **Met** — `page.tsx` + `site-chrome` guest = Đổi mã · Nhận lời mời · Đăng nhập; UAT home OK |
| Event demo label «Không dùng vào cổng» + ≥2 tenant brand (S-P0-C) | **Met** — event page copy + routes assert; UAT Sunburst vs Northline khác org/theme |
| AC-A1 Issued → thẻ vé (không Nest/BFF trên chrome chính) | **Met (code/unit)** — `redeem-ticket-card`; jargon Nest/BFF/Keycloak gỡ khỏi home/redeem/auth production HTML; `details` «Chi tiết kỹ thuật» giữ idempotency (progressive disclosure — OK) |
| AC-A2 Unknown → không vé giả + «Kiểm tra lại» | **Met** — `unknownMessage` + UI CTA; unit `unknown outcome never claims a ticket` |
| AC-A3 Auth thiếu → «Cần đăng nhập» | **Met** — redeem/auth fail-closed; routes assert; UAT redeem/auth |
| AC-A4 `FORM_VERSION_STALE` → soft-reload + clear answers/terms (không silent accept) | **Met** — `applyDecision` stale branch + `loadSchema` clears consent; unit FORM_VERSION_STALE copy |
| Claim copy VI dễ hiểu / hết jargon khách | **Not met** — `claim/page.tsx` intro sạch, nhưng `claim-form.tsx` (không sửa trong PR) vẫn chrome: «Guest claim (C-I): đăng nhập OIDC verified…» |
| Real-app headless UAT | **Partial** — home/redeem/auth/brand OK; **claim artifact = `app/error.tsx`**; chưa redeem live có login (giới hạn đã ghi — không đủ thay claim chrome broken evidence) |
| Auth/BFF thật; không mock auth production | **Met** trong diff — fail-closed unconfigured; không invent session |
| CI trên tip | **Met** |

## Findings

### Blocker (trước merge / Hoàn thành)

1. **Claim guest vẫn jargon OIDC/C-I trên chrome** — `apps/web/app/claim/claim-form.tsx` (~lớp intro form): «Guest claim (C-I): đăng nhập OIDC verified đúng email…». PD §1.1: handoff Keycloak/OIDC/schema không lên chrome khách; Issue #234 gồm claim. Sửa copy plain VI (và nút «Đăng nhập rồi quay lại claim» → VI thân thiện hơn) → commit mới → **revalidation DoD bắt buộc**.

2. **UAT claim không chứng minh surface** — `d11-234-claim.png` là error boundary («Không tải được trang này.» / «Lỗi tải giao diện»), không phải form/claim chrome. Chụp lại headless `/claim` trên tip `808f8c5…` (hoặc SHA fix sau blocker 1) tới khi thấy intro + empty-token state.

### Should-fix (không chặn nếu coordinator chấp nhận sau khi hết blocker)

3. **UAT artifacts timestamp trước tip** — PNG ~02:09; tip CI-fix 02:16 chỉ đụng test routes. Sau fix claim: re-run bộ screenshot gắn exact SHA trong handoff.

4. **Chưa redeem live authenticated** — evidence fail-closed + unit AC-A1/A2/A4; live issued card trên IdP thật vẫn thiếu. Chấp nhận cho Task này **chỉ sau** khi blocker claim đóng; không tuyên bố pilot/redeem E2E.

### Nit

5. Auth `details` dev vẫn nhắc `docker compose … keycloak` khi `NODE_ENV !== 'production'` — routes đã assert production HTML không chứa `Keycloak`; OK.

## Security / authz (nhẹ — không phải slice security-primary)

| Quan sát | |
| --- | --- |
| Fail-closed OIDC unconfigured | Giữ — không mock user |
| CSRF / idempotency | Không nới; stale clear consent đúng hướng |
| Scope | Chỉ UI copy/state guest |

Không spawn `reviewer-security` riêng: PR không đổi auth contract/RLS.

## Verdict rationale

Home/redeem/auth/brand + CI tip **đạt**. Claim (trong cùng Issue) còn jargon khách + UAT claim hỏng → **FAIL**. Không merge từ reviewer. Sau fix + screenshot claim + CI xanh trên SHA mới → revalidation DoD.

## Revalidation checklist (SHA mới)

- [ ] `claim-form.tsx` plain VI (không OIDC/C-I trên chrome mặc định)
- [ ] `./scripts/web-uat.sh screenshot …/claim` → form/empty state, không `error.tsx`
- [ ] CI web xanh trên tip mới
- [ ] Reviewer độc lập ≠ implementer trên exact SHA mới
