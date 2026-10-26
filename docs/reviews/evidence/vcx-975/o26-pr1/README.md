# UAT evidence — O26-PR1 (#975)

**Phạm vi PR1 (incremental):** gỡ `ConfigProvider` theme + module `theme/vemoki*` + root inline vars; **không** claim dissolution toàn bộ `globals.css` / Pro shell (PR2–PR11).

**F-975-ROOT-01:** chỉ xóa declaration phụ thuộc `--vemoki` trong `globals.css` — **không** thay literal palette antd. Helpers layout `.portal-*` giữ structural tạm.

**F-975-ROOT-02:** bỏ `next/font` Be Vietnam Pro trên `layout.tsx`; loading UI → `Spin` antd trong `SurfaceState` (dissolve wrapper PR3).

**SHA / build:** xem `uat-results.json` (cập nhật sau mỗi lần chạy UAT).

**Origin:** `http://uat975.localhost:3017` · env `.local-dev/portal975/portal.env` (không commit).

**Driver:** `apps/portal/.uat-artifacts/vcx975/o26-pr1-foundation-uat.mjs` — sau mỗi `goto`: `tab switch` → `set viewport` → assert `innerWidth`/`innerHeight`.

| Surface | 390×844 | 1024×900 | 1440×900 |
| --- | --- | --- | --- |
| Landing | `landing-390x844.png` | `landing-1024x900.png` | `landing-1440x900.png` |
| Auth | `auth-390x844.png` | `auth-1024x900.png` | `auth-1440x900.png` |
| Owner events | `owner-events-390x844.png` | `owner-events-1024x900.png` | `owner-events-1440x900.png` |

Owner @ 390×844 có thể `overflowX` do Pro/page chrome hiện có — không scope foundation PR1.
