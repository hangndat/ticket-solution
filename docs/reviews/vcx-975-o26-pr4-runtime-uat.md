# O26-PR4 — UAT runtime Owner (#983)

**Code SHA:** `02522b5ab86e87e2696ab1b400e177781fa57851` · **tip tích hợp khi chạy:** `595dcd8e`
**Stack:** Portal `uat975pr4.localhost:3023`, OIDC client riêng `ticket-admin-web-vcx975-uat975pr4`, API `127.0.0.1:3542` chỉ đọc. Orca browser; không mutate DB/#928.

## Kết quả

| Check | Verdict |
| --- | --- |
| Owner OIDC + BFF `/me/tenants` | **PASS** |
| Tenant home ready @ 390×844, 1024×900, 1440×900 | **PASS** — shell/context, `Statistic`, event list, capability CTA; không `PortalPage` cũ/React crash |
| Onboarding first-run `/onboarding/{tenantId}` @ 390×844, 1024×900, 1440×900 | **PASS** — `Steps` và form hiển thị, không tràn ngang/React crash |
| Signup `/onboarding` @ 390×844, 1024×900, 1440×900 | **PASS** — user Keycloak test riêng không có tenant; Card/form/copy PENDING hiển thị, không tràn ngang; không submit đăng ký |
| Tenant home loading/error/403/PENDING; onboarding pending/denied/error | **GAP** — fixture Owner ACTIVE chỉ cho ready/first-run; parity khác dựa code review + tests, chưa có runtime bằng chứng mới |

Kết quả máy: [tenant home và first-run](evidence/vcx-975/o26-pr4/uat-pr4-02522b5a.json), [signup](evidence/vcx-975/o26-pr4/uat-signup-02522b5a.json). Screenshot của chín viewport giữ gitignored tại `apps/portal/.uat-artifacts/vcx975-pr4/`. Tab Orca đã đóng sau run. Không gửi email, không chạy lại camera/offline. User signup chỉ ở Keycloak test realm; không ghi tenant vào DB.

Giới hạn: đây là UAT cho O26-PR4 batch 1, chưa hoàn tất #975 hoặc Epic #914.
