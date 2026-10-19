# PROD launch UAT — case B06 (attendee portal)

| Trường | Giá trị |
| --- | --- |
| Case | **B06** — Attendee login portal (P0, browser) |
| Runner | Sora · uat (`task_845d71b46819`) |
| Môi trường | `https://portal.vemoki.com` |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` |
| Catalog SHA-256 | `21de2cf233878c918c53661da253d0956c41171fbce23a5612183214cfef4b1a` |
| Repo `HEAD` | `979483083f5f1d44f01d012b48b0bd2fb30b5ffb` (`hangndat/d1-leader`) |
| Orca browser | Tab mới `browserPageId` `63d682ef-ae5b-4481-b392-10115c28569a` (không dùng phiên staff) |
| Persona | `attendee@example.com` / `attendee-demo` (catalog demo) |

## Verdict

**FAIL**

Attendee đăng nhập portal thành công và được đưa vào **shell quản trị** (onboarding Owner), gắn tenant **UAT Device Tenant** — không bị từ chối và không về bề mặt khách.

## Kỳ vọng (catalog)

Không vào shell Owner; từ chối hoặc về bề mặt khách.

## Quan sát (sau OIDC)

| Trường | Giá trị |
| --- | --- |
| URL cuối | `https://portal.vemoki.com/onboarding/a1111111-1111-4111-8111-111111111111` |
| Document title | `Vemoki Portal` |
| Tenant (copy UI) | **UAT Device Tenant** — «Organization UAT Device Tenant is ACTIVE. Complete the steps below — do not paste UUIDs.» |
| Shell admin | Có: header «Vemoki Portal», combobox Organization / Events, menu «Account ▾», breadcrumb «Portal», wizard «First-run setup» (Organization profile → Team → First event → Ready), form «Save organization profile» |

Không thấy màn từ chối kiểu «Sign-in required» / «Sign in as staff» sau khi đã có session attendee.

## Các bước Orca (tóm tắt)

1. `orca tab create --url https://portal.vemoki.com --worktree path:/Users/admin/orca/workspaces/main/mola`
2. `goto https://portal.vemoki.com/api/auth/login` → Keycloak `ticket-admin-web`
3. Điền form Keycloak (`#username` / `#password`) và `requestSubmit()` (agent-browser `fill`/`click` không ghi DOM trên theme KC này)
4. Redirect về portal → onboarding URL trên

## Screenshot

| File | Mô tả |
| --- | --- |
| `apps/web/.uat-artifacts/prod-launch-2026-10-19/b06-portal-result.png` | Shell onboarding UAT Device Tenant sau login attendee |
| `apps/web/.uat-artifacts/prod-launch-2026-10-19/b06-keycloak-attempt.png` | Keycloak trước khi chỉnh cách submit (tham khảo) |

## Giới hạn

- Không đổi membership, Keycloak, hay dữ liệu prod.
- Không commit / push evidence.
