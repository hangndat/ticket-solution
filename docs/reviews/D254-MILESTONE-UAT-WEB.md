# Milestone UAT — Web headless published SoT (ADR-19)

| Trường | Giá trị |
| --- | --- |
| Scope | Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) · Issue [#282](https://github.com/hangndat/ticket-solution/issues/282) · ownership **web** |
| Role | `web` · `docs/agents/roles/web.md` |
| Architecture impact | Không (acceptance / milestone gate) |
| Base `main` SHA | `7923004af65131d7033a8556d39a214122fa59cf` |
| Branch (docs) | `hangndat/epic254-uat-web-282` |
| Worker | Orca Cursor · Task `task_d8680a1d0f96` · Dispatch `ctx_6cb538443192` |
| Thời điểm (UTC) | 2026-10-18T04:01:05Z |
| Verdict | **PASS** |

## Mục tiêu

Nghiệm thu headless web cho bề mặt **published event từ server** theo [ADR-19](../ops/ADR-19-EVENT-SERVER-SOURCE.md): home + `/t/.../events/...` đọc Nest public projection; không fixture-as-published khi API lỗi.

## Môi trường chạy UAT

| Thành phần | Chi tiết |
| --- | --- |
| Worktree | Sync `origin/main` @ `7923004af65131d7033a8556d39a214122fa59cf` |
| Web | `next dev --port 3010` trong worktree này (port 3000 đang bị process khác chiếm — không phải `@ticket/web`) |
| Nest API | Đang phục vụ published D9 demo tại `http://127.0.0.1:4112` (process ngoài worktree; health `GET /v1/health` → 200) |
| `API_BASE_URL` | `http://127.0.0.1:4112` |
| `PUBLIC_HOME_TENANT_SLUGS` | `mfest-demo,demo-studio` |
| Infra | Docker Compose `ticket-solution` postgres/redis/keycloak healthy (ports 55432 / 56379 / 8080) |
| Browser | Playwright **headless** via `scripts/web-uat.sh` → `scripts/web-uat.mjs` (chrome-headless-shell; **không** headed, **không** cliclick) |

### Seed / published SoT đã có sẵn

```text
GET http://127.0.0.1:4112/v1/public/tenants/mfest-demo/events → 200
  items[0].slug=mfest · name=MFest · Demo · publishedConfigVersion=1

GET http://127.0.0.1:4112/v1/public/tenants/demo-studio/events → 200
  items[0].slug=studio-night · name=Studio Night · Demo · publishedConfigVersion=1
```

Không cần re-seed trong session này (D9 published đã có trên Nest đang chạy). Ownership worker **không** sửa `apps/api`.

## Lệnh UAT (headless)

```bash
git rev-parse origin/main
# → 7923004af65131d7033a8556d39a214122fa59cf

# Web (demo — env OIDC placeholder từ .env.example, không commit secrets)
cd apps/web && \
  API_BASE_URL=http://127.0.0.1:4112 \
  PUBLIC_HOME_TENANT_SLUGS=mfest-demo,demo-studio \
  WEB_PUBLIC_ORIGIN=http://127.0.0.1:3010 \
  pnpm exec next dev --port 3010

mkdir -p apps/web/.uat-artifacts
WEB_BASE_URL=http://127.0.0.1:3010 \
  ./scripts/web-uat.sh screenshot http://127.0.0.1:3010/ \
    apps/web/.uat-artifacts/d254-home-published.png
WEB_BASE_URL=http://127.0.0.1:3010 \
  ./scripts/web-uat.sh screenshot http://127.0.0.1:3010/t/mfest-demo/events/mfest \
    apps/web/.uat-artifacts/d254-event-mfest.png
WEB_BASE_URL=http://127.0.0.1:3010 \
  ./scripts/web-uat.sh screenshot http://127.0.0.1:3010/t/demo-studio/events/studio-night \
    apps/web/.uat-artifacts/d254-event-studio-night.png
./scripts/web-uat.sh goto http://127.0.0.1:3010/
./scripts/web-uat.sh goto http://127.0.0.1:3010/t/mfest-demo/events/mfest
```

### Kết quả `goto` / `screenshot`

```json
{"ok":true,"status":200,"url":"http://127.0.0.1:3010/","title":"Vemoki"}
{"ok":true,"status":200,"url":"http://127.0.0.1:3010/t/mfest-demo/events/mfest","title":"MFest · Demo — MFest · Demo · Vemoki"}
{"ok":true,"status":200,"url":"http://127.0.0.1:3010/t/demo-studio/events/studio-night","title":"Studio Night · Demo — Studio Organization · Demo · Vemoki"}
```

BFF proxy (cùng session):

```text
GET /api/bff/public/tenants/mfest-demo/events → 200 (items khớp Nest)
```

## Artifacts (gitignored)

Paths dưới `apps/web/.uat-artifacts/` (không commit PNG):

| File | Nội dung quan sát |
| --- | --- |
| `apps/web/.uat-artifacts/d254-home-published.png` | Home Vemoki liệt kê **MFest · Demo** + **Studio Night · Demo**; banner VI «Danh sách từ máy chủ. Chỉ sự kiện đã xuất bản công khai.» — không Sunburst/Northline fixture SoT |
| `apps/web/.uat-artifacts/d254-event-mfest.png` | Detail mfest: published sections, nhãn demo, địa điểm seed riverside |
| `apps/web/.uat-artifacts/d254-event-studio-night.png` | Detail studio-night từ Nest published |

## Đối chiếu ADR-19

| Tiêu chí | Kết quả |
| --- | --- |
| Nguồn chuẩn = server published projection | **PASS** — home + detail titles/location khớp Nest public JSON |
| Không fixture-as-published trên happy path | **PASS** — HTML home không chứa `sunburst`/`northline`; copy «từ máy chủ» |
| Fail-closed khi API down | **Không re-run headed-fail trong session** — đã cover bởi `apps/web/tests/routes.integration.mjs` + DoD PR #270 (`UPSTREAM_UNAVAILABLE` / SurfaceState unreachable). Happy-path UAT này là gap milestone còn lại |
| Headless only | **PASS** — `scripts/web-uat.sh` / Playwright headless |

## Limitations

1. Nest lắng nghe `127.0.0.1:4112` (không phải default `3001`) — process từ worktree UAT khác; worker web chỉ consume qua `API_BASE_URL`.
2. Web UAT chạy trên **3010** vì `3000` đang phục vụ app khác (S10 Portal), không phải `@ticket/web`.
3. Không deploy prod; không full D11 #236 matrix; không iOS (worker iOS riêng).
4. PNG gitignored — chỉ liệt kê path trong artifact này.

## Verdict

**PASS** trên exact `main` SHA `7923004af65131d7033a8556d39a214122fa59cf` cho gate **web headless published SoT** của milestone Epic #254 / Issue #282.
