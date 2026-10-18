# DoD review — PR #394 OIDC redirect `vemoki://` (O13 host-independent)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_7e497284-6b91-4ac8-a601-565424b4e129` · dispatch `ctx_b365a7cbcef3` · task `task_a6ec228ef3f3` · worktree `d13-bug-dod-ios` |
| Implementer (≠ reviewer) | Branch `hangndat/d13-bug-ios-oidc` · worktree `d13-bug-ios-oidc` · author `hangndat` |
| Scope | PR [#394](https://github.com/hangndat/ticket-solution/pull/394) · ownership `apps/mobile` only · OIDC redirect / post-logout scheme + prod bake host regression |
| Commit SHA (exact, under review) | `43f28fffd624f2bdfd73ed17991397d1441fd510` |
| Agent | `cursor` (orca-agent-routing) |
| Architecture impact | Không — constants/scheme alignment + unit regression; không đổi contract OpenAPI / BE |
| Decision IDs áp dụng | O13 (web apex vs `app.vemoki.com` không ảnh hưởng custom-scheme OIDC) — không đụng O02 / PD §6.1 chrome |
| Ngày review | 2026-10-18 |

## Checklist

| # | AC | Result |
| --- | --- | --- |
| 1 | Một ownership slice `apps/mobile` | **PASS** — 8 files, tất cả dưới `apps/mobile/**`; không đụng `apps/api` / `apps/web` |
| 2 | Login OIDC dùng brand `vemoki://oauth/callback` (khớp post-logout) | **PASS** — `OIDC_REDIRECT_SCHEME = PRIMARY_APP_SCHEME` (`vemoki`); `oidc-login` `makeRedirectUri({ scheme: OIDC_REDIRECT_SCHEME, path: 'oauth/callback' })`; `OIDC_POST_LOGOUT_URI = vemoki://oauth/logout` thay hardcode rời |
| 3 | Dual scheme vẫn đăng ký (legacy deep links) | **PASS** — `APP_SCHEMES` + Expo `scheme: ['vemoki', 'ticketsolution']` giữ cả hai |
| 4 | Issuer / privacy không phụ thuộc apex vs `app.vemoki.com` (O13) | **PASS** — tests `prod-public-hosts.test.ts` + privacy URL asserts; bake issuer vẫn `https://auth.vemoki.com/realms/ticket` |
| 5 | Không secrets / EAS Cloud Build | **PASS** — không `.env` / credential; diff không thêm cloud build |
| 6 | Unit + CI trên exact SHA | **PASS** — local 220/220; CI run `39130086441` `head_sha` = tip · `mobile`/`changes`/`ci` SUCCESS |
| 7 | Device / live IdP smoke | **PASS with known gap** — PR đánh dấu optional; reviewer không chạy device sign-in/out; Keycloak allowlist là claim trong PR/commit (không probe IdP trong session này) |

## Checks (trên exact SHA `43f28fffd624f2bdfd73ed17991397d1441fd510`)

| Check | Result |
| --- | --- |
| `git rev-parse` (implementer worktree) | `43f28fffd624f2bdfd73ed17991397d1441fd510` = PR #394 tip / CI `headSha` |
| Diff ownership | `README.md`, `app.config.ts`, `+native-intent.ts`, `app-schemes.ts` (+test), `oidc-login.ts`, `prod-public-hosts.test.ts`, `privacy-policy.test.ts` |
| Secrets | Không `.env` / signing material / credential thật |
| `pnpm --filter @ticket/mobile test` @ tip worktree | **220 pass / 0 fail** (duration ~15.3s) |
| CI | [39130086441](https://github.com/hangndat/ticket-solution/actions/runs/39130086441) · `head_sha` = `43f28ff…` · `mobile` SUCCESS · `changes` SUCCESS · `ci` SUCCESS · `turbo-persist` SUCCESS · backend/web/db/d5-* SKIPPED (hợp lệ) |
| EAS Cloud Build | Không dùng |
| O02 / PD §6.1 chrome | N/A — không đụng tabs / SiteNav / guest↔staff IA |
| Device OIDC smoke | Không chạy (gap ghi rõ) |

### Code review (tóm tắt)

- **Trước (main):** login `ticketsolution` vs logout hardcode `vemoki://oauth/logout` — lệch scheme.
- **Sau:** login + logout cùng brand `vemoki`; export `OIDC_POST_LOGOUT_URI`; regression đảm bảo custom scheme không chứa với `vemoki.com` / `app.vemoki.com`.
- `+native-intent` comment cập nhật: null keep auth session cho `vemoki://oauth/callback` (+ legacy).
- Expo vẫn đăng ký dual scheme → deep link legacy không bị gỡ đăng ký app-side.

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận được theo PR) | Không có device sign-in/out smoke trên SHA này; headless/sim không thay device deep-link OIDC nếu AC cứng yêu cầu sau này. |
| Known gap / limitation | Keycloak `ticket-mobile` allowlist `vemoki://oauth/callback` không được reviewer xác minh lại trên IdP — dựa claim PR. Sai allowlist → login fail ngoài unit. |
| Should-fix (process, không blocker DoD scheme) | PR checklist khuyến nghị `reviewer-security` cho OIDC redirect URI — dispatch này chỉ `reviewer-dod`. Coordinator có thể spawn security riêng trước merge nếu coi slice nhạy cảm bắt buộc. |
| Nit | Comment trong `app-schemes.ts` nói legacy callback «remains registered for dual-run» — đúng ở Expo schemes; runtime login path chỉ còn brand scheme (đúng mục tiêu PR). |

Không blocker ownership / secrets / EAS / CI đỏ / unit fail / lệch login↔logout scheme trên tip.

## Verdict

**PASS with known gap**

- Gap có chủ đích / môi trường: thiếu device OIDC smoke; IdP allowlist không probe trong session DoD; security review riêng chưa chạy (khuyến nghị PR, ngoài scope dispatch này).
- Đủ DoD Task cho ownership iOS: căn `vemoki://` login với post-logout, dual scheme giữ, O13 host-independence tests, unit 220 + CI xanh trên exact SHA `43f28fffd624f2bdfd73ed17991397d1441fd510`.
- Reviewer độc lập implementer (terminal/dispatch khác worktree `d13-bug-ios-oidc`).
- Merge PR #394 / Project `Hoàn thành` → **coordinator** (reviewer không merge, không đóng Issue). Nếu policy yêu cầu security gate cho OIDC URI → chờ `reviewer-security` trước Hoàn thành.

## Revalidation

Commit hành vi mới sau SHA `43f28fffd624f2bdfd73ed17991397d1441fd510` → bắt buộc DoD lại trên SHA mới; artifact docs-only không kế thừa PASS hành vi.
