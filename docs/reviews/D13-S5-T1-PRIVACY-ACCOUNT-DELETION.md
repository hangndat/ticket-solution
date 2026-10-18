# D13-S5-T1 — In-app Privacy + account deletion (iOS)

| Trường | Giá trị |
| ------ | ------- |
| Task | S5-T1 |
| Role | `ios` · `docs/agents/roles/ios.md` |
| Architecture impact | **Không** — dùng API O06 hiện hữu (`POST/GET /v1/me/account-deletion-requests`) |
| Agent | Cursor · `task_309e6a5978a2` / `ctx_284cb2cea2d7` |
| Behavior SHA | `639cde6a8179b3383195fb9d12db85a140307bfc` |
| Tip SHA | `7da8b9a55f55c3f2b65ca810d4e4f71f9443d91d` (+ docs stamp commits; PR HEAD wins) |

## 1. Source verify (trước sửa)

| Hạng mục | Trạng thái |
| -------- | ---------- |
| Module `apps/mobile/src/account-deletion/*` | PRESENT — api / flow / panel / copy / tests |
| Wire vào UI | `AccountScreen` → `SessionScopedAccountDeletionPanel` khi `identity.status === 'verified'` |
| Loading / errors / retry Idempotency-Key | PRESENT (`loading`, `error` retryable refresh|resubmit, `unavailable`) |
| Mock auth production path | **Không** — yêu cầu SessionBoundary verified + bearer thật |
| Link Privacy in-app | **THIẾU** trước Task |
| Copy O06 | **STALE** (“chưa chốt”) trong khi DECISION-LOG O06 **đã duyệt** 18/10/2026 |

## 2. Thay đổi trong PR

1. Thêm `PRIVACY_POLICY_URL` + nút **Chính sách quyền riêng tư** trên Account (`Linking.openURL`) — hiện cả khi OIDC chưa cấu hình.  
2. Cập nhật `accountDeletionExplainer` / policy notes khớp O06 (anonymize ≤30 ngày; ACK ≠ erasure).  
3. Tests `src/account-deletion/*.test.ts` — **14/14 pass**.

## 3. Backend request (thật, không mock)

| Check | Evidence |
| ----- | -------- |
| Unit | `postAccountDeletionRequest` / `getCurrentAccountDeletionRequest` gọi `${API}/v1/me/account-deletion-requests` (+ `/current`) với `Authorization: Bearer` + `Idempotency-Key` |
| Prod route smoke (no auth) | POST → **400**; GET current → **422** — route sống trên `api.vemoki.com` |
| Authenticated end-to-end POST | **Chưa** (cần demo reviewer prod — S5-T2); không mock auth |

## 4. Checks đã chạy

```bash
cd apps/mobile
node --experimental-strip-types --test src/account-deletion/*.test.ts
# → 14 pass
```

Typecheck đầy đủ cần `pnpm install` (worktree thiếu `node_modules`) — limitation ghi nhận; unit deletion không phụ thuộc Expo native.

## 5. Còn lại (ngoài scope / gates)

- Headless sim UAT: **skipped** — sim đang Booted thuộc worker khác (iPhone 17 Pro / D11-236); task cấm dùng sim worker khác. Physical-device + dedicated sim UAT vẫn mandatory trước S4 archive/submit.  
- ASC paste Privacy URL + Nutrition: S3.  
- DoD reviewer độc lập exact SHA trên PR.
