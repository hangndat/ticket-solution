# D13 iOS — plain-language account deletion / Privacy copy (#328 follow-up)

| Trường | Giá trị |
| ------ | ------- |
| Issue | #328 follow-up (plain UI) · liên quan #316 SDK (artifact riêng) |
| Role | `ios` — `docs/agents/roles/ios.md` |
| Architecture impact | Không — copy + evidence |
| Ngày | **2026-10-18** |
| Base | `origin/main` @ `723d46dd218e10f988772509c0ca4a85cfca8929` (PR #313 merged `c70631dd46d956b3b89917a12668970732800466`) |
| Behavior SHA | xem tip commit trên PR (cập nhật sau push) |

## Mục tiêu

User-visible copy VI/EN cho luồng yêu cầu xóa tài khoản + liên kết Privacy:

- Giải thích: đã nhận yêu cầu; xử lý ≤30 ngày; có thể giữ bản ghi kiểm toán; **không** xóa ngay.
- Loại khỏi UI: `O06`, `ACK≠erasure`, `anonymize`, raw state enum, `requestId`, `PolicyStatus`, debug `ackMeansDeleted: …`.
- Giữ API authenticated thật (`/v1/me/account-deletion-requests`); không mock auth; không đổi contract.

## Thay đổi (paths)

| Path | Thay đổi |
| ---- | -------- |
| `apps/mobile/src/account-deletion/account-deletion-copy.ts` | Explainer / confirm / status → plain VI+EN |
| `apps/mobile/src/account-deletion/account-deletion-flow.ts` | Thông báo lỗi user-facing plain VI+EN |
| `apps/mobile/src/account-deletion/account-deletion-panel.tsx` | Bỏ debug `ackMeansDeleted`; nhãn retry/unavailable plain |
| `apps/mobile/src/screens/account.tsx` | Helper Privacy link plain VI/EN |
| `apps/mobile/src/account-deletion/account-deletion-flow.test.ts` | Guard jargon + “không claim đã xóa”; không mirror chuỗi cố định |

## Checks

```text
node --experimental-strip-types --test \
  apps/mobile/src/account-deletion/account-deletion-api.test.ts \
  apps/mobile/src/account-deletion/account-deletion-flow.test.ts
→ 14 pass
```

## Gaps (known)

- Chưa E2E/device signed-in UAT trên tip này (cần session thật).
- Chưa archive/upload ASC (chờ merge + review độc lập).
- Identity `Notice` trên Account vẫn có field kỹ thuật (subject/issuer) — ngoài scope deletion copy; không mở rộng UX.

## Verdict implementer

Copy user-facing deletion/Privacy đạt plain language theo tiêu chí #328; API path không đổi. Review độc lập do coordinator spawn sau PR.
