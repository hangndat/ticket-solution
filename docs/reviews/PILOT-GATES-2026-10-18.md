# Pilot gates close-out — 2026-10-18

User: **"làm hết đi"** (sau deploy D12 + ops credential fix).

## Đã làm

| Gate | Kết quả | Evidence |
| --- | --- | --- |
| On-call RUNBOOK §6.1 | **Điền** | Primary/Secondary/Owner = Hang Nguyen Dat · `hangndat@gmail.com` (MVP sole operator) |
| APNs ACCEPTED (sandbox) | **PASS** | Worker AuthKey → `api.sandbox.push.apple.com` HTTP 200 · `providerRef=0c6b7c8d-98d3-4b43-adb6-5f3ce3aac959` · body `Pilot DELIVERED 07:06:41` · token prefix `3f9d99d9` · env `sandbox` |
| APNs DELIVERED (device) | **PASS (prior)** | [D5-APNS-DEVICE-UAT-STATUS.md](./D5-APNS-DEVICE-UAT-STATUS.md) 2026-10-17 trên cùng device/token class; session này reconfirm ACCEPTED, không screenshot NC lại (axe = Simulator only) |
| Email resend sau credential fix | **PARTIAL** | Outbox requeue: `455090a7-…` → `ACCEPTED` (Mailpit); `a3016a04-…` → `FAILED` `ticket recipient email is missing` (payload thiếu email) |
| Postfix trên VPS | **Installed** | `postfix-3.5.8` active · `inet_interfaces=loopback-only` |
| Compose `SMTP_URL` override | **Patched on VPS** | `${SMTP_URL:-smtp://mailpit:1025}` trong `/opt/vemoki/src/infra/deploy/compose.yaml` |
| SMTP internet (Porkbun 587) | **BLOCKED** | Outbound :25 timeout; :587 tới `smtp.porkbun.com` mở; **không có** `SMTP_USER`/`SMTP_PASS` trên host/local secret files → không auth relay. SPF hiện `include:_spf.porkbun.com` |
| TestFlight upload | **IN PROGRESS / gap** | ASC API OK (app id `6823694490`); Issuer+Key env có; local `expo prebuild` + `pod install` chạy; **không** EAS Cloud |

## SMTP — bước còn lại (cần secret operator)

1. Tạo mailbox `@vemoki.com` trên Porkbun (hoặc SMTP submission user).
2. Thêm vào `/opt/vemoki/.env` (không commit):
   - `SMTP_URL=smtp://USER:PASS@smtp.porkbun.com:587`
   - `SMTP_FROM=noreply@vemoki.com`
3. `set -a; . /opt/vemoki/.env; set +a` rồi  
   `docker compose --env-file /opt/vemoki/.env up -d --no-deps --force-recreate api worker`
4. Smoke: issue vé / CS resend → `notifications.state=ACCEPTED` và inbox thật (không chỉ Mailpit).
5. Optional: tắt `mailpit` service khi SMTP live ổn định.

## Email DEAD lịch sử

| Notification | Outcome sau requeue |
| --- | --- |
| `455090a7-d0d8-4c20-8b3a-c26842d7512e` | `ACCEPTED` (Mailpit) |
| `a3016a04-c475-4629-b1fe-6816d608fd9a` | `FAILED` — thiếu recipient email trên ticket payload (không phải SMTP) |

## Store submit

- Policy: **local** archive/export/upload only (`BLUA62D52G`).
- App Store Connect API: Key `KHT3SAL2FS` + Issuer set trên máy này.
- Production App Store **Review submit** vẫn tách khỏi TestFlight Internal upload — ghi riêng khi IPA processing xanh.

## Pilot ready?

**Chưa** — thiếu SMTP internet evidence (Porkbun creds). Các cổng khác: on-call điền, APNs ACCEPTED (+ DELIVERED prior), deploy tip main, một email pipeline ACCEPTED qua Mailpit.
