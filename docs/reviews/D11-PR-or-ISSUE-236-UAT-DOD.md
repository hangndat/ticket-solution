# DoD review — Issue #236 UAT tích hợp D11-S5

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_c9267ae3-9850-4fef-a6c5-d84eb9be2ad4` · task `task_99891d234d9f` · dispatch `ctx_699b7c417502` · worktree `d11-236-integrated-uat` |
| Implementer (≠ reviewer) | UAT evidence worker · dispatch `ctx_56c85aea2624` · task `task_d54e11da5665` · terminal `term_f3878fb4-9a38-4a4f-bfb2-e2f6a00ef182` |
| Scope | Issue [#236](https://github.com/hangndat/ticket-solution/issues/236) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · milestone gates (a)(b)(d); gate (c) n/a · paths `docs/reviews/D11-MILESTONE-EVIDENCE.md`, `apps/web/.uat-artifacts/d11-236/`, `apps/mobile/.uat-artifacts/d11-236/`, `apps/api/.uat-artifacts/d11-236/` |
| Commit SHA (exact) | `6f7995ea66e47120303167574e65424fdb3c7182` |
| Architecture impact | **Không** — nghiệm thu evidence; không đổi product code |
| Agent | `cursor` (orca-agent-routing) |

## Issue AC đối chiếu

Issue #236 body: thu bằng chứng **headless UAT** ứng dụng, **local iOS build**, review **exact SHA** và CI; **không** claim pilot ready; brand/a11y theo surface Task; milestone tập hợp evidence; **không** deploy/store.

Checkpoint comment (owner): cần authenticated CS/Report/Gate và public-events real-API; anonymous 200 ≠ acceptance. Coordinator follow-up: `accept-ios-gap` cho iOS Staff Save Password khi Web auth + iOS public events đủ.

**Staff session bắt buộc?** Issue #236 **không** ghi AC bắt buộc «iOS Staff/Gate session online PASS». Gap iOS Staff sau ASWebAuth vì system Save Password UI **hợp lệ** là known gap (không waive mandatory AC). Web authenticated CS + EventReport + public `mfest-demo` đã đóng phần authenticated acceptance trên headless web.

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` / tip under review | `6f7995ea66e47120303167574e65424fdb3c7182` (khớp `apps/web/.uat-artifacts/d11-236/tip-sha.txt`) |
| Independence | Reviewer dispatch `ctx_699b7c417502` ≠ implementer `ctx_56c85aea2624` |
| Evidence index | `docs/reviews/D11-MILESTONE-EVIDENCE.md` cites tip SHA + commands + gaps |
| Isolated fixture durable doc | **Thiếu** `docs/reviews/D11-236-ISOLATED-FIXTURE.md` trong worktree (index cite path). Handoff thực tế: `/tmp/ticket-remaining-236/OWNERSHIP.md` + `api.env` (keys only reviewed; không dump secrets) · API `:4112` · OIDC `:18091` · tenant `mfest-demo` |
| Web auth acceptance log | `auth-acceptance-uat-4112b.console.log` / `auth-acceptance-uat.log` → `bff_me_status=200` · EventReport numbers=1 · CS search/detail/timeline/resend+cooldown · `bff_public_mfest_demo_status=200` · **`PASS auth-acceptance core`** |
| Web auth screenshots | Real PNGs: `auth-staff-logged-in.png`, `auth-event-report.png`, `auth-cs-search.png`, `auth-cs-detail.png`, `auth-cs-panel.png`, `auth-home-public.png` (spot-check: admin CS detail ACTIVE + timeline; EventReport asOf 03:44:15; home **MFest · Demo**) |
| Web anonymous matrix / gate offline | `http-matrix-tip.log` tip SHA · routes 200 · bff_me 401; `gate-offline-uat-tip.log` `ok: true` |
| iOS public events | `labels-4112-events.txt` + `tip-4112-events.png`: **MFest · Demo**, `Tổ chức: mfest-demo`, `Đã xuất bản · v1` |
| iOS Staff Save Password gap | `tip-4112-oidc-save.png` shows system «Save Password?» over Keycloak ASWebAuth; `ask-ios-oidc.txt` = coordinator `accept-ios-gap`; AXe không resolve dialog |
| iOS local build (gate b) | `xcodebuild-release-tip.log` + `xcodebuild-release-4112b.log` → `** BUILD SUCCEEDED **` · Team `BLUA62D52G` · sim `D11-236-8a6b` · **no** EAS |
| Headless only (gate a tooling) | `auth-acceptance-uat.mjs` / `scripts/web-uat.mjs` → chrome-headless-shell, `headless: true`; `scripts/sim-uat.sh` AXe + simctl, intentionally no `open -a Simulator` / no cliclick |
| CI on exact tip | Run trên `6f7995e…` **cancelled** ([run 39092520564](https://github.com/hangndat/ticket-solution/actions/runs/39092520564)). Descendant main `58ce810ea34890cb961fd5dc4355c8a2f3cde22b` **SUCCESS** ([run 39092602490](https://github.com/hangndat/ticket-solution/actions/runs/39092602490)) — ghi trong Issue checkpoint; không bịa CI xanh trên exact tip |
| Deploy / pilot / store | Không claim; gate (c) n/a |

### Lệnh evidence (implementer — xác minh có trong artifact)

```text
# Web authenticated (API :4112 via BFF :3111)
WEB_UAT_CS_QUERY=attendee@example.com \
  node apps/web/.uat-artifacts/d11-236/auth-acceptance-uat.mjs http://127.0.0.1:3111
# → apps/web/.uat-artifacts/d11-236/auth-acceptance-uat*.log · PASS auth-acceptance core

# iOS Release bake :4112 + sim-uat AXe
xcodebuild … -configuration Release … → xcodebuild-release-4112b.log
scripts/sim-uat.sh screenshot|describe|tap  # UDID F218D06A-…
```

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận theo AC + coordinator) | **iOS Staff/Gate session** sau ASWebAuth bị chặn system Save Password (không AXe-accessible; không mouse). Issue #236 không bắt buộc Staff session iOS PASS; Web auth CS/EventReport/public đã đủ authenticated path. Follow-up riêng (disable password autofill / headed waiver nếu user yêu cầu). |
| Should-fix (docs) | Index cite `docs/reviews/D11-236-ISOLATED-FIXTURE.md` nhưng file **không** có trong worktree — chỉ `/tmp/ticket-remaining-236/OWNERSHIP.md`. Nên materialize durable fixture note vào `docs/reviews/` trước đóng Epic nếu cần audit lâu dài. |
| Nit | Bảng «Pending» trong `D11-MILESTONE-EVIDENCE.md` vẫn ghi «authenticated CS UAT vẫn gap» trong khi follow-up section đã đóng CS trên `:4112` — lệch nội bộ index. |
| Nit | `auth-staff-logged-in.png` là chrome `/auth` (Đăng nhập / Kiểm tra phiên), không phải admin CS; acceptance authenticated dựa log `bff_me=200` + các PNG CS/Report/home. |
| Limitation (CI) | Exact tip CI cancelled; dùng successor SUCCESS + UAT evidence — coordinator quyết định có cần re-run CI trên tip trước `Hoàn thành` Project. |

Không blocker ownership / secrets prod / mouse UAT / claim pilot / thiếu Web auth hoặc iOS public events.

## Checklist task

1. Web auth CS / EventReport / public `mfest-demo` — **đủ** (log PASS + PNG + commands).
2. iOS public events PASS; Staff Save Password gap **ghi rõ và hợp lệ** (không waive mandatory — Issue không bắt buộc Staff iOS session).
3. Headless only — **đủ**.
4. Artifact này + exact SHA + verdict — **có**.

## Verdict

**PASS with known gap**

- Exact SHA: `6f7995ea66e47120303167574e65424fdb3c7182`
- Gap: iOS Staff/Gate session (Save Password system UI) — chấp nhận cho #236 theo AC Issue + coordinator `accept-ios-gap`.
- Gap docs: thiếu durable `D11-236-ISOLATED-FIXTURE.md` (handoff `/tmp` vẫn có) — không nuốt acceptance UAT bắt buộc.
- **Không** pilot ready; **không** merge/deploy từ reviewer session này.

## Revalidation

Commit hành vi mới sau SHA này → bắt buộc DoD lại trên SHA mới; không kế thừa verdict.
