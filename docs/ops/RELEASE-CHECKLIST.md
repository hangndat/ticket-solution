# Checklist phát hành (MVP / pilot)

Theo dõi trạng thái store **riêng**: submitted · approved · available. Build thành công ≠ đã phát hành.

## Trước merge vào `main`

- [ ] PR một ownership slice; CI `check` + `database-isolation` xanh
- [ ] Không secrets / `.env` thật trong diff
- [ ] Contract/OpenAPI: `pnpm --filter @ticket/api openapi` và `git diff --exit-code apps/api/openapi.json` khi đụng API
- [ ] Review DoD Cursor (≠ implementer) pass khi Issue yêu cầu

## Trước pilot kỹ thuật

- [ ] RLS / authz / race: Issue #24 evidence
- [ ] `./scripts/d5-business-restore-drill.sh` → `D5_BUSINESS_RESTORE_PASS` + artifact JSON
- [ ] `./scripts/d5-load-baseline.sh` chạy thật; ghi số đo + hạn chế phần cứng; **không** che bằng demo pass
- [ ] Observability: overlay smoke `./scripts/d5-observability-smoke.sh`; BE `/metrics` khi đã có
- [x] Runbook on-call §6.1 đã điền (Hang Nguyen Dat · hangndat@gmail.com) — 2026-10-18
- [x] O06: retention/region/SLA **đã chốt** 2026-10-18 (xem `O06-OPTIONS.md` + DECISION-LOG O06) — privacy copy phải khớp số; drill RPO/RTO đích trước khi công bố SLO
- [ ] R-INT: ADR-17 + `pnpm test:rint-host` + `./scripts/rint-outbox-recovery.sh` + ma trận [`R-INT-MATRIX.md`](./R-INT-MATRIX.md); APNs device ACCEPTED/DELIVERED có evidence (`docs/reviews/D5-APNS-DEVICE-UAT-STATUS.md` + `PILOT-GATES-2026-10-18.md`); **SMTP internet** còn thiếu Porkbun mailbox creds
- [ ] Platform security-config freeze: `./scripts/platform-security-config-smoke.sh` (invite 48h, support ≤1h, MFA step-up ≤15m, ACR=2)
- [ ] Keycloak assurance: clients platform/admin; mobile **không** nhận `ticket-platform-api`; `./scripts/platform-keycloak-assurance-smoke.sh`
- [ ] Platform DB roles: `ticket_platform_*` NOBYPASSRLS, tách pool tenant (init-db)
- [ ] Operator bootstrap offline documented; không public bootstrap / demo escalation

## iOS / store (Issue #26 — ngoài scope #25)

- [x] Archive **local** Xcode team `BLUA62D52G` — **không** Expo/EAS Cloud Build (2026-10-18 · `Vemoki.xcarchive` + IPA)
- [x] TestFlight: **submitted** upload 2026-10-18 (Delivery UUID `feb92136-…`) — Processing/available ghi ASC; Internal group khi build xanh
- [ ] Device UAT: camera, deep link, push, offline ví, revoke (push ACCEPTED/DELIVERED đã có evidence riêng)

## Sau deploy VPS

- [ ] Health public + API + OIDC discovery
- [ ] Admission (nếu bật) fail-closed đã thử
- [ ] Backup job thật + restore drill trên staging đồng hình

## Cấm

- Claim capacity 50k concurrent khi chưa benchmark hạ tầng đích
- Mở Gate trên restore thiếu đối soát
- Đóng Issue chỉ vì `worker_done` / demo script xanh
