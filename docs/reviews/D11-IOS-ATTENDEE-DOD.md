# DoD review — D11-B3 Attendee iOS (#235 / PR #248)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_e4120204-dcb0-4dfc-a2f5-27839694bba6` · dispatch `ctx_4d9277542fc3` · task `task_f604cc9264ac` · worktree `d11-review-ios-248` |
| Implementer (≠ reviewer) | dispatch `ctx_5e9d0638d489` |
| Scope | Issue [#235](https://github.com/hangndat/ticket-solution/issues/235) · PR [#248](https://github.com/hangndat/ticket-solution/pull/248) · Story [#233](https://github.com/hangndat/ticket-solution/issues/233) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership `apps/mobile` only |
| Commit SHA (exact, under review) | `13f790f9a447bebeaeaa38a7002fff670566dc29` |
| Feature code SHA | `0c0eb7cccc29a466566df8a4b2295d680ce3613f` (tip docs-only pins UAT tip → `b5c285f…`) |
| Agent | `cursor` (orca-agent-routing) |
| Architecture impact | Không |
| Ngày review | 2026-10-18 |

## Checklist

| # | AC | Result |
| --- | --- | --- |
| 1 | D11-B3: events / redeem / claim / ví / QR copy VI rõ | **PASS** — `presentRedeemDecision` / `presentTicketRow` / `attendeeWalletCopy` + screen wiring; unit `attendee-outcome-copy.test.ts`; stack titles VI; guest chrome bỏ Nest/BFF/Keycloak trên ví/signed-out path đã cấu hình |
| 2 | Brand-test ≥2 demo tenants + logout clear brand | **PASS with known gap** — `demo-fun` / `demo-studio` + «Đổi tổ chức demo»; logout `clearCachedBranding` + `ThemeProvider` reset on signed-out |
| 3 | Không EAS Cloud Build; sim-uat evidence path | **PASS** — diff không gọi EAS Cloud; UAT ghi `scripts/sim-uat.sh` → `apps/mobile/.uat-artifacts/d11-b3/` |
| 4 | Unit / typecheck evidence trên SHA; CI khi có | **PASS** — unit 195/195 trên tip; CI mobile + changes + ci **success** trên tip |

## Checks (trên exact SHA `13f790f9…`)

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` | `13f790f9a447bebeaeaa38a7002fff670566dc29` = PR #248 `head.sha` (REST) |
| Diff ownership | 17 files: `apps/mobile/**` + `docs/reviews/D11-IOS-ATTENDEE-UAT.md` — không đụng `apps/api` / `apps/web` |
| Secrets | Không `.env` / credential / signing material |
| `cd apps/mobile && pnpm test` | **195 pass / 0 fail** (node `--experimental-strip-types --test`, gồm `src/attendee/*.test.ts`) |
| `pnpm typecheck` / `pnpm lint` (local worktree) | **Không chạy được** — worktree thiếu `node_modules` / types; **bù bằng CI `mobile` SUCCESS** trên cùng SHA |
| CI | Run [39057207587](https://github.com/hangndat/ticket-solution/actions/runs/39057207587) · `head_sha` = tip · `ci` SUCCESS · `mobile` SUCCESS · `changes` SUCCESS · `turbo-persist` SUCCESS · backend/web/db/d5-* SKIPPED (hợp lệ) |
| EAS Cloud Build | Không dùng trong diff / handoff |
| Headless UAT path | `docs/reviews/D11-IOS-ATTENDEE-UAT.md` · artifacts (gitignored) tại implementer worktree `d11-ios-attendee-235`: `ios-tenant-demo-fun.png`, `ios-tenant-demo-studio.png`, `ios-redeem.png`, `ios-wallet.png` |

### Spot-check branding / copy (PNG implementer)

| Surface | Quan sát reviewer |
| --- | --- |
| Events demo-fun | `Tổ chức: demo-fun` · wordmark/org vẫn **Vemoki** trên first paint (gap) · VI copy rõ · «Đổi tổ chức demo» |
| Events demo-studio | Wordmark/org **Demo Studio Organization** · `Tổ chức: demo-studio · Demo Studio Organization` — khác rõ demo-fun |
| Redeem | Title «Đổi mã» / «Đổi mã lấy vé»; không Nest/BFF trên chrome |
| Wallet (Expo Go, OIDC off) | Tab «Vé của tôi»; embed `AccountScreen` «Chưa cấu hình OIDC» còn nhắc Keycloak — môi trường UAT không OIDC, không phải path SignedOutWallet đã làm sạch |

### Code review (logout / brand)

- `wallet-logout.ts`: `clearCachedBranding` theo `id:` / `slug:` sau session logout (S-P0-C).
- `ThemeProvider`: `resetToDefault` + subscribe → reset khi `signed-out` / `unknown`.
- `events.tsx`: switch tenant apply `primaryColor` + `organizationName` từ demo catalog.

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận được) | First-paint `demo-fun` trong PNG vẫn org **Vemoki**; sau «Đổi tổ chức demo» → `demo-studio` brand rõ. Khớp pattern D8 (wordmark fallback) — **không** nuốt AC ≥2 tenant phân biệt. |
| Known gap (chấp nhận được) | Sim-uat không OIDC → ví hiện `AccountScreen` copy còn «Keycloak»; path ví khi OIDC configured đã bỏ Keycloak khỏi chrome khách. |
| Limitation (scope) | Simulator + Expo Go ≠ device UAT; ≠ pilot / store. |
| Nit | UAT artifact tip trong `D11-IOS-ATTENDEE-UAT.md` trỏ `b5c285f…` (docs pin), trong khi PR tip review là `13f790f…` (docs-only sync) — hành vi feature vẫn `0c0eb7c…`. |
| Nit | Tab native title «Events» / «My Tickets» (Expo Go) vẫn EN — ngoài stack titles đã VI trong `_layout.tsx`. |

Không blocker ownership / secrets / EAS / thiếu ≥2 tenant / thiếu headless path / CI đỏ / thiếu unit trên SHA.

## Verdict

**PASS with known gap**

- Gap có chủ đích / môi trường: first-paint Vemoki trên demo-fun; Keycloak trong OIDC-misconfigured AccountScreen khi sim không cấu hình OIDC; Simulator ≠ device.
- Đủ DoD Task #235 / PR #248 cho ownership iOS attendee (copy VI, brand-test ≥2, không EAS, unit+CI trên exact SHA, sim-uat path + PNG spot-check).
- Reviewer độc lập implementer (`ctx_5e9d0638d489` ≠ `ctx_4d9277542fc3`).
- Merge PR #248 / Project `Hoàn thành` → **coordinator** (reviewer không merge, không đóng Issue).

## Revalidation

Commit hành vi mới sau SHA `13f790f9a447bebeaeaa38a7002fff670566dc29` → bắt buộc DoD lại; commit docs-only (artifact DoD này) không kế thừa như PASS hành vi nếu có thay đổi product code.
