# Revalidation DoD + Security — PR #640 / Issue #630 (F1 — IdP 5xx giữ phiên)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Persona **James · dod+sec** · Roles `reviewer-dod` + `reviewer-security` · `task_6f0a6e9782f1` / `ctx_2ba15bc26c88` / terminal `term_86761814-de47-459c-abe9-ef5dfbbb69cb` — **≠** implementer Higo |
| Scope | Revalidate sau fix F1; review gốc: [`MPR-PR640-REVIEW-2026-10-21.md`](./MPR-PR640-REVIEW-2026-10-21.md) @ SHA `00750a36ab967f896a8cdb937f862f5da26a3d86` |
| Issue / PR | [#630](https://github.com/hangndat/ticket-solution/issues/630) · [#640](https://github.com/hangndat/ticket-solution/pull/640) |
| Commit SHA (PR tip) | **`0057baf08ae311234ef06a7c7ae1e42d7ff699aa`** (`git rev-parse HEAD` worktree `hangndat/review-640-dodsec-2` khớp `gh-dod-evidence` `head.sha`) |
| Delta review | `00750a3..0057baf` — chỉ 2 file (xem bên dưới) |
| Architecture impact | **Không** |
| Verdict revalidation (F1) | **PASS** |
| Verdict tổng PR (sau F1) | **PASS with known gap** (gap cũ: không có test integration `forwardWithBearer` — **không** đổi trong delta F1) |

## Mục tiêu revalidation

Xác nhận fix F1 sau review `00750a3` đóng gap «HTTP 5xx token endpoint → xóa phiên» mà không thay đổi phần còn lại của PR.

## (1) Hành vi 5xx / timeout / network vs auth rejection

| Kịch bản | `performWebRefreshFlight` | `refreshWebAccessToken` xóa cookie? |
| --- | --- | --- |
| `exchange` → `null` (fetch fail / timeout) | `reason: 'network'` | **Không** (`shouldClearSessionOnRefreshFailure` chỉ clear khi `reason !== 'network'`) |
| HTTP **≥ 500** (500, 502, 503, …) | `reason: 'network'` (nhánh mới sau F1) | **Không** |
| HTTP 4xx / thiếu `access_token` / `invalid_grant` | `reason: 'rejected'` | **Có** |
| Verify JWT / subject mismatch | `reason: 'rejected'` | **Có** |

Code: `apps/web/src/oidc/refresh.ts` — sau `if (!result) return network`, thêm `if (result.status >= 500) return network` trước nhánh `rejected`.

## (2) Phần còn lại PR không đổi (delta F1)

```text
git diff --name-only 00750a3..0057baf08ae311234ef06a7c7ae1e42d7ff699aa
apps/web/src/oidc/refresh.ts
apps/web/tests/refresh-flight.test.ts
```

`00750a3` là ancestor của `0057baf`. Không file khác trong delta.

## (3) Test mới — 5xx / timeout / null exchange

| Test | File | Kết quả local |
| --- | --- | --- |
| «refresh IdP HTTP 5xx keeps session (network), not rejected» | `refresh-flight.test.ts` | PASS — loop 500, 502, 503 → `reason: 'network'` |
| «refresh IdP timeout (exchange null) is network like transport failure» | `refresh-flight.test.ts` | PASS — `exchange` trả `null` sau delay |
| «refresh IdP network failure is network, not rejected» | (đã có) | PASS |
| «refresh auth rejection is rejected (invalid_grant)» | (đã có) | PASS — 400 `invalid_grant` → `rejected` |

Lệnh local (sau `pnpm install`, `pnpm --filter @ticket/web-session build`):

```bash
cd apps/web && pnpm exec tsx --test tests/refresh-flight.test.ts
# 8/8 pass, duration ~225ms
```

CI job `web` trên SHA `0057baf` cũng chạy full `apps/web` test suite — **success** (xem evidence).

## (4) CI trên SHA `0057baf`

```text
./scripts/gh-dod-evidence.sh 640
repo=hangndat/ticket-solution pr=640
head.sha=0057baf08ae311234ef06a7c7ae1e42d7ff699aa
state=open mergeable=true
--- check-runs (REST) ---
ci	completed	success
turbo-persist	completed	success
mobile	completed	success
backend	completed	success
web	completed	success
portal	completed	success
changes	completed	success
(d5-*, database-isolation: skipped)
```

## Security (phạm vi F1)

- Không mở rộng surface: chỉ phân loại lỗi IdP tạm thời là `network` thay vì `rejected`.
- Auth failure (4xx, grant invalid, verify fail) vẫn clear session — không regression.
- **PASS** cho tiêu chí security #2 trong checklist gốc (5xx/unreachable không đăng xuất).

## Kết luận

| Hạng mục | Verdict |
| --- | --- |
| F1 — AC Issue #630 (5xx giữ refresh cookie / không logout) | **PASS** |
| Delta chỉ 2 file | **PASS** |
| Test 5xx / timeout / null | **PASS** |
| CI xanh trên `0057baf` | **PASS** |
| Gap còn lại (ngoài F1) | Test integration BFF `forwardWithBearer` — giữ **known gap** như review `00750a3`; không chặn merge nếu coordinator chấp nhận gap đó |

**Không merge** trong session reviewer. Không sửa code PR feature.
