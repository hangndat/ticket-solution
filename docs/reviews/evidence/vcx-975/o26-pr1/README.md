# UAT evidence — O26-PR1 (#975)

**SHA:** `132e93ebf641223b240cf25b7ac31d1e2284cf40`  
**Build:** `apps/portal/.next/BUILD_ID` = `oKrZEAOer5DOU_9r7u7xb`  
**Origin:** `http://uat975.localhost:3017` (runtime `.local-dev/portal975/portal.env`, không commit)  
**API:** `127.0.0.1:3542` read-only  
**Browser:** Orca embedded tab `98a6008c-0b45-425b-8bd6-30df6d186268`  
**Driver:** `apps/portal/.uat-artifacts/vcx975/o26-pr1-foundation-uat.mjs`

## Viewport matrix (sau mỗi `goto`: `tab switch` → `set viewport` → assert `innerWidth`/`innerHeight`)

| Surface | 390×844 | 1024×900 | 1440×900 |
| --- | --- | --- | --- |
| Landing (`/`) | `landing-390x844.png` | `landing-1024x900.png` | `landing-1440x900.png` |
| Auth (`/api/auth/login`) | `auth-390x844.png` | `auth-1024x900.png` | `auth-1440x900.png` |
| Owner events | `owner-events-390x844.png` | `owner-events-1024x900.png` | `owner-events-1440x900.png` |

Unauthenticated flows redirect tới Keycloak (`ticket-admin-web-vcx975-uat975`). Owner: `owner.fixture@example.com` + TOTP (helper vcx932-noah / vcx-926 totp file, không log secret).

## Layout probe (`uat-results.json`)

- Auth/landing: `overflowX: false` tại cả 3 viewport.
- Owner events @ 390×844: `overflowX: true` (`scrollWidth` 618) — **Pro table / page chrome hiện có**, không claim fix trong PR1 foundation.
- 1024 / 1440 owner: `overflowX: false`.

**Migration #975 chưa đóng** — chỉ foundation `ConfigProvider` mặc định + gỡ theme root.
