# Revalidate DoD — PR #641 / Issue #632 (sau fix `cs-export`)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Persona **James · dod+sec** · `task_693265140bed` / `ctx_a3af63c8a434` — **≠** implementer Colin |
| Phạm vi revalidate | Commit fix **`c4fc1d2a22419b64d756c5d515d662fff2423157`** so với review FAIL trước tại **`5822874f51e792e3cd04d25150fb23d951683a2f`** |
| Artifact gốc | `docs/reviews/MPR-PR641-REVIEW-2026-10-21.md` trên branch `origin/hangndat/review-641-dodsec` (FAIL `cs-export`) |
| Verdict revalidate | **PASS** (DoD + Security giữ nguyên kết luận security từ review gốc) |

## SHA

```text
git rev-parse HEAD
→ c4fc1d2a22419b64d756c5d515d662fff2423157
```

Khớp PR tip và `./scripts/gh-dod-evidence.sh 641` → `head.sha=c4fc1d2a22419b64d756c5d515d662fff2423157`.

## Diff `5822874..c4fc1d2`

```text
git diff --stat 5822874..c4fc1d2
→ packages/backend/src/outbox.ts | 4 ++++
  1 file changed, 4 insertions(+)
```

**Chỉ** `outbox.ts` — đúng yêu cầu revalidate.

### Thay đổi hành vi `deliverTicketIssuedApns`

Sau transaction chuẩn bị `jobs`, thêm:

```typescript
if (jobs.length === 0) {
  return;
}
const apns = options.apns;
if (!apns) {
  throw new Error('apns_misconfigured');
}
```

**Trước fix (`5822874`):** Kiểm tra `apns` chạy **luôn** sau tx, kể cả `jobs === []` → với `apns: null` (test fail-closed có chủ đích) path “không còn push pending” (không device / đã ACCEPTED hết) vẫn `failed: 1` — vi phạm `cs-export` assertion `no-device path must not fail-closed`.

**Sau fix:**

| Tình huống | Kết quả |
| --- | --- |
| Không owner / không device | `jobs = []` → return sớm; **không** ném `apns_misconfigured` |
| Có device, tất cả push đã `SENT`/`ACCEPTED` | `jobs = []` → return sớm |
| Có device + job push pending + `apns: null` | Vẫn fail-closed: trong tx (khi `devices.length > 0`) **hoặc** sau tx khi `jobs.length > 0` → `apns_misconfigured` |
| Có job pending + adapter hợp lệ | Loop `apns.send` như trước — **không** mất push |

Fail-closed khi **có token và cần gửi** vẫn giữ (hai lớp: trong tx line ~711–713 và sau tx line ~764–767 khi `jobs.length > 0`).

## CI (exact SHA)

```text
./scripts/gh-dod-evidence.sh 641
→ state=open mergeable=true
→ backend completed success
→ changes completed success
→ ci completed success
→ database-isolation (cs-export) completed success
→ database-isolation (backend-fences) completed success
→ database-isolation (issue-gate) completed success
→ database-isolation (approval-config-lifecycle) completed success
→ database-isolation (n1-email) completed success
→ (toàn bộ shard database-isolation trên SHA) completed success
→ web/portal/mobile/d5-* skipped (path filter)
```

Đã chờ CI xong: `gh pr checks 641 --watch` (run `39474837830`).

## Local tests (SHA `c4fc1d2`)

Sau `pnpm install`, `pnpm --filter @ticket/contracts build`, `pnpm --filter @ticket/backend build`:

| Lệnh | Kết quả |
| --- | --- |
| `node --test packages/backend/test/cs-export.test.cjs` | **1/1 pass** (~7.5s) |

**Chưa chạy local:** full `pnpm test:db` / chạy song song nhiều file Docker cùng lúc.

## Ghi nhận flake (từ worker trước)

Implementer báo có thể flake khi chạy **song song** nhiều file test Docker trên máy dev. **Phiên revalidate này:** chỉ chạy đơn lẻ `cs-export.test.cjs` (pass); CI matrix đầy đủ trên SHA mới **xanh một lần** — **không reproduce** flake cụ thể (không có log failure xen kẽ / race port DB trong session này). Nếu flake tái diễn, nghi ngờ contention Postgres/MinIO container khi parallel `node --test` nhiều shard — theo dõi qua CI là nguồn chính.

## Kết luận revalidate

Regression `cs-export` tại `5822874` **đã được sửa** bằng early return khi không có job push; AC Issue #632 (test gaps + APNs H2) **đạt** trên CI + local spot-check. **PASS** — sẵn sàng merge từ góc DoD (reviewer không merge).
