# DoD review — PR #177 / Issue #145 (D9 iOS UX)

| Trường | Giá trị |
| --- | --- |
| **Verdict** | **PASS with known gap** |
| Reviewer / session | Cursor DoD (Orca) · terminal `term_d075bc8f-aa7a-4463-b0b0-fb91d390952e` · task `task_6519b710b26a` · dispatch `ctx_8a3b5316b0ee` · **≠** implementer session |
| Scope | Issue [#145](https://github.com/hangndat/ticket-solution/issues/145) · PR [#177](https://github.com/hangndat/ticket-solution/pull/177) · ownership `apps/mobile` (+ `docs/reviews` evidence) |
| Commit SHA đã duyệt | `c49d2a168b7e66afe98b0d4564bf0e64df2221be` |
| Ngày | 2026-10-17 |
| Revalidation | Bắt buộc nếu có commit hành vi mới sau SHA trên |

## Checklist DoD

| Tiêu chí | Kết quả |
| --- | --- |
| Một ownership slice (không trộn BE+web+iOS) | PASS — chỉ `apps/mobile` + docs/reviews UAT |
| Không secrets / `.env` / credential thật | PASS |
| Exact SHA under review khớp tip PR | PASS — tip = `c49d2a168b7e66afe98b0d4564bf0e64df2221be` |
| CI xanh trên SHA | PASS — job `mobile` / `ci` / `changes` / `turbo-persist` green ([run 39016434179](https://github.com/hangndat/ticket-solution/actions/runs/39016434179)); BE/web/D5 jobs skipping (đúng path filter) |
| Acceptance #145: empty/error/loading polish ví/scan/events | PASS — shared `LoadingState` / `EmptyState` / `ErrorState` + VI copy; wire `my-tickets`, `staff`, `events`, `event-detail` |
| Fail-closed misconfig / không mock vé | PASS — Events `ErrorState` “Chưa cấu hình API”; ví giữ OIDC fail-closed; scan idle copy “Chỉ cho vào sau khi API…” |
| Không EAS Cloud Build; UAT headless | PASS — evidence `docs/reviews/d9-ios-ux-polish-uat.md` + screenshots sim-uat |
| Reviewer độc lập ≠ implementer | PASS — session Orca DoD này |
| Merge / self-merge | N/A — reviewer không merge |

## Checks đã chạy (trên SHA)

```bash
git rev-parse c49d2a168b7e66afe98b0d4564bf0e64df2221be
# → c49d2a168b7e66afe98b0d4564bf0e64df2221be

# Local (detached at SHA): apps/mobile pnpm test → fail 0
# (gồm screen-state-copy.test.ts)

# Local typecheck/lint: node_modules thiếu trong worktree DoD → không tái chạy;
# tin CI mobile job xanh trên cùng SHA (typecheck + lint + test trong Actions).

gh pr checks 177  # mobile/ci/changes/turbo-persist = pass
```

## Findings

### Không blocking

1. **Copy tests only** — `screen-state-copy.test.ts` assert VI strings; không có RN renderer test cho panel wiring. Chấp nhận được cho D9 polish; CI suite mobile vẫn xanh.
2. **Retry không đều** — `VerifiedWallet` + events list có `onRetry`; offline wallet error và event-detail error/misconfig chưa có retry CTA. UX nhỏ, không phá fail-closed.
3. **Screenshot ví** (`d9-uat/ios/d9-my-tickets.png`) — chứng minh OIDC fail-closed (`Chưa cấu hình OIDC`), không phải empty wallet sau sign-in. Khớp known gap dưới đây.

### Known gaps (có chủ đích — không FAIL)

- Ví signed-in empty/loading và scan busy/`checking` cần OIDC + API live — chưa chứng minh trong sim-uat session này (đã ghi trong UAT notes).
- Simulator + Expo Go only — không TestFlight / thiết bị thật; không EAS.
- D9 polish ≠ pilot ready / store submission.

## Diff review (tóm tắt)

- `screen-state.tsx` / `screen-state-copy.ts`: panel dùng chung; `ErrorState` dùng `Notice tone="deny"` (API `tone` đã có sẵn).
- Screens: thay bare `ActivityIndicator` bằng `LoadingState`; empty/error nhất quán; staff idle `EmptyState` + disable input khi `!ready`.
- `package.json` test glob thêm `src/components/*.test.ts`.
- Không đụng BE/web; không đổi authz/check-in business logic ngoài copy + chrome UI.

## Verdict

**PASS with known gap** trên exact SHA `c49d2a168b7e66afe98b0d4564bf0e64df2221be`.

Coordinator có thể merge sau khi xác nhận CI vẫn xanh trên tip; **không** tái dùng verdict nếu tip đổi hành vi.
