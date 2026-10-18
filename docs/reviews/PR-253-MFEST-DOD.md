# DoD review — PR #253 (Fun Fest → MFest fixtures/seed)

| Trường | Giá trị |
| --- | --- |
| **Verdict** | **FAIL** |
| Reviewer / session | Cursor · Role `reviewer-dod` · terminal `term_b416de4f-02f6-4a6d-b72b-c3761ec8feb4` · task `task_8db5db46a7b0` · dispatch `ctx_b31ad1ecbefd` · **≠** implementer |
| Scope | PR [#253](https://github.com/hangndat/ticket-solution/pull/253) · rename fixture/seed slug web + mobile + backend (+ docs/tests/scripts) |
| Commit SHA đã duyệt | `ec0f74efa017027cdaccce99c623690da1a62071` |
| Architecture impact | Không (đổi fixture/seed slug) — vẫn đối chiếu ADR-19 coexistence |
| Security review riêng | Không yêu cầu — không đụng authz/RLS/secrets; allowlist example chỉ đổi slug demo |
| Ngày | 2026-10-18 |
| Revalidation | Bắt buộc sau rebase/fix lên `origin/main` (SHA mới) |

## Checklist DoD

| Tiêu chí | Kết quả |
| --- | --- |
| Exact SHA under review = tip PR | PASS — `headRefOid` = `ec0f74efa017027cdaccce99c623690da1a62071` |
| Rename nhất quán tenant/event/catalog/seed/tests | PASS trên SHA này (không còn `fun-fest` / `sunburst` / `demo-fun` / `funFest` trong source khớp scope) |
| Deep links installed-app cập nhật + không fixture fallback cho claim | PASS — `demo-mfest` → `/events/fixture/demo-mfest`; invitation claim vẫn không fallback fixture |
| Mobile giữ published-first fail-closed (ADR-19 / M04) | PASS trên SHA — `fetchPublishedEventList` + copy “không dùng demo thay thế”; chỉ đổi default slug `demo-fun` → `mfest-demo` |
| Không hồi sinh fixture SoT sau ADR-19 khi merge vào `main` | **FAIL** — xem blocker #1 |
| PR mergeable vs `origin/main` | **FAIL** — stale + conflict thật |
| CI xanh trên SHA (lúc push) | PASS lịch sử — [run 39061701576](https://github.com/hangndat/ticket-solution/actions/runs/39061701576) (web/mobile/backend/database-isolation/ci) |
| Reviewer độc lập ≠ implementer | PASS |
| Merge / self-merge | N/A — reviewer không merge |

## Stale / conflicts vs `origin/main`

Tại thời điểm review:

| Ref | SHA |
| --- | --- |
| PR tip (reviewed) | `ec0f74efa017027cdaccce99c623690da1a62071` |
| `origin/main` | `cfabcedd71d1387df5caf8e00e11d13d74168d32` |
| Merge-base | `192e8713fc9c77b9969444c4fedf25bfa41d0473` |

`git merge-tree` báo **changed in both** / conflict markers trên:

1. `packages/backend/src/demo-seed.ts` — **blocker**
2. `apps/web/tests/routes.integration.mjs`
3. `apps/web/tests/redeem-messages.test.ts`
4. `scripts/web-uat.mjs`

`main` đã có ADR-19 seed publish (`publishEventConfig` / `ensurePublishedMarketingConfig` / `marketingPayload`, key `funFest`). SHA PR **không** chứa các symbol đó (`rg` trên `demo-seed.ts` của PR = MISSING). Merge/rebase cẩu thả có thể **xóa path publish** hoặc để lại key `funFest` lệch với rename `mfest`.

## Findings

### Blocker

1. **PR stale + conflict `demo-seed.ts` có nguy cơ regress ADR-19** — Không merge SHA này vào `main` cho đến khi rebase/onto `origin/main`, giữ nguyên publish marketing config, đổi key/slug sang `mfest` / `mfest-demo`, rồi CI + DoD revalidation trên SHA mới.

### Should-fix (sau rebase)

2. **Không có redirect/alias cho URL/deeplink cũ** — Cố ý theo PR: web `/t/sunburst/events/fun-fest-2026` → `/t/mfest/events/mfest-2026`; mobile `*://events/demo-fun-fest` → `demo-mfest`; redeem codes `DEMO-FUN-*` → `DEMO-MFEST-*`. Bookmark/QR/deeplink cũ sẽ 404 / miss catalog. Chấp nhận được cho fixture demo nếu ops/prod allowlist + SSG đã chuyển; ghi rõ trong release note. UUID seed D9 **ổn định** (cùng `d9d9f001-…`) nên re-seed cập nhật slug trên cùng hàng, không tạo identity mới.

3. **Allowlist example** `infra/platform/tenant-host-allowlist.example.json`: `sunburst` → `mfest` — chỉ example; prod allowlist/DNS phải đồng bộ ngoài PR nếu còn binding cũ.

### Nit

4. Graph `detect_changes_tool` (base `HEAD~1`) risk 0 / 0 functions — fixture/data rename kém index; đã verify bằng source + tests. Limitation: không dựa graph làm verdict.

5. PR đụng nhiều ownership (web + mobile + backend) — chấp nhận cho rename catalog đồng bộ; sau rebase vẫn nên một PR rename, không tách nửa chừng.

## Checks đã chạy (trên SHA `ec0f74efa017027cdaccce99c623690da1a62071`)

```bash
git rev-parse HEAD
# → ec0f74efa017027cdaccce99c623690da1a62071

pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/backend build

# mobile (32 pass / 0 fail)
cd apps/mobile && node --experimental-strip-types --test \
  src/links/installed-app-link.test.ts \
  src/data/demo-events.test.ts \
  src/data/demo-media.test.ts \
  src/identity/config.test.ts \
  src/theme/resolve.test.ts \
  src/attendee/attendee-outcome-copy.test.ts

# web (29 pass / 0 fail)
cd apps/web && pnpm exec node --import tsx --test \
  tests/events.test.ts tests/demo-media.test.ts \
  tests/branding-theme.test.ts tests/config-brand.test.ts

# backend unit (1 pass)
cd packages/backend && pnpm exec node --test test/demo-seed-unit.test.cjs

# tenant-host (8 pass)
node --test scripts/lib/tenant-host.test.mjs

# conflict probe
git merge-tree $(git merge-base origin/main HEAD) origin/main HEAD
```

Không chạy suite DB shared / prod / EAS. CI GitHub trên SHA: xanh (xem rollup PR).

## Diff review (tóm tắt)

- Web marketing fixtures: `sunburst`/`fun-fest-2026`/`fixture-fun-fest` → `mfest`/`mfest-2026`/`fixture-mfest`.
- Mobile/D9: `demo-fun`/`fun-fest`/`demo-fun-fest` → `mfest-demo`/`mfest`/`demo-mfest`; brand copy MFest.
- Seed UUIDs giữ nguyên; raw codes `DEMO-MFEST-###`.
- Tests/docs/UAT scripts/allowlist example/manifest đồng bộ.
- Không thêm fallback fixture khi published API lỗi trên mobile screen (chỉ đổi slug default).

## Remediation (cho coding worker)

1. Rebase `hangndat/rename-funfest-to-mfest` lên `origin/main` (`cfabced…` hoặc tip mới hơn).
2. Resolve `demo-seed.ts`: giữ ADR-19 `ensurePublishedMarketingConfig` + marketing sections; rename `fun`/`funFest` → `mfest`; cập nhật `event.slug === '…'` branch nếu còn.
3. Resolve 3 file test/UAT còn lại theo slug mới + hành vi `main`.
4. Push SHA mới → CI xanh → spawn DoD revalidation (không kế thừa FAIL/PASS của `ec0f74e…`).

## Verdict

**FAIL** trên exact SHA `ec0f74efa017027cdaccce99c623690da1a62071`.

Rename nội bộ SHA nhất quán và tests targeted xanh, nhưng PR **không merge-ready**: conflict với `main` và thiếu path publish ADR-19 trên seed so với tip `main`. Coordinator **không** merge cho đến remediation + revalidation.
