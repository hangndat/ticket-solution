# DoD Review — PR #187 (CI warning refresh · Node24 Actions + ubuntu-24.04)

**PR:** https://github.com/hangndat/ticket-solution/pull/187  
**Branch:** `hangndat/ci-warning-refresh` → `main`  
**Reviewer / session:** Cursor DoD reviewer độc lập (≠ implementer) · worktree `dod-ci-warning-187` · branch local `hangndat/dod-ci-warning-187`  
**Ngày review:** 2026-10-17  
**Phạm vi chỉnh sửa reviewer:** chỉ `docs/reviews/*` — **không** sửa `.github/**` product CI ngoài artifact; **không** merge.

## Exact SHA đối chiếu

| Vai trò | SHA (full) | Xác minh |
| --- | --- | --- |
| **Commit đang duyệt (spec spawn)** | `1a2d89dc7ef9d98d5709f7a8b336a63c435fa36d` | `git rev-parse` / PR commit list; message `ci: migrate Actions to Node 24 runtimes and pin ubuntu-24.04` |
| Tip PR lúc đóng review | `66dcec122ceddc400e6772213a8a40045c8ff20b` | Chỉ +2 dòng **comment YAML** (ghi chú `gh run rerun` / label `ci:docker`) — **không** đổi action majors, `runs-on`, `node-version`, hay `ignoredBuiltDependencies` |
| Implementer | hangndat (`6947674+hangndat@users.noreply.github.com`) | Khác session reviewer |

> Revalidation: commit **hành vi** mới sau SHA duyệt → bắt buộc DoD lại. Tip `66dcec1` = docs/comment-only → không vô hiệu hóa verdict pin Node24 / ubuntu-24.04 trên `1a2d89d`.

## Phạm vi ownership

Diff `main...1a2d89d` **chỉ**:

- `.github/workflows/ci.yml`
- `.github/actions/setup-pnpm/action.yml`
- `.github/actions/save-turbo/action.yml`
- `package.json` — chỉ thêm `pnpm.ignoredBuiltDependencies`

**PASS** — coordinator / CI tooling; không đụng `apps/*`; `engines.node` giữ `>=24 <27`; `setup-pnpm` vẫn `node-version: 24`.

## Checklist DoD

| # | Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| 1 | Chỉ scope CI/coordinator; không đụng app runtime Node khỏi 24 | **PASS** | 4 files; engines/`node-version: 24` không đổi hướng xuống |
| 2 | Actions pin major Node24 chính thức | **PASS** | Xác nhận `runs.using: node24` qua `action.yml` gh API: `checkout@v7`, `setup-node@v7`, `cache@v6`, `upload-artifact@v7`, `download-artifact@v8`, `pnpm/action-setup@v6`, `dorny/paths-filter@v4` |
| 3 | `runs-on: ubuntu-24.04` (không `ubuntu-latest`) | **PASS** | Mọi job trong `ci.yml`; log job: `Image: ubuntu-24.04`; không còn `ubuntu-latest` |
| 4 | `ignoredBuiltDependencies`: `@scarf/scarf` + `esbuild` | **PASS** | Khai báo tường minh; không `onlyBuiltDependencies` / enable scripts đại trà |
| 5 | Không secrets; conventional commit | **PASS** | Diff không chứa token/`.env`/credential; subject `ci: …` hợp lý |
| 6 | Limitations ngoài scope (`punycode` DEP0040) ghi nhận đúng | **PASS** | PR body ghi DEP0040 ngoài scope Actions deprecation; không phải mục tiêu PR này |

## Checks đã chạy (trên SHA `1a2d89dc7ef9d98d5709f7a8b336a63c435fa36d`)

```bash
git rev-parse HEAD
# 1a2d89dc7ef9d98d5709f7a8b336a63c435fa36d

git diff main...1a2d89d --name-only
# .github/actions/save-turbo/action.yml
# .github/actions/setup-pnpm/action.yml
# .github/workflows/ci.yml
# package.json

# Xác nhận runs.using: node24 trên các major đã pin (gh API action.yml)
# CI run https://github.com/hangndat/ticket-solution/actions/runs/39025684501
#   conclusion=success · headSha=1a2d89dc7ef9d98d5709f7a8b336a63c435fa36d
#   changes / web / mobile / backend / turbo-persist / ci → success
#   database-isolation + d5-* → skipped (path filter đúng slice)

# Log sample (web/mobile/changes/turbo-persist):
#   Image: ubuntu-24.04
#   Download … actions/checkout@v7, setup-node@v7, pnpm/action-setup@v6,
#     cache@v6, upload-artifact@v7, download-artifact@v8, dorny/paths-filter@v4
#   Không có ##[warning] Node.js 20 deprecated / ubuntu-latest→26
#   pnpm install: không còn banner "Ignored build scripts: @scarf/scarf, esbuild"
```

Risk graph (`detect_changes` vs `main`): 4 files, risk score 0.00 — YAML/config only.

## Findings

### Không blocking

1. **Tip PR đã tiến sau spawn review:** `66dcec1` chỉ comment về label `ci:docker` + `gh run rerun` — không đổi hành vi CI pins. Coordinator có thể merge tip mà không cần re-pin review; nếu muốn artifact SHA = tip, ghi chú comment-only là đủ.
2. **Jobs DB/D5 skipped trên PR này:** đúng path-filter (đổi `.github` + root `package.json` kích hoạt web/mobile/backend, không hardening/db matrix) — không phải regression.

### Known gaps (chủ đích — không FAIL)

| Gap | Ghi chú |
| --- | --- |
| `punycode` / `DEP0040` | Có thể còn từ toolchain bên trong actions/pnpm; **không** phải `##[warning]` deprecation Node20 Actions. Ngoài scope PR; đã ghi trên PR body. |
| Pin major (không SHA pin) | Giữ style repo hiện tại (`@vN`); majors đã xác nhận `node24`. |

Không phát hiện secrets, không hạ runtime Node app, không enable install scripts đại trà.

## Verdict

**PASS with known gap**

Đủ DoD cho PR #187 trên exact SHA `1a2d89dc7ef9d98d5709f7a8b336a63c435fa36d`. Gap còn lại chủ đích: residual `DEP0040`/punycode ngoài scope Actions Node20 deprecation. Coordinator có thể merge khi CI vẫn xanh trên tip (tip hiện `66dcec1` = comment-only); reviewer **không** merge.

## Việc còn lại (coordinator)

- Merge PR #187 sau khi xác nhận tip CI xanh (revalidate chỉ nếu có commit **hành vi** mới ≠ comment).
- Không cần đổi `apps/*` hay engines Node từ PR này.
- Project Status / Issue (nếu gắn): sau merge + CI xanh → `Hoàn thành` theo board rules.
