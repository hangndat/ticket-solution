# DoD Review (REVALIDATION) — PR #187 (CI warning refresh)

**PR:** https://github.com/hangndat/ticket-solution/pull/187  
**Branch:** `hangndat/ci-warning-refresh` → `main`  
**Label:** `ci:docker` (present)  
**Reviewer / session:** Cursor DoD reviewer độc lập (≠ implementer) · worktree `dod-ci-warning-187` · **revalidation bắt buộc** — **không** tái dùng verdict SHA `1a2d89d`  
**Ngày review:** 2026-10-17  
**Phạm vi chỉnh sửa reviewer:** chỉ `docs/reviews/*` — **không** merge.

## Exact SHA đối chiếu

| Vai trò | SHA (full) | Xác minh |
| --- | --- | --- |
| **Commit đang duyệt (tip revalidation)** | `66dcec122ceddc400e6772213a8a40045c8ff20b` | Message `ci: document ci:docker needs synchronize after label attach` |
| Parent (Node24 migrate) | `1a2d89dc7ef9d98d5709f7a8b336a63c435fa36d` | Chỉ để đối chiếu delta — **không** kế thừa verdict |
| Delta `1a2d89d..66dcec1` | +2 dòng comment YAML trong `ci.yml` | Giải thích `gh run rerun` giữ payload gốc → cần synchronize sau khi gắn label |
| Implementer | hangndat | Khác session reviewer |

> Mọi commit hành vi mới sau SHA này → bắt buộc DoD lại. Artifact docs-only sau review không đổi verdict pins trên `66dcec1`.

## Phạm vi ownership (`main...66dcec1`)

- `.github/workflows/ci.yml`
- `.github/actions/setup-pnpm/action.yml`
- `.github/actions/save-turbo/action.yml`
- `package.json` — chỉ `pnpm.ignoredBuiltDependencies`

Không đụng `apps/*`. `engines.node` = `>=24 <27`; `setup-pnpm` `node-version: 24`.

## Checklist DoD (revalidate trên `66dcec1`)

| # | Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| 1 | Chỉ scope CI/coordinator; không đụng app runtime Node khỏi 24 | **PASS** | 4 files; engines/`node-version: 24` giữ nguyên |
| 2 | Actions pin major Node24 chính thức | **PASS** | Re-confirm `runs.using: node24`: checkout@v7, setup-node@v7, cache@v6, upload-artifact@v7, download-artifact@v8, pnpm/action-setup@v6, dorny/paths-filter@v4 |
| 3 | `runs-on: ubuntu-24.04` (không `ubuntu-latest`) | **PASS** | Không còn `ubuntu-latest`; log jobs: `Image: ubuntu-24.04` |
| 4 | `ignoredBuiltDependencies`: `@scarf/scarf` + `esbuild` | **PASS** | Vẫn khai báo tường minh; không enable scripts đại trà |
| 5 | Không secrets; conventional commit | **PASS** | Comment-only commit; không secrets |
| 6 | Limitations ngoài scope (`punycode` DEP0040) ghi nhận đúng | **PASS** | Ngoài scope Actions Node20 deprecation |
| 7 | Label `ci:docker` + synchronize | **PASS** | PR có label; run trên `66dcec1` đã chạy **database-isolation** (6 shards) + **d5-*** — không skip Docker scopes |

## Checks đã chạy (trên SHA `66dcec122ceddc400e6772213a8a40045c8ff20b`)

```bash
# Tree / delta
git show 66dcec122ceddc400e6772213a8a40045c8ff20b --stat
git diff 1a2d89d..66dcec1 --stat
# .github/workflows/ci.yml | 2 ++

# CI run https://github.com/hangndat/ticket-solution/actions/runs/39026060255
#   headSha = 66dcec122ceddc400e6772213a8a40045c8ff20b
#   Workflow conclusion = cancelled (superseded bởi push docs review sau đó)
#   Mọi job conclusion = success, gồm:
#     changes, web, mobile, backend,
#     database-isolation ×6, d5-observability, d5-drills, d5-rint,
#     turbo-persist, ci (aggregate)

# Log sample (changes / web / db-rls / d5-observability):
#   Image: ubuntu-24.04
#   actions/checkout@v7, setup-node@v7, pnpm/action-setup@v6, cache@v6, …
#   web: ##[warning] count = 0; không banner Ignored build scripts scarf/esbuild
```

## Findings

### Không blocking

1. **Workflow run `cancelled` ở mức run** trong khi **mọi job (kể cả `ci`) = success** — do push artifact/docs sau tip đã supersede; check-runs trên commit `66dcec1` vẫn SUCCESS. Đủ evidence cho SHA này.
2. **Delta tip chỉ comment** — không đổi majors / `runs-on` / `ignoredBuiltDependencies`; pins vẫn đúng khi đọc tree `66dcec1`.

### Known gaps (chủ đích — không FAIL)

| Gap | Ghi chú |
| --- | --- |
| `punycode` / `DEP0040` | Có thể còn từ toolchain; không phải `##[warning]` deprecation Node20 Actions. Ngoài scope. |
| Pin major (không SHA pin) | Style repo hiện tại; majors đã `node24`. |

## Verdict

**PASS with known gap**

Revalidation độc lập trên exact SHA `66dcec122ceddc400e6772213a8a40045c8ff20b` — **không** kế thừa verdict `1a2d89d`. Gap chủ đích: residual DEP0040/punycode ngoài scope. Label `ci:docker` đã có hiệu lực trên synchronize (Docker/DB/D5 jobs xanh). Reviewer **không** merge.

## Việc còn lại (coordinator)

- Merge PR #187 khi tip CI xanh (nếu tip chỉ thêm `docs/reviews/*` sau SHA duyệt → docs-only; nếu tip có commit **hành vi** mới → revalidate lại).
- Không tuyên bố thay đổi runtime app từ PR này.
