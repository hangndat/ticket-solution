# VD-10 — Consumer + portal violet primary (review)

**Ngày:** 25/10/2026 · **Reviewer:** Mira (`reviewer-uiux`, dispatch độc lập) · **Implementer (commits):** hangndat · **Worktree:** `vd09-marketing-neon` · **Bỏ qua:** `apps/mobile` (Zico)

## Scope / phiên bản

| Trường | Giá trị |
| --- | --- |
| Exact SHA | `e8eeb584ba4438f215c68741c4fa66e031555088` |
| Diff reviewed | `5b800bda..e8eeb584` (web consumer, `packages/ui`, portal theme, `brand/vemoki/tokens.json`) |
| Product decision | Primary **solid** `#7C4DED` trên web consumer + portal; đỏ chỉ semantic error/deny/destructive; marketing neon **không** đổi palette |

### Commits trong diff

| SHA | Mô tả |
| --- | --- |
| `757a7813` | Brand `colors.primary`, UI regen, `attendeePrimary` + consumer accents violet |
| `cb70fceb` / `c5f48603` | Portal default tenant `#7C4DED` + evidence stamp |
| `64fe91e4` | Portal loading spinner `--vemoki-primary` |
| `e8eeb584` | Docs evidence SHA loading fix |

## Checks / evidence

| Check | Lệnh / công cụ | Kết quả |
| --- | --- | --- |
| UI tokens | `pnpm --filter @ticket/ui test` @ SHA trên | PASS |
| Web unit/integration | `pnpm --filter @ticket/web test` | PASS |
| Portal theme | `pnpm --filter @ticket/portal test` (gồm `vemoki-theme.test.ts`) | PASS |
| Web prod build | `pnpm --filter @ticket/web build` | PASS |
| Portal prod build | `pnpm --filter @ticket/portal build` | PASS |
| Grep signal accent (consumer) | `rg 'text-signal\|bg-signal\|border-signal' apps/web/app apps/web/src` (exclude marketing) | **0** consumer match |
| Grep `#E11D48` portal chrome | `apps/portal` CSS/TSX consumers of `var(--vemoki-signal)` | **none**; hex chỉ trong `VEMOKI_COLORS.signal` |
| Reviewer Playwright @ prod :3000 | `node docs/reviews/assets/vd10-violet-review/capture-reviewer.mjs` | 20 viewport shots + ticket/QR |
| Color probes | Playwright computed styles (`probes.json`) | Redeem primary `#7C4DED`; marketing `--color-signal` `#e11d48`; validation `#8a1f1f` |
| Evidence integrity | `bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/vd10-violet-review` | OK (30 file) |

### Viewport matrix (reviewer @ `pnpm --filter @ticket/web start`)

| Surface | 1440 | 390 | Ghi chú |
| --- | --- | --- | --- |
| Home / catalog | `home-*.png` | ✓ | CTA `attendeePrimary` violet |
| Redeem | `redeem-*.png` | ✓ | Primary `#7C4DED` (sửa báo lỗi user «Tiếp tục» đỏ) |
| Event detail | `event-detail-*.png` | ✓ | `/t/mfest-demo/events/mfest` |
| Wallet | `wallet-*.png` | ✓ | |
| Ticket / QR | `ticket-qr-*.png` | ✓ | `/t/uat-device/tickets/97f77680-…` (thiếu trong script implementer) |
| Claim / invite | `claim-*.png`, `invite-*.png` | ✓ | |
| Account | `account-*.png` | ✓ | Chụp trạng thái chưa đăng nhập local (avatar signed-in không có session) |
| 404 | `not-found-*.png` | ✓ | |
| Marketing neon | `marketing-neon-*.png` | ✓ | `--color-signal` vẫn đỏ; gradient CTA neon |

### Portal (theme + shell)

