# DoD — PR #248 / Issue #235 (D11-S4-T2 iOS khách)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | `reviewer-dod` · Orca Dispatch `ctx_439e1bba2523` · terminal `term_10492183-a757-4abc-a023-b4e6e492239b` · **≠** implementer |
| Scope | Issue [#235](https://github.com/hangndat/ticket-solution/issues/235) · PR [#248](https://github.com/hangndat/ticket-solution/pull/248) · ownership `apps/mobile` (+ `docs/reviews/D11-IOS-ATTENDEE-UAT.md`) |
| Commit SHA | `13f790f9a447bebeaeaa38a7002fff670566dc29` (exact tip `gh api …/pulls/248`) |
| Architecture impact | Không (UX/copy/brand chrome; không đổi contract/API/Keychain/QR payload) |
| Verdict | **FAIL** |
| Merge | **Không** (task DoD; chờ fix + revalidation SHA mới) |

## Checks trên SHA

| Check | Kết quả |
| --- | --- |
| CI GitHub `ci` / `mobile` / `changes` / `turbo-persist` | **success** trên tip |
| `cd apps/mobile && pnpm test` (worktree tip) | **195 pass** / 0 fail |
| `pnpm typecheck` + `pnpm lint` (worktree tip) | **pass** |
| Ownership diff vs `origin/main` | Chỉ `apps/mobile/**` + 1 file UAT docs — **OK** |
| Auth / Keychain / QR payload / offline redeem | Không đổi protocol; logout thêm `clearCachedBranding` — **OK (không nới auth)** |
| Headless sim-uat artifacts | Có tại implementer WT: `apps/mobile/.uat-artifacts/d11-b3/` (`ios-tenant-demo-fun.png`, `ios-tenant-demo-studio.png`, `ios-redeem.png`, `ios-wallet.png`) |
| Local Expo prebuild + `xcodebuild` Team `BLUA62D52G` | **Thiếu evidence** trên tip / PR / UAT doc |

## AC verification

| AC (Issue #235 / S-P0-C) | Kết luận |
| --- | --- |
| Events / redeem / claim / ví / ticket layout + copy VI; không giả vé | **Met (code + unit)** — `presentRedeemDecision` / `presentTicketRow`; pending/unknown/auth assertive; unit cover |
| Giữ QR / cache / offline display semantics; không offline redeem | **Met** trong diff |
| ≥2 tenant brand-test + switch/logout clear | **Not met (evidence)** — xem blocker #2 |
| Sim-uat headless artifacts | **Met** (artifacts local; Simulator ≠ device — known limit) |
| Local Xcode build Team `BLUA62D52G` | **Not met** — Issue AC bắt buộc; không có log/command excerpt |
| Không EAS Cloud / không token-Keychain-auth contract | **Met** |
| `reviewer-dod` exact SHA | **Met** (artifact này) |

## Findings

### Blocker (trước merge / Hoàn thành)

1. **Thiếu local iOS build evidence** — Issue #235 yêu cầu `Sim-uat headless + local Xcode build Team BLUA62D52G`. PR/UAT/handoff không có lệnh `expo prebuild` / `xcodebuild` / excerpt `BUILD SUCCEEDED` / `DEVELOPMENT_TEAM=BLUA62D52G` trên tip (mẫu: `docs/reviews/D8-S4-T2-IOS-BUILD.md`). Cần evidence rồi revalidation.

2. **Brand-test S-P0-C chưa đạt theo artifact** — UAT claim `demo-fun` → Demo FUN Collective / `#245B47`, nhưng `ios-tenant-demo-fun.png` vẫn wordmark/org **Vemoki** (`Tổ chức: demo-fun · Vemoki`). `ios-tenant-demo-studio.png` đổi được sang Demo Studio Organization (switch có hiệu lực một phần). CTA Events vẫn dùng static `colors.accent` (không `theme.signal`) — chrome primary không phản ánh tenant. Nguyên nhân khả dĩ: `ThemeProvider` `session.subscribe` reset `defaultThemeTokens()` trên `signed-out`/`unknown` đè `applyBranding` demo khi guest. Sửa + chụp lại sim-uat trên SHA mới; đừng claim brand-test PASS từ doc cũ.

### Should-fix

3. **Guest chrome Keycloak còn lộ khi OIDC chưa cấu hình** — `MyTicketsScreen` render `AccountScreen` khi `!isOidcConfigured()`; copy Account vẫn nhắc Keycloak (`ios-wallet.png`). Handoff nói bỏ Keycloak khỏi chrome khách — nốt surface này hoặc plain VI.

4. **UAT tip SHA trong doc** ghi `b5c285f…` (feature `0c0eb7c…`) trong khi tip PR là `13f790f…` (docs-only sync). Hành vi không đổi giữa docs commits — ghi rõ tip đang duyệt khi revalidation.

### Nit / known limits (không chặn nếu blocker xong)

- `TicketSummary` không có `eventName` — tên từ demo catalog khi khớp `eventId` (đã ghi handoff).
- Simulator ≠ device UAT; ≠ store; ≠ pilot ready.
- Graph `code-review-graph-ticket` stale vs tip — đã đối chiếu source.

## Revalidation

Sau fix: tip SHA mới → CI mobile xanh → sim-uat brand ≥2 tenant (crop vẫn nhận org) → local prebuild/xcodebuild Team `BLUA62D52G` evidence → DoD lại trên exact SHA mới. **Không** kế thừa verdict này.
