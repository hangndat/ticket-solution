# DoD — PR #365 (UI cleanup debug JSON/HTTP noise)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent Cursor · Orca terminal `term_9e561207-2bb9-46d5-b1e0-e5685b460b91` · task `task_74bd4cf208af` · dispatch `ctx_6f6fe4c7727d` · **≠** implementer |
| Scope | Web (`apps/web`) · PR [#365](https://github.com/hangndat/ticket-solution/pull/365) · UI debug/noise cleanup trên account / auth / redeem / claim / tenant-staff / platform-console (+ gate/admin chrome OIDC) |
| Architecture impact | **Không** — chỉ UX copy / presentation; không đổi API/contracts/RLS |
| Commit SHA (exact) | `217fe11c0b0cef014b62552ac72e444e18dea7bd` |
| Live tip verified | `git rev-parse HEAD` + `gh pr view 365` tip commit = `217fe11c0b0cef014b62552ac72e444e18dea7bd` |
| Ngày review | 2026-10-18 |
| Verdict | **PASS** |

Artifact reviewer (untracked trên worktree DoD — **không** commit lên tip PR để tránh đổi exact SHA đang duyệt). Không merge. Không sửa product code.

---

## Diff đã duyệt (tip commit `217fe11…`)

```text
apps/web/app/account/account-panel.tsx
apps/web/app/admin/page.tsx
apps/web/app/admin/tenant-staff.tsx
apps/web/app/auth/auth-session.tsx
apps/web/app/claim/claim-form.tsx
apps/web/app/gate/page.tsx
apps/web/app/platform/platform-console.tsx
apps/web/app/redeem/redeem-form.tsx
```

Ownership tip commit: **web-only** (không `apps/api`, `apps/mobile`, `packages/*`).

Ghi chú nhánh: `main...HEAD` còn chứa merge docs `docs/reviews/D13-PR354-DOD.md` từ PR #362 — **không** thuộc tip commit UI cleanup; ngoài phạm vi nghiệm thu tip `217fe11…`.

---

## Acceptance đối chiếu

| Hạng mục | Kết quả |
| -------- | ------- |
| Không còn JSON/HTTP dump **mặc định** trên account | **PASS** — `AccountPanel` dùng `SurfaceState` + `<dl>` trạng thái VI; không còn `<pre>{JSON.stringify…}` |
| Auth session | **PASS** — `summarizeMe` + `SurfaceState` (signed-in / signed-out / error); không còn dump HTTP body mặc định |
| Redeem | **PASS** — payload kỹ thuật chỉ trong `<details>` **đóng mặc định** (`Chi tiết kỹ thuật (đóng mặc định)`); placeholder UUID thân thiện |
| Claim | **PASS** — không dump HTTP/JSON response; `termsBody` nằm trong `<details open>` là **nội dung điều khoản** (không phải raw API dump) |
| Tenant-staff | **PASS** — bảng thành viên/lời mời + copy VI lỗi; bỏ `membersJson`/`invitesJson` stringify |
| Platform console | **PASS** — health tóm tắt VI; JSON chỉ trong `<details>` đóng; notice OK qua `noticeOkCopy` thay `JSON.stringify` |
| Gate / admin OIDC chrome | **PASS** — headline VI thân thiện; chuỗi fail-closed / auth state trong `<details>` đóng (giữ smoke/ops) |
| Copy tiếng Việt | **PASS** trên các surface đã đổi |
| Ownership web-only (tip) | **PASS** |
| Không lộ secret | **PASS** — không credential/`.env`/private key trong tip; chỉ tên biến env trong details operator (`PLATFORM_OIDC_*`) |
| Architecture impact | **Không** — đúng |

---

## Checks (exact SHA `217fe11c0b0cef014b62552ac72e444e18dea7bd`)

```text
git rev-parse HEAD
# → 217fe11c0b0cef014b62552ac72e444e18dea7bd

gh pr view 365 --json commits / tip
# → oid 217fe11c0b0cef014b62552ac72e444e18dea7bd

# Static AC scan scoped files: no default-open JSON/HTTP dumps;
# redeem/platform technical JSON only under closed <details>
# Tip commit: no password/api_key/private-key literals

# CRG: list_graph_stats + detect_changes_tool(base=main) trên SHA
# → 8 apps/web files in tip; UX presentation risk; no contract/API paths

# CI GitHub Actions run 39115886953 · headSha=217fe11c0b0cef014b62552ac72e444e18dea7bd
# → job "web": success (completed)
# → job "changes": success
# → shards backend/mobile/database-isolation: skipped (web-only path filter)
# → aggregate "ci" / turbo-persist: still in progress at review time
#   (web job is the substantive gate for this slice)

# Local re-run typecheck/test: SKIP — worktree thiếu node_modules
# Rely on implementer evidence + CI web green:
#   pnpm --filter @ticket/contracts build; apps/web typecheck; apps/web test (207)
```

---

## Findings

### Blocker

Không.

### Should-fix / follow-up (không chặn AC)

1. **Test gap (nit):** helpers mới (`asDeletionCurrent`, `parseMembers`/`parseInvites`, `summarizeHealth`, `summarizeMe`) chưa có unit test riêng — CRG báo gap; hành vi UX-only, suite hiện tại + CI web đủ cho AC cleanup.
2. **Ngoài scope PR:** một số panel admin khác (`admin-form`, `notifications-panel`, `config-brand-panel`) vẫn có `<pre>` / stringify — **không** nằm trong acceptance list PR #365; có thể dọn đợt sau.
3. **Artifact landing:** file này cố ý **không** commit lên tip `217fe11…` (tránh revalidation SHA). Coordinator nên land artifact bằng PR docs riêng sau merge hoặc commit follow-up.

### Nit

- `asDeletionCurrent` giả định body object đơn; nếu API trả mảng yêu cầu, UI sẽ hiện empty (fail-soft) — ngoài claim AC dump cleanup.

---

## Verdict

**PASS** trên exact SHA `217fe11c0b0cef014b62552ac72e444e18dea7bd`.

Revalidation bắt buộc nếu tip PR nhận commit hành vi mới sau SHA này. Coordinator mới được merge sau đủ CI aggregate xanh (khi sẵn sàng) + quyền integration.
