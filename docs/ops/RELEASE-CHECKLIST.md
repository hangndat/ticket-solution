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
- [ ] Runbook đã đọc bởi on-call giả định
- [ ] O06: đã chọn hướng retention/region/SLA **trước** ingest user thật (xem `O06-OPTIONS.md`) — chưa chốt số thì không bịa

## iOS / store (Issue #26 — ngoài scope #25)

- [ ] Archive **local** Xcode team `BLUA62D52G` — **không** Expo/EAS Cloud Build
- [ ] TestFlight: submitted / approved / available ghi riêng
- [ ] Device UAT: camera, deep link, push, offline ví, revoke

## Sau deploy VPS

- [ ] Health public + API + OIDC discovery
- [ ] Admission (nếu bật) fail-closed đã thử
- [ ] Backup job thật + restore drill trên staging đồng hình

## Cấm

- Claim capacity 50k concurrent khi chưa benchmark hạ tầng đích
- Mở Gate trên restore thiếu đối soát
- Đóng Issue chỉ vì `worker_done` / demo script xanh
