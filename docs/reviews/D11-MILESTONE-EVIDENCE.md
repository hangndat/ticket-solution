# D11 Milestone evidence index — Issue #236 / Epic #222

| Field | Value |
| --- | --- |
| Reviewer / session | Orca worker `term_f3878fb4-9a38-4a4f-bfb2-e2f6a00ef182` · task `task_d54e11da5665` · dispatch `ctx_56c85aea2624` · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · Agent cursor · (prior index: `task_8a6b2004d4de` / `ctx_d0c14124e629`) |
| Independence | Evidence/verification only — ≠ surface implementers |
| Architecture impact | **Không** — thu evidence; không feature code |
| Integration tip (UAT/build this run) | **`6f7995ea66e47120303167574e65424fdb3c7182`** (`origin/main` ff-only; includes #232/#256/#257/#246/#253) |
| Historical baseline (pre-ff) | `77b4655e39e8928feb2e2695f7b2bd651f904ecc` — **không** claim coverage #257/#256/#246 |
| Fixture (auth acceptance) | Isolated `ticket-remaining-236` · API **`http://127.0.0.1:4112`** · DB `:56443` · Redis `:56381` · OIDC `http://127.0.0.1:18091/realms/ticket` · tenant slug **`mfest-demo`** · handoff `docs/reviews/D11-236-ISOLATED-FIXTURE.md` + `/tmp/ticket-remaining-236/api.env` · **không** đụng `:4111`/`:56442` |
| Fixture reuse (prior index) | Issue #237 stack · API `:4111` — giữ artifacts lịch sử; auth AC đóng trên `:4112` |
| Simulator | **D11-236-8a6b** (`F218D06A-A0BF-49BF-874D-E4FF820A2655`) — **not** user Booted iPhone 17 Pro |
| Team | `BLUA62D52G` · local Expo prebuild + xcodebuild · **no** EAS Cloud / TestFlight / store |
| Deploy prod (gate c) | **Chưa deploy** — không ủy quyền |
| Pilot ready | **Không** (O06 / device / venue còn mở) |

## Milestone gates

| Gate | Result | Notes |
| --- | --- | --- |
| (a) Headless UAT web + iOS | **PASS with known gap** | Web auth AC đóng trên `:4112` (staff OIDC→BFF→CS+Report+public). iOS public events từ API `:4112` PASS. Gap còn: iOS Staff/Gate session sau ASWebAuth bị chặn dialog hệ thống Save Password (coordinator chấp nhận known gap). |
| (b) Local iOS build | **PASS** | prebuild + Debug + Release `** BUILD SUCCEEDED **` · Team `BLUA62D52G` · tip Release log below |
| (c) Deploy prod | **n/a** | Chưa ủy quyền |
| (d) Review artifacts + exact SHA | **PASS (index)** | Rows dưới + DoD links; tip SHA exact |

## Surface index

| Surface | Merge SHA (exact) | DoD artifact (exact tip reviewed) | Headless UAT cmd + path | Local iOS build |
| --- | --- | --- | --- | --- |
| Web admin #229 | `bedbfb84c6d4ea311bf8ec1118688390c2dce8f6` (PR #238) | [D11-WEB-ADMIN-DOD.md](./D11-WEB-ADMIN-DOD.md) — tip `1e48a025955ce75810664d747e5380eb22205362` · **PASS with known gap** | Tip: `scripts/web-uat.mjs screenshot http://127.0.0.1:3236/admin` → `apps/web/.uat-artifacts/d11-236/tip-admin.png` | n/a |
| iOS Gate #231 | `61ac7b83d9b4c70bb8dc4d5c75043d503a4c9cc9` (PR #240) | [D11-IOS-GATE-DOD.md](./D11-IOS-GATE-DOD.md) — tip `f67b9a8ec9fbe924beb1a13ab151df080dea1ffb` · **PASS with known gap** | Tip sim: `scripts/sim-uat.sh` on D11-236-8a6b → `apps/mobile/.uat-artifacts/d11-236/tip-staff.png` (composition VI: ngữ cảnh cổng · vùng quét · «Chưa cho vào») | Prior handoff + this run Release rebuild |
| Web attendee #234 | `9daf4d2ed79fa594a0ec87aaeb323921fc5d0952` (PR #243) | [D11-WEB-ATTENDEE-DOD-REVAL.md](./D11-WEB-ATTENDEE-DOD-REVAL.md) — tip `8cb4891ba60423bce79fe3a6a9f04b5c443151b9` · **PASS** | Tip screenshots `tip-claim.png` / `tip-redeem.png` / `tip-home.png` | n/a |
| iOS attendee #235 | `192e8713fc9c77b9969444c4fedf25bfa41d0473` (PR #248) | [D11-IOS-ATTENDEE-DOD.md](./D11-IOS-ATTENDEE-DOD.md) — tip `13f790f9a447bebeaeaa38a7002fff670566dc29` · **PASS with known gap** | Tip: `tip-events.png` (+ historical release-boot) | Same Release binary |
| Web Gate #232 | `783f1c1eefca0261b36ec010248ea57a2470d170` (PR #263) | [D11-PR-263-WEB-GATE-DOD.md](./D11-PR-263-WEB-GATE-DOD.md) — tip `30f88b3ad4373aa859cd193babad13b034829c28` · **PASS** | `node apps/web/tests/gate-offline-uat.mjs http://localhost:3236` → **ok** · PNGs `apps/web/.uat-artifacts/d11-236/d11-gate-{online,offline}.png` | n/a |
| Dashboard #245 | `f0191a2a630453018ff6538d55a5df42f19093d3` (#249 P2) · `a456c7fb5778de75047779c171dfe9b1e39f7793` (#258 P3) | **Không** có DoD artifact riêng trên `docs/reviews/` — chỉ merge commits trên tip | Tip `/admin` screenshot only (không deep EventReport authenticated UAT) | n/a |
| ADR-19 web #256 | `e5f985ff0626a36711c7dc02effd9e4562ec9666` (PR #270) | [D254-PR-270-WEB-PUBLIC-DOD.md](./D254-PR-270-WEB-PUBLIC-DOD.md) — tip `74455701bf3a6013f0d47acec7602d442c9cbc6a` · **PASS** | Tip home 200 + screenshot `tip-home.png` (published path trên tip) | n/a |
| ADR-19 iOS #257 | `1c106c5eaa32b42e2c8100690f12112fce9a97f9` (PR #267) | [D254-PR-267-IOS-PUBLISHED-DOD-REVAL.md](./D254-PR-267-IOS-PUBLISHED-DOD-REVAL.md) · **PASS with known gap** | Tip Release install + `tip-events.png` / `tip-staff.png` | Tip Release: `apps/mobile/.uat-artifacts/d11-236/xcodebuild-release-tip.log` |
| CS / email #246 | feature `62a50a6bca3a3b6e17169516d0159891b364e498` · merge PR #277 `39ecbd01266ccb9990d3f1b41c6f8b53685fb4f8` | Chưa có DoD slug riêng trong session này | `node apps/web/tests/d11-cs-email-uat.mjs http://localhost:3236` → fail-closed **UNAUTHENTICATED** (đúng; không mock) · PNG `apps/web/.uat-artifacts/d11-cs-email-246-support.png` | n/a |
| MFest rename #253 | merge `6f7995ea66e47120303167574e65424fdb3c7182` | CI/DoD ngoài scope chi tiết session này | Tip binary/source after ff | Tip Release rebuild |

### Pending / không claim final PASS kế thừa

| Item | Status on tip `6f7995e…` | Note |
| --- | --- | --- |
| #256 / #257 / #246 | **Merged** trên tip | Không còn «pending merge»; authenticated CS UAT vẫn **gap** |
| Dashboard #245 DoD artifact | Missing dedicated review file | Index ghi merge SHA; không bịa PASS DoD |
| Physical device / pilot | Out of scope | Không claim |

## This-run checks (exact tip `6f7995ea66e47120303167574e65424fdb3c7182`)

### Web (real API via BFF → #237 fixture `:4111`)

```text
# Web task port (OIDC redirect 3236; API_BASE_URL=http://127.0.0.1:4111)
PORT=3236 pnpm exec next dev -H 127.0.0.1 -p 3236

# HTTP matrix → apps/web/.uat-artifacts/d11-236/http-matrix-tip.log
# / /gate /claim /redeem /admin /auth → 200
# /api/bff/me → 401 (anonymous expected)
# API health → {"status":"ok",...}

pnpm exec node scripts/web-uat.mjs screenshot http://127.0.0.1:3236/{,gate,claim,redeem,admin} \
  apps/web/.uat-artifacts/d11-236/tip-*.png

node apps/web/tests/gate-offline-uat.mjs http://localhost:3236
# ok: offlineBanner, plainViCopy, noFakeQueue

pnpm exec node scripts/web-uat.mjs auth-smoke http://127.0.0.1:3236
# FAIL (script expects link /Sign in (Keycloak)/i — copy VI đã đổi; không claim OIDC login PASS)

node apps/web/tests/d11-cs-email-uat.mjs http://localhost:3236
# ok fail-closed UNAUTHENTICATED — authenticated CS timeline = gap
```

Prerequisite: `pnpm --filter @ticket/contracts build` (workspace dist) trước khi Next resolve `@ticket/contracts`.

### iOS (local, task simulator)

```text
# Simulator
xcrun simctl create D11-236-8a6b com.apple.CoreSimulator.SimDeviceType.iPhone-17 \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5
# UDID F218D06A-A0BF-49BF-874D-E4FF820A2655

cd apps/mobile
pnpm exec expo prebuild --platform ios --no-install
# log: apps/mobile/.uat-artifacts/d11-236/prebuild.log
pod install  # → Vemoki.xcworkspace
# log: apps/mobile/.uat-artifacts/d11-236/pod-install.log

# Debug (needs Metro for JS — historical RedBox documented; not tip coverage claim)
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Debug \
  -sdk iphonesimulator -destination id=F218D06A-A0BF-49BF-874D-E4FF820A2655 \
  DEVELOPMENT_TEAM=BLUA62D52G CODE_SIGNING_ALLOWED=NO \
  -derivedDataPath .uat-artifacts/d11-236/DerivedData build
# → ** BUILD SUCCEEDED ** · xcodebuild-debug.log

# Release embed JS (tip UAT binary)
xcodebuild … -configuration Release \
  -derivedDataPath .uat-artifacts/d11-236/DerivedData-Release build
# tip rebuild: xcodebuild-release-tip.log → ** BUILD SUCCEEDED **

xcrun simctl install F218D06A-… …/Release-iphonesimulator/Vemoki.app
xcrun simctl launch F218D06A-… com.hangndat.ticket
./scripts/sim-uat.sh screenshot F218D06A-… apps/mobile/.uat-artifacts/d11-236/tip-*.png
# AXe HID only — no macOS mouse / Simulator.app click
```

EXPO_PUBLIC_* bake (Release tip lịch sử): API `http://127.0.0.1:4111`. **Auth-follow-up rebuild**: bake `http://127.0.0.1:4112` + OIDC `:18091` / `ticket-mobile` (log `xcodebuild-release-4112b.log` · jsbundle chứa `:4112`, không `:4111`).

## Authenticated acceptance follow-up (dispatch `ctx_56c85aea2624`)

Exact tip: **`6f7995ea66e47120303167574e65424fdb3c7182`**. Web base `http://127.0.0.1:3111` → BFF → API `:4112`. Không SQL bypass / không mock auth / không dump token.

### Web — staff OIDC → BFF → CS + EventReport + public

```text
# Issue ticket (attendee OIDC password grant + redeem DEMO-MFEST-001 + terms)
# → ticketId 4e24ddbb-602a-4924-afdb-bf712c8b7807 · state ACTIVE · HTTP 201

WEB_UAT_CS_QUERY=attendee@example.com \
  node apps/web/.uat-artifacts/d11-236/auth-acceptance-uat.mjs http://127.0.0.1:3111
# log: apps/web/.uat-artifacts/d11-236/auth-acceptance-uat.log
# console: auth-acceptance-uat-4112b.console.log → PASS auth-acceptance core
```

| Check | HTTP / kết quả | Artifact |
| --- | --- | --- |
| Staff OIDC login (headless, host `:18091`) | callback OK · `GET /api/bff/me` **200** | `auth-staff-logged-in.png` |
| Dashboard EventReport | numbers=1 · asOf có timestamp | `auth-event-report.png` |
| CS search `attendee@example.com` | notice «CS: 1 kết quả» | `auth-cs-search.png` |
| CS detail + timeline | `cs_detail_present=1` · timeline testid=1 | `auth-cs-detail.png` |
| CS resend + cooldown | notice PENDING/replayed=false · cooldown 60s · **không** tạo vé mới | `auth-cs-panel.png` |
| Public home + BFF | home có **MFest · Demo** · `GET …/mfest-demo/events` **200** | `auth-home-public.png` |

### iOS — public events + Staff session gap

```text
# Release rebuild bake :4112 (không rebuild vì docs; rebuild vì đổi API target)
xcodebuild … Release … -derivedDataPath .uat-artifacts/d11-236/DerivedData-Release
# → ** BUILD SUCCEEDED ** · xcodebuild-release-4112b.log

xcrun simctl install/launch F218D06A-… Vemoki.app
scripts/sim-uat.sh describe|screenshot|tap (AXe HID)
```

| Check | Kết quả | Artifact |
| --- | --- | --- |
| Bake API | jsbundle `127.0.0.1:4112` (không 4111) | binary Release |
| Public events | AX: «MFest · Demo», «Tổ chức: mfest-demo», «Đã xuất bản · v1», venue fixture | `tip-4112-events.png` · `labels-4112-events.txt` |
| Staff tech line | `API http://127.0.0.1:4112` | `tip-4112-staff.png` · `labels-4112-staff.txt` |
| Staff OIDC sheet | ASWebAuth → Keycloak Sign in (127.0.0.1) mở được | `tip-4112-oidc*.png` |
| Staff online gate session | **GAP** — dialog hệ thống «Save Password?» không AXe-accessible; coordinator `accept-ios-gap` | follow-up riêng |

## Proof limits / known gaps

1. **`auth-smoke` locator cũ** — không blocker; login helper task-owned `auth-acceptance-uat.mjs` đã PASS staff OIDC.
2. **CS authenticated** — **đã đóng** trên `:4112` (search/detail/timeline/resend+cooldown).
3. **iOS Staff online / mở phiên cổng** — **known gap** (Save Password system UI); public events + bake `:4112` PASS. Coordinator chấp nhận PASS with known gap cho #236 lần này.
4. **Debug `.app` without Metro** — RedBox documented; Release binary dùng cho tip UAT.
5. **Dashboard #245** — không DoD file riêng; EventReport deep UAT authenticated **đã** chạy qua admin gate panel trên `:4112`.
6. **Không** pilot ready / device / venue / deploy / store / EAS.
7. **Historical `:4111` artifacts** giữ baseline; auth AC + iOS bake mới dùng `:4112`.

## Verdict

**PASS with known gap** — exact tip `6f7995ea66e47120303167574e65424fdb3c7182`. Web authenticated acceptance (staff OIDC→BFF→CS+EventReport+public mfest-demo trên API `:4112`) **đủ**. iOS public events từ API `:4112` **đủ**. Gap còn: iOS Staff/Gate session sau ASWebAuth (Save Password UI).

**Không** pilot ready; **không** claim Hoàn thành Project nếu còn gate ngoài scope; worker **không** commit/push/PR.