| Surface | File | Ghi chú |
| --- | --- | --- |
| Loading spinner | `portal-loading-spinner-390.png` | Violet ring `@ e8eeb584` |
| Event config / onboarding | `portal-event-config-*.png`, `portal-onboarding-*.png` | Từ `apps/portal/tests/evidence-vd10` @ cùng SHA (mock BFF); reviewer xác nhận test + spinner độc lập |
| Auth | `portal-auth-390.png` | Prod :3013 |
| Design system | `portal-design-system-*.png` | Prod :3013 |

Artifact: `docs/reviews/assets/vd10-violet-review/` (`manifest.json`, `probes.json`, `capture-reviewer.mjs`).

## Grep — `signal` / đỏ còn lại (có chủ đích)

| Vùng | Còn `#E11D48` / `signal` class? | Lý do |
| --- | --- | --- |
| `brand/vemoki/tokens.json` `colors.signal` | Có | Marketing Live Pulse |
| `packages/ui/src/generated/*` `--color-signal` | Có | Marketing + `packages/ui/src/marketing/**` |
| `apps/web/src/marketing/**` | Có (`text-signal`, gradients) | **Không đổi** trong diff violet |
| `apps/web` consumer routes | Không class `*-signal` | Primary qua `--color-primary` / `attendeePrimary` |
| `apps/portal` product chrome | Không dùng `--vemoki-signal` | `colorPrimary` + tenant default `#7C4DED` |
| `packages/ui` primitives (catalog, chips, buttons) | `primary` / `text-primary`, không `signal` | Đúng product violet |

**Lưu ý naming:** `apps/web/src/branding/vemoki.ts` gán `colors.signal` và `--signal` consumer default = `#7C4DED` (cùng primary). Marketing override `--color-signal` trên `data-surface='marketing'`. Không phát hiện consumer UI dùng `text-signal` sau đổi.

## Findings

| ID | Loại | Mức | Vấn đề | Tác động | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| VD10-V-01 | `token/naming` | **Thấp** | Consumer default map `signal` → violet trong khi `tokens.json` giữ `signal` đỏ cho marketing | Dễ nhầm khi thêm `color-mix(signal)` trên attendee; hiện không có class consumer `*-signal` | Doc ADR hoặc đổi tên field consumer (`primary` only) — optional |
| VD10-V-02 | `evidence` | **Thấp** | `apps/web/tests/vd10-violet-evidence.mjs` không chụp ticket/QR | Gap coverage implementer | Reviewer đã bổ sung `ticket-qr-*.png` |
| VD10-V-03 | `evidence` | **Thấp** | Marketing full-page SHA khác giữa các lần chụp (animation/time) | Không chứng minh pixel-diff tự động | **Code** marketing không đổi trong diff; runtime probe `--color-signal` = `#e11d48` |

Không finding chặn: redeem «Tiếp tục» đỏ, portal primary đỏ, marketing bị violet hóa nhầm, hay validation mất đỏ semantic.

### Hover / focus / disabled (code + spot check)

- `attendeePrimary` / `primary`: solid `bg-primary`, hover/active `color-mix(primary, ink)`, focus ring `ring-focus` 3px, `disabled:opacity-50` (`packages/ui/src/primitives/variants.ts`).
- Destructive / form errors: `text-destructive` / `border-destructive` (`#8A1F1F` family); probe redeem validation `#8a1f1f`.

## Limitations

- Account signed-in avatar ring: không có OIDC session trong capture local.
- Portal event/onboarding PNG copy từ evidence packet commit (mock server); reviewer không chạy `capture-screenshots.mjs` (Playwright chromium bundle thiếu; web capture dùng `channel: 'chrome'`).
- Không đo WCAG automated trên toàn bộ state; dựa trên token + visual spot check.

## Verdict

**PASS** — SHA `e8eeb584ba4438f215c68741c4fa66e031555088` đáp ứng product decision violet solid trên consumer + portal, giữ marketing neon đỏ và semantic destructive đỏ; findings VD10-V-01..03 mức thấp, không chặn merge.
