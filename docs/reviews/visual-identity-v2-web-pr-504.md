# DoD Review — PR #504 (Visual Identity v2 · Live Pulse web #488)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Orca `reviewer-dod` (Cursor), terminal `term_e3ab9562-e6ed-4da1-9512-1154cea5825c`, dispatch `ctx_29cebea89652`, task `task_b2c3ecc69d41` — **độc lập ≠ implementer** |
| Role | `reviewer-dod` · [`docs/agents/roles/reviewer-dod.md`](../agents/roles/reviewer-dod.md) |
| Scope | PR [#504](https://github.com/hangndat/ticket-solution/pull/504) · Issue [#488](https://github.com/hangndat/ticket-solution/issues/488) · Epic [#486](https://github.com/hangndat/ticket-solution/issues/486) · ownership `apps/web` |
| Commit SHA | `15eb341e9cf35dcc40c6242fa4c2a81cfcc72aec` (`git rev-parse` trên worktree `pr-504-review`) |
| Architecture impact | **Không** (consume brand tokens; không đổi contract BE / OIDC) |
| Verdict | **PASS** |

## Exact SHA

```text
15eb341e9cf35dcc40c6242fa4c2a81cfcc72aec
feat(web): apply Live Pulse v2 tokens and Sora display font
```

## Scope (paths trên SHA)

- `apps/web/app/globals.css` — Live Pulse hex + derived mixes
- `apps/web/app/layout.tsx` — `next/font/local` Sora display + Be Vietnam Pro body
- `apps/web/fonts/Sora-Variable.ttf` (+ `OFL-Sora.txt`, README); remove Syne
- `apps/web/src/branding/vemoki.ts`, `css-vars.ts`
- `apps/web/src/brand-mark.tsx`, `owner-ticket/ticket-qr.tsx`
- `apps/web/tests/branding-theme.test.ts`

Không đụng `apps/api`, `apps/mobile`, Portal, Gate redesign, `/auth` product UI.

## Checklist DoD (task + Issue #488)

| Gate | Kết quả | Evidence |
| ---- | ------- | -------- |
| Tokens khớp `brand/vemoki/tokens.json` Live Pulse | **PASS** | `:root` + `VEMOKI_BRANDING` = ink `#0B1220`, paper `#F4F6F8`, signal `#E11D48`, focus `#2563EB`; không còn terracotta v1 `#9b3a18` / cream `#f7f6f1` / ink `#22241f` trên surface token |
| Sora loaded (display) | **PASS** | `layout.tsx` `localFont` → `../fonts/Sora-Variable.ttf` → `--font-display`; file TrueType present; CSS fallback `Sora`; body vẫn Be Vietnam Pro |
| Home vs marketing layout visibly different | **PASS** | Home: `SiteNav` + `main.container.home` / `home-hero`. Marketing: `MarketingChrome` + `data-testid="marketing-surface"` + `.mkt-*`, ẩn product footer. UAT PNG so sánh first viewport |
| `/auth` vẫn thin redirect | **PASS** | `apps/web/app/auth/route.ts` không đổi trong PR; headless `auth-smoke` → HTTP **307** → `/?notice=auth_unavailable` (OIDC local unset) / prod pattern login khi có return; không product auth shell |
| Tests | **PASS** | Local `pnpm --filter @ticket/web test` → **249 pass / 0 fail** sau `pnpm --filter @ticket/contracts build`; `branding-theme.test.ts` 7/7 Live Pulse asserts |
| UAT headless | **PASS** | Reviewer re-ran trên exact SHA (local `next start :3048` sau `pnpm --filter @ticket/web build`). Artifacts dưới `docs/reviews/visual-identity-v2-web-pr-504-uat/` |
| CI xanh trên exact SHA | **PASS** | Actions run [`39153312453`](https://github.com/hangndat/ticket-solution/actions/runs/39153312453) — jobs `web` + `ci` **success** (mobile/backend/portal/d5/database-isolation skipped path filter) |
| Ownership slice | **PASS** | Diff chỉ `apps/web/**` |
| Secrets | **PASS** | Không `.env` / credential |

### Decision / handoff IDs

| ID | Áp dụng |
| -- | ------- |
| PD visual-identity-v2 (#487) | Tokens + type Sora / Be Vietnam Pro + freeze 5 priority screens |
| AC-S1 / UX revamp | `/auth` redirect mỏng — giữ nguyên |

## Checks (lệnh trên SHA)

| Check | Kết quả |
| ----- | ------- |
| `git rev-parse HEAD` | `15eb341e9cf35dcc40c6242fa4c2a81cfcc72aec` |
| `pnpm --filter @ticket/contracts build && pnpm --filter @ticket/web test` | 249 pass |
| `pnpm --filter @ticket/web build` | success (route table includes `/auth`, `/marketing`, `/`) |
| `./scripts/web-uat.sh auth-smoke http://127.0.0.1:3048` | ok · authStatus 307 · no auth-session shell · login CTA `/api/auth/login?return=/` |
| `./scripts/web-uat.sh screenshot http://127.0.0.1:3048/ …/home.png` | ok |
| `./scripts/web-uat.sh screenshot http://127.0.0.1:3048/marketing …/marketing-vi.png` | ok |
| `./scripts/web-uat.sh screenshot http://127.0.0.1:3048/redeem …/redeem.png` | ok |
| CI `head_sha=15eb341…` | `web` + `ci` success |

### UAT artifacts (reviewer, exact SHA)

| File | Nội dung quan sát |
| ---- | ----------------- |
| [`visual-identity-v2-web-pr-504-uat/home.png`](./visual-identity-v2-web-pr-504-uat/home.png) | Brand hero-level + headline + support + CTA; primary fill signal đỏ; paper cool; SiteNav product |
| [`visual-identity-v2-web-pr-504-uat/marketing-vi.png`](./visual-identity-v2-web-pr-504-uat/marketing-vi.png) | Sales chrome (VI\|EN, demo/interest); hero + visual plane; CTA signal; khác Home |
| [`visual-identity-v2-web-pr-504-uat/redeem.png`](./visual-identity-v2-web-pr-504-uat/redeem.png) | Product redeem chrome + signal CTA; không redesign `/auth` |

**Limitation môi trường UAT:** local không có BFF/OIDC → Home catalog `unreachable` + redeem “Cần đăng nhập / auth_unavailable”. Đây là fail-closed env, **không** regression brand token.

**CTA signal:** `.button` dùng `background: var(--brand)`; root layout `brandingToCssVars(VEMOKI_BRANDING)` set `--brand` = `primaryColor` `#E11D48` trên `<html>` (ghi đè `:root --brand: var(--ink)`). Screenshot Home/redeem xác nhận primary đỏ signal. Marketing `.mkt-btn-primary` dùng `var(--signal)` trực tiếp.

## Findings

### Blocker

Không có.

### Should-fix (không chặn PASS)

1. **CSS chết / demo cũ trong `globals.css`:** `.poster { background: #b7491d; … }` vẫn terracotta-ish — ngoài 5 priority screens; nên dọn ở PR hygiene sau, không block Live Pulse token gate.
2. **`:root --brand: var(--ink)` vs runtime `--brand` = signal:** dễ confuse khi đọc CSS không kèm `layout.tsx`; nên comment hoặc đồng bộ default với `tokens.json` primary (nit).

### Nit

- Marketing vẫn có demo badge trong hero (pre-existing O13) — không do PR này invent palette.

## Limitations

- Graph MCP `detect_changes` trong worktree reviewer báo HEAD lệch `141dba…` (daemon graph path); review dựa trên `git` + source + CI + headless UAT trên SHA tip.
- Không chạy full `test:routes` integration server suite ngoài auth-smoke (đã cover `/auth` 307).
- Không regenerate raster OG/favicon (OUT PD freeze / ticket follow-up).

## Verdict

**PASS** trên exact SHA `15eb341e9cf35dcc40c6242fa4c2a81cfcc72aec`.

Coordinator có thể merge khi CI vẫn xanh; release worktree sau merge. Mọi commit hành vi mới sau SHA này → **revalidation DoD bắt buộc**.
