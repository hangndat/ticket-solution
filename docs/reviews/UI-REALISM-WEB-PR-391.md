# DoD Review — PR #391 (UI realism web)

**PR:** https://github.com/hangndat/ticket-solution/pull/391  
**Branch:** `hangndat/ui-realism-web` → `main`  
**Reviewer / session:** Cursor DoD reviewer độc lập · Role `reviewer-dod` · Orca terminal `term_83e88bbc-6d8e-4467-b55f-550b5b6daf94` · dispatch `ctx_be2c15545a15` · task `task_700fb8e55316` (≠ implementer)  
**Ngày review:** 2026-10-18  
**Phạm vi chỉnh sửa reviewer:** chỉ `docs/reviews/UI-REALISM-WEB-PR-391.md` — **không** sửa product code, **không** merge.

## Exact SHA đối chiếu

| Vai trò | SHA (full) | Xác minh |
| --- | --- | --- |
| **Commit đang duyệt (tip PR)** | `1c7eb3cc8de484ac47c70e6fa327a83249af27be` | `git rev-parse HEAD` trong worktree = SHA tip; message `fix(web): realism auth UX, media contain, drop demo chrome` |
| Implementer | hangndat | Khác session reviewer |

> Mọi commit hành vi mới sau SHA này → bắt buộc DoD lại. Artifact docs-only không đổi verdict pin trên `1c7eb3cc8de484ac47c70e6fa327a83249af27be`.

## Phạm vi ownership

Commit `1c7eb3cc` — **11 files, chỉ `apps/web/**`:**

- `apps/web/app/auth/auth-session.tsx`
- `apps/web/app/auth/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx`
- `apps/web/src/nav/capabilities.ts`
- `apps/web/src/published/copy.ts`
- `apps/web/src/ui/event-media.tsx`
- `apps/web/tests/nav-capabilities.test.ts`
- `apps/web/tests/nav-sec-cache.test.ts`

Không đụng `apps/api`, `apps/mobile`, `packages/backend`.

**Architecture impact:** Không — UX/CSS/copy surface; không đổi contract/API/authz server.

## Checklist DoD (task)

| # | Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| 1 | Không copy user-facing «Kiểm tra phiên» / HttpOnly / localStorage lecture trên `/auth` | **PASS** | `AuthSession` auto-resolve trên mount; CTA signed-in (Đổi mã / Tài khoản / trang chủ / Đăng xuất). Residual «Kiểm tra phiên» chỉ trong comment code giải thích đã bỏ; HttpOnly/`localStorage` còn ở BFF/README (dev docs), không phải chrome khách |
| 2 | Nav đã login dùng «Tài khoản», không «Đăng nhập» | **PASS** | `buildNavLinks` bỏ `/auth` khi `authenticated`; `nav-capabilities.test.ts` assert `!hrefs.includes('/auth')` + có `/account` |
| 3 | Không demo notice / footer «Demo mang nhãn rõ» / double ` · Demo` eyebrow | **PASS** | Footer → `Đổi mã lấy vé · Cổng kiểm soát vé`; meta layout bỏ «Nội dung demo…»; home eyebrow chỉ `organizationName`; `demoLabel` / notice copy xóa khỏi `PUBLIC_EVENT_COPY` + event detail; CSS `.demo-label` gỡ |
| 4 | Banner/logo crop fix (`object-fit: contain`) | **PASS** | `.event-banner`, `-card`, `-hero`, `.event-logo`, `.poster-media .event-banner-hero` → `contain`; alt bỏ từ «demo» |
| 5 | Web-only ownership | **PASS** | `git show --name-only` = 11 paths dưới `apps/web/` |

## Checks đã chạy / đối chiếu (SHA `1c7eb3cc8de484ac47c70e6fa327a83249af27be`)

```bash
git rev-parse HEAD
# 1c7eb3cc8de484ac47c70e6fa327a83249af27be

git show --stat 1c7eb3cc8de484ac47c70e6fa327a83249af27be
# 11 files, apps/web only

# CI (exact headSha)
# https://github.com/hangndat/ticket-solution/actions/runs/39129459503
# headSha = 1c7eb3cc8de484ac47c70e6fa327a83249af27be
# conclusion = success
# jobs: changes=success, web=success, ci=success, turbo-persist=success
# (backend/mobile/database-isolation/d5-* skipped — paths-filter web-only)

# Local worktree: pnpm --filter @ticket/web test — không chạy được
# (node_modules thiếu trong worktree reviewer). Evidence unit/typecheck
# lấy từ job `web` xanh trên exact SHA ở run trên.
```

**code-review-graph:** `detect_changes_tool` base `HEAD~1` — 11 files, risk ~0.55; test gaps AuthSession/Home (không blocker AC copy/CSS/nav đã cover bằng source + nav unit test trên CI).

## Findings

| Mức | Finding |
| --- | --- |
| — | Không blocker |
| Nit | `AuthSession` / `summarizeMe` chưa có unit test riêng (CRG test gap); chấp nhận cho slice UX này vì AC chính đã cover bằng source + nav test |
| Limitation | Reviewer không chạy headless visual UAT crop/contain trên trình duyệt; xác minh bằng CSS + CI web. Gap không nuốt AC task (code-level contain + demo chrome removal) |

## Verdict

**PASS**

Coordinator có thể merge sau khi đủ quy trình integration (CI đã xanh trên exact SHA). Reviewer **không** merge.
