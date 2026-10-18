# DoD Review — PR #287 (scripts web-uat + device UAT helpers)

**PR:** https://github.com/hangndat/ticket-solution/pull/287  
**Branch:** `hangndat/scripts-web-uat-device-helpers` → `main`  
**Reviewer / session:** Cursor DoD reviewer độc lập · Role `reviewer-dod` · dispatch `ctx_ffec9b873ebf` · terminal `term_b8e1a700-b8f3-4cc4-bab3-e666dce49933` · **≠** implementer `ctx_6bda53f46484`  
**Ngày review:** 2026-10-18  
**Architecture impact:** Không  
**Phạm vi chỉnh sửa reviewer:** chỉ `docs/reviews/PR-287-SCRIPTS-UAT-DOD.md` — **không** merge; không sửa product.

## Exact SHA đối chiếu

| Vai trò | SHA (full) | Xác minh |
| --- | --- | --- |
| **Commit đang duyệt (tip PR #287)** | `d1748bf5f7fc7ab8099d682597abf3ab6964ec7c` | `gh pr view 287 --json headRefOid` + `git rev-parse` / `git show` |
| Message | `fix(scripts): harden web-uat auth locator + device UAT helpers` | 1 commit trên PR |
| Implementer | hangndat / session `ctx_6bda53f46484` | Khác session reviewer |

> Mọi commit hành vi mới sau SHA này → bắt buộc DoD lại. Artifact docs-only sau review không đổi verdict pins trên `d1748bf5f7fc7ab8099d682597abf3ab6964ec7c`.

## Phạm vi ownership (`main...d1748bf`)

Chỉ:

- `scripts/web-uat.mjs` (+2 / −2)
- `scripts/d5-wait-device-token.sh` (new, +18)
- `scripts/seed-device-uat.mjs` (new, +175)

Không đụng `apps/*`, `packages/*`, CI workflows, hoặc shared contracts.

## Checklist DoD

| # | Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| 1 | Diff chỉ `scripts/`; locator auth hợp lý; không secret trong seed | **PASS** | 3 files scripts-only; locator `a[href="/api/auth/login"]` khớp `apps/web/app/auth/auth-session.tsx` (`Đăng nhập`); seed dùng `@example.com`, fixture UUID/code, secrets qua `process.env` / `readCodeHmacEnvironment` / `readCredentialKeyEnvironment` |
| 2 | `d5-wait-device-token.sh` không nguy hiểm / không hardcode credential thật | **PASS** | `set -euo pipefail`; SSH `BatchMode=yes` (key-based, không password); host mặc định overridable `D5_SSH_HOST`; DB user/db từ env container `$POSTGRES_*`; không password/API key/token đầy đủ trong file |
| 3 | Artifact exact SHA + verdict | **PASS** | File này |
| 4 | Không merge; không sửa product ngoài docs artifact | **PASS** | Reviewer chỉ ghi `docs/reviews/*` |

## Findings

### Blocker

Không.

### Should-fix

Không.

### Nit / limitations (không chặn PASS)

1. **Default SSH host** `dexter@113.161.116.5` gắn sẵn (overridable). Không phải credential; phù hợp helper ops D5, nhưng gắn IP prod trong repo — chấp nhận cho script UAT thiết bị; có thể siết bắt buộc env sau nếu muốn.
2. **`left(token,16)`** in ra prefix token khi có row — chỉ khi operator đã SSH được prod; intentional cho poll UAT, không phải secret đầy đủ.
3. **Runtime:** không chạy live `seed-device-uat.mjs` / `d5-wait-device-token.sh` (cần Docker `/app/...` + SSH prod). Review tĩnh + đối chiếu locator với source auth + CI paths-filter trên tip SHA.
4. Locator cũ `/Sign in \(Keycloak\)/i` lệch UI tiếng Việt (`Đăng nhập`) — đổi sang `href` là đúng hướng ổn định hơn text.

## Checks đã chạy (trên SHA `d1748bf5f7fc7ab8099d682597abf3ab6964ec7c`)

```bash
gh pr view 287 --json headRefOid,files,commits,url
# headRefOid = d1748bf5f7fc7ab8099d682597abf3ab6964ec7c

git show d1748bf5f7fc7ab8099d682597abf3ab6964ec7c --stat
git diff origin/main...d1748bf5f7fc7ab8099d682597abf3ab6964ec7c --name-only
# chỉ 3 files scripts/

# Đối chiếu locator với product:
# apps/web/app/auth/auth-session.tsx → <a href="/api/auth/login">Đăng nhập</a>

# Secret-like scan trên seed (password|secret|token|api_key|Bearer|BEGIN|sk-|AKIA): không match cứng credential

gh pr checks 287
# tip run https://github.com/hangndat/ticket-solution/actions/runs/39099115097
#   changes / ci / d5-drills / d5-observability / d5-rint = pass
#   backend / web / mobile / database-isolation / turbo-persist = skipping (paths-filter scripts-only — kỳ vọng)
```

## Verdict

**PASS**

- Exact SHA reviewed: `d1748bf5f7fc7ab8099d682597abf3ab6964ec7c`
- Diff scripts-only; auth locator hợp lý; seed không chứa secret; wait-script không hardcode credential thật.
- Coordinator: đủ điều kiện merge sau khi CI tip vẫn xanh; **không** tự merge từ session reviewer này.
