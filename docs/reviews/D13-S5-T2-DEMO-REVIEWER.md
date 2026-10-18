# D13 S5-T2 — Provision / verify demo reviewer trên prod

| Trường | Giá trị |
| ------ | ------- |
| Issue | [#329](https://github.com/hangndat/ticket-solution/issues/329) · Parent Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) / Story [#309](https://github.com/hangndat/ticket-solution/issues/309) |
| Role | `product-ba` (+ coordinator ops IdP) · `docs/agents/roles/product-ba.md` |
| Architecture impact | **Không** — ops IdP demo account + BA copy |
| Ngày (UTC) | 2026-10-18 |
| Docs tip SHA | `9959e04e66a1d3e2d078fbada3ac95f0ce1d3641` (branch tip tại commit cite) |
| Deploy marker VPS (đọc) | `0a65f3c2f2d51357ee1a6270151d279758188fb7` (`/opt/vemoki/deployed-sha.txt` — không suy = tip binary store) |
| Cấm | Commit mật khẩu / client secret; EAS Cloud; submit/store mutate; deploy dịch vụ ngoài IdP user provision |

## Outcome

Hai cặp tài khoản attendee/staff **đăng nhập được trên prod IdP** (`https://auth.vemoki.com/realms/ticket`). Cặp fixture đã gắn đủ dữ liệu app (vé ACTIVE + `gate.confirm`) — **đây là cặp ASC Sign-in required khuyến nghị**. Cặp `review-*@vemoki.com` đã tạo trên IdP + seed staff; attendee `review-*` chưa có vé ACTIVE riêng (dùng fixture cho ví vé / quét demo).

Mật khẩu **chỉ** lưu trên VPS (`mode 600`) và paste ASC UI — **không** có trong git.

## Accounts (placeholders — không phải secret)

### A) ASC primary (end-to-end app path đã verify)

| Role | Username / email | Password | App evidence (prod DB) |
| ---- | ---------------- | -------- | ---------------------- |
| Attendee | `attendee@example.com` | `[ASC only — xem secret file / fixture known]` | `subject` khớp Keycloak `78f7d158-…`; **1** ticket `ACTIVE` trên tenant `uat-device` |
| Staff | `staff@example.com` | `[ASC only — xem secret file / fixture known]` | `subject` khớp Keycloak `d206e999-…`; membership `STAFF` + event assignment `{gate.confirm,gate.undo}` trên `uat-device` |

Fixture password values vẫn là các giá trị đã công bố nội bộ trong `docs/asc/app-review-notes.md` §A / realm import (`attendee-demo` / `staff-demo`) — đã **reset + ROPC OK** trên prod trong đợt này. Staff **không** còn `CONFIGURE_TOTP` required action.

### B) Dedicated review emails (IdP + staff seed)

| Role | Username / email | Password | App evidence |
| ---- | ---------------- | -------- | ------------ |
| Attendee | `review-attendee@vemoki.com` | `[ASC only — VPS secret file]` | IdP user enabled + `emailVerified`; app `users` row (issuer prod); **chưa** ticket ACTIVE riêng |
| Staff | `review-staff@vemoki.com` | `[ASC only — VPS secret file]` | IdP OK; membership `STAFF` + `{gate.confirm,gate.undo}` trên `uat-device` |

## Operator how-to (paste ASC — không commit password)

1. SSH host deploy (`VEMoki_SSH_HOST` / alias máy local) → đọc file:
   - Path: `/opt/vemoki/secrets/app-review/asc-sign-in-required.txt` (mode `600`)
   - Keys: `REVIEW_*` và `FIXTURE_*` (KEY=value)
2. ASC → App Review Information → **Sign-in required**:
   - User name = `FIXTURE_ATTENDEE_EMAIL` (khuyến nghị) **hoặc** `REVIEW_ATTENDEE_EMAIL`
   - Password = tương ứng từ file
   - Notes thêm 1 dòng staff: `Staff scanner: <email> / <password> (Camera required).`
3. Sau mỗi vòng App Review: xoay mật khẩu (`kcadm.sh set-password`) + cập nhật file secret + ASC; **không** mở PR chứa password.
4. Cấm escalate demo thành platform owner / `ticket-platform-*` audience.

## IdP verify commands (đã chạy — không in token/secret)

```text
# Trong network Keycloak container: ROPC ticket-web → 200 access_token
review_attendee ROPC_OK
review_staff    ROPC_OK
fixture_attendee ROPC_OK
fixture_staff    ROPC_OK

# kcadm (session admin trên container): users enabled, emailVerified, requiredActions=[]
# Realm issuer live: https://auth.vemoki.com/realms/ticket
```

OIDC discovery HTTP **200** (quan sát worker): `https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration`.

## Cross-check App Review notes (`docs/asc/app-review-notes.md`)

| Claim trong notes | Đối chiếu 2026-10-18 | Verdict |
| ----------------- | -------------------- | ------- |
| OIDC Keycloak + PKCE; không Sign in with Apple bắt buộc | Issuer prod khớp; client `ticket-mobile` public+PKCE trong realm | OK |
| Account deletion ≤30d anonymize + audit 730d + Guideline 5.1.1(v) | `https://vemoki.com/privacy` HTTP 200; copy O06 «anonymize ≤ 30 ngày» / «Audit log: TTL 730 ngày» | OK |
| Camera usage string gate scan | Khớp listing / notes (không đổi trong task này) | OK |
| Demo fixture attendee/staff | Tồn tại trên **prod** IdP; ROPC OK; staff hết TOTP gate | OK — cập nhật §B |
| Paste credential chỉ ASC | Secret file VPS; placeholders trong git | OK |
| Operator paste khi có binary TestFlight | Binary/TestFlight vẫn ngoài task; paste ASC **chưa** làm trong session này | Known gap (ops ASC UI) |

## Gaps / không claim

- **Chưa** paste vào ASC UI (cần binary Review / TestFlight + operator).
- **Chưa** device/camera smoke trên cặp demo (S4-T3 / S5 device).
- `review-attendee@vemoki.com` chưa có vé ACTIVE — ASC primary dùng fixture attendee.
- Không deploy stack; không submit store; không xoay `ticket-web` client secret.

## Acceptance checklist (#329)

- [x] Hai tài khoản attendee/staff hoạt động trên prod IdP (ROPC OK)
- [x] Attendee có path ví vé (fixture ACTIVE ticket); staff có `gate.confirm` (fixture + review-staff)
- [x] Evidence docs không chứa mật khẩu; how-to paste ASC
- [x] Cross-check App Review notes vs privacy/O06
- [ ] Operator paste ASC khi có binary (ngoài session docs — ghi rõ)
- [ ] DoD reviewer độc lập exact-SHA khi Chờ duyệt
