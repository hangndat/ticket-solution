# DoD review — Web P0 production feel (PR #443)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_c28077b6-1cb2-4402-815f-f56b8629828e` · Task `task_55adc87a9cf6` · Dispatch `ctx_72e4891b8067` · **≠** implementer |
| Scope | PR [#443](https://github.com/hangndat/ticket-solution/pull/443) · ownership **`apps/web` only** · PD [`PD-PRODUCTION-WEB-HANDOFF.md`](../design/production-web-review/PD-PRODUCTION-WEB-HANDOFF.md) §4.1 P0 + §5 trust/a11y (guest chrome) · BA sync vocabulary `production-web-review/` |
| Commit SHA | `877a8a156ce04759b2c01909164adad45d275371` (exact tip PR + worktree `git rev-parse HEAD`) |
| Architecture impact | **Không** — UI/copy/CSS guest chrome; không OpenAPI/contracts/authz/RLS |
| Constraints | Artifact only — **không merge** trong Task này |

## Changed paths (PR tip — 5 files)

```text
apps/web/app/auth/auth-session.tsx
apps/web/app/globals.css
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx
```

Ownership slice sạch: không BE / mobile / lockfile / contracts.

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `877a8a156ce04759b2c01909164adad45d275371` |
| CI run [39133640733](https://github.com/hangndat/ticket-solution/actions/runs/39133640733) | **success** trên `headSha` = tip — jobs `web` + `ci` + `changes` + `turbo-persist` xanh; BE/mobile/DB skipped (path filter) |
| Source / diff review | `git show 877a8a1` + DOM-string search trên tree tip |
| Headless screenshot UAT | **Không chạy** trong session review (PR/PD ghi optional) — không chặn P0 string/CSS/CI gates bên dưới |

## Checklist PD §4.1 (P0-1 … P0-6)

| # | Gate | Kết luận | Evidence |
| --- | --- | --- | --- |
| P0-1 | Không aside happy-path «Danh sách từ máy chủ» | **Met** | Aside removed từ `page.tsx` ready path; `rg 'Danh sách từ máy chủ' apps/web` → absent. Remaining «máy chủ» chỉ error/loading/admin/redeem support — không guest ready catalog |
| P0-2 | Footer + meta guest bỏ «Cổng kiểm soát vé» | **Met** | Footer → `Sự kiện & vé`; meta description guest-facing (vé/sự kiện/lời mời). `rg 'Cổng kiểm soát' apps/web` → absent trên product chrome |
| P0-3 | Home cards banner `object-fit: cover` | **Met** | `.event-banner-card` / `.home-featured-banner` → `cover` + center; logo vẫn `contain` |
| P0-4 | Event hero full-width atmosphere (`cover`) | **Met** | `hero hero-atmosphere` + media trước copy; `.event-banner-hero` / `.poster-media` cover; `poster-preserve` opt-in contain giữ §3.3 |
| P0-5 | Auth: không H2 «Thao tác»; bỏ SurfaceState empty trùng | **Met** | Signed-out/signed-in: không `<h2>`; empty `SurfaceState` dưới CTA removed; `data-testid` chuyển lên wrapper; loading/error SurfaceState giữ |
| P0-6 | Home hierarchy: bớt wordmark-hero vs H1; cover above-the-fold | **Met** | `HeroWordmark` gỡ khỏi home; H1 + intro + CTA; `home-featured` cover band khi catalog ≥1 |

## Checklist bổ sung (Task Spec)

| Gate | Kết luận | Evidence |
| --- | --- | --- |
| `metadataBase` / OG không localhost mặc định | **Met** | `layout.tsx`: `configuredPublicOrigin() ?? 'https://app.vemoki.com'` → `metadataBase`. (Live `og:image` curl trên prod deploy ngoài scope PR tip — code path không còn fallback request-host localhost cho metadata base.) |
| Web-only | **Met** | 5 files `apps/web/**` |
| Brand tokens giữ (O09 ink/paper/signal, Syne / Be Vietnam) | **Met** | Diff CSS thêm hierarchy/cover/nav control; không đổi palette tokens; fonts display/body giữ |
| CI web xanh trên SHA | **Met** | Run 39133640733 · `web` success · tip SHA khớp |
| PD §5 trust (guest ops chrome) | **Met** | Happy path hết copy máy chủ/cổng; auth không console empty panel; focus/hit-target rules không bị gỡ trong diff |
| Decision IDs | N/A O02 chrome permission | Slice visual guest feel; không đổi nav capability / staff tab gating |

## Findings

### Blocker

Không có.

### Should-fix / known gap (không nuốt AC P0)

1. **Headless screenshot UAT chưa gắn tip** — PD §4.4 mục 3 / BA §6.2 khuyến nghị screenshot 1280×800; PR đánh dấu optional. String + CSS + CI đủ cho P0 checklist Task này. Follow-up: `scripts/web-uat.sh` → `apps/web/.uat-artifacts/` cite SHA nếu đóng Epic polish.

2. **P1 nav outline** (Đăng nhập / Tài khoản min 44×44) có trong `globals.css` — vượt P0; không regression.

### Nit

3. Featured event #1 hiện cả `home-featured` và lại trong `event-list` — khớp wireframe PD §3.1 (cover band + list); chấp nhận.

## Verdict

**PASS** trên exact SHA `877a8a156ce04759b2c01909164adad45d275371`.

Coordinator: có thể merge sau khi được ủy quyền integration; Task reviewer **không merge**. Revalidation bắt buộc nếu tip đổi hành vi sau review này.
