# D12 — Release GO / NO-GO (Issue #296)

**Ngày:** 2026-10-18  
**Tip `origin/main` đối chiếu drills:** `d7fba8bbcc7d082ed9287e5c2966e72cd2700cba`  
**Checklist nguồn:** [`docs/ops/RELEASE-CHECKLIST.md`](../ops/RELEASE-CHECKLIST.md) · O06: [`O06-OPTIONS.md`](../ops/O06-OPTIONS.md)  
**Epic:** [#293](https://github.com/hangndat/ticket-solution/issues/293) · Task: [#296](https://github.com/hangndat/ticket-solution/issues/296)  
**Verdict tổng:** **NO-GO pilot / production** — local drills + O06 policy đủ một phần; blocker vận hành/store còn cần **ủy quyền user**.

```yaml
productionClaim: false
pilotReadyClaim: false
```

## Đối chiếu RELEASE-CHECKLIST vs tip SHA

### Trước merge vào `main` (process)

| Hạng mục | Tip `d7fba8b…` | Ghi chú |
| --- | --- | --- |
| PR một ownership + CI xanh | Theo từng PR lịch sử | Không chứng minh mọi PR mở D12 đã xanh |
| Không secrets trong diff | Docs-only #296 | |
| OpenAPI sync khi đụng API | N/A coordinator docs | |
| DoD Cursor ≠ implementer | Bắt buộc trước Hoàn thành #296 | Reviewer độc lập sau PR |

### Trước pilot kỹ thuật

| Hạng mục | Trạng thái | Evidence / gap |
| --- | --- | --- |
| RLS / authz / race (#24) | Partial lịch sử | Không re-run trong #296 |
| `d5-business-restore-drill` | **PASS local** trên tip trên | [D12-LOCAL-DRILLS.md](./D12-LOCAL-DRILLS.md) · `productionClaim: false` |
| `d5-load-baseline` | **PASS local** trên tip trên | Cùng artifact · hardware-bound M4 Max 14c/36GB |
| Observability overlay smoke | Không re-run #296 | Script có; BE `/metrics` lịch sử D5 |
| Runbook on-call giả định | **Docs cập nhật** | [`RUNBOOK.md`](../ops/RUNBOOK.md) §6.1 — template người **còn trống** (không bịa tên) |
| O06 retention/region/SLA | **Đã chốt** 2026-10-18 | #292 · `O06-OPTIONS.md` |
| R-INT ADR-17 + recovery scripts | Pass script lịch sử | SMTP/APNs **live** vẫn Unknown (R15/R16) |
| Platform security-config / Keycloak assurance / DB roles | Scripts có | Chưa claim prod freeze trong #296 |
| Operator bootstrap offline | Documented RUNBOOK §7 | Không chạy bootstrap prod |

### iOS / store

| Hạng mục | Trạng thái |
| --- | --- |
| Archive local `BLUA62D52G` | Evidence S4/S5 docs lịch sử — **không** thay store submit |
| TestFlight submitted/approved/available | Trạng thái store **riêng** — chưa đóng GO |
| Device UAT APNs | Sandbox DELIVERED có ([D5-APNS-DEVICE-UAT-STATUS.md](./D5-APNS-DEVICE-UAT-STATUS.md)); **APNs production** chưa |

### Sau deploy VPS

| Hạng mục | Trạng thái |
| --- | --- |
| Health public + OIDC discovery trên host đích | **Chưa** trong #296 (không deploy) |
| Admission fail-closed trên edge prod | Caddy example local; chưa deploy admission |
| Backup job + restore trên staging đồng hình | Local dump-point only |

## Blocker còn cần ủy quyền user

Các mục dưới **cấm** agent tự làm trong scope #296 / Epic #293 nếu thiếu lệnh ủy quyền rõ:

| # | Blocker | Vì sao chặn GO | Ủy quyền cần |
| --- | --- | --- | --- |
| 1 | **Deploy VPS / prod** | D10-S5-T3 và siblings ghi N/A — chưa authorize deploy tip D12 | Lệnh rõ “ủy quyền deploy prod” + host/env |
| 2 | **SMTP live** (internet outbound) | R-INT R15 Unknown; Mailpit ≠ delivery thật | Cấu hình SMTP prod + smoke gửi thư thật (không commit secrets) |
| 3 | **APNs production** | Device UAT sandbox PASS; `aps-environment=production` / topic prod chưa evidence | Key/prod push + device UAT production |
| 4 | **Store submit** (ASC / App Store) | Outside #25/#296; build ≠ submitted | Ủy quyền submit + metadata final |

## Sibling D12 (không đóng bởi #296)

| Issue | Scope | Quan hệ GO |
| --- | --- | --- |
| [#294](https://github.com/hangndat/ticket-solution/issues/294) | Web privacy O06 + Origin CSRF + invite | Privacy copy khớp O06 trước pilot PII |
| [#295](https://github.com/hangndat/ticket-solution/issues/295) | BE anonymize + RLS/MFA verify | Retention jobs / release-verify |
| [#293](https://github.com/hangndat/ticket-solution/issues/293) | Epic đóng gap | Chỉ Hoàn thành khi DoD Epic + milestone gates đủ |

## Kết luận

- **GO local ops evidence (restore + load) trên tip `d7fba8b…`:** có, với `productionClaim: false`.
- **GO pilot cửa sổ Gate / production:** **NO-GO** cho đến khi (a) template on-call điền người thật, (b) sibling #294/#295 + DoD, (c) bốn blocker ủy quyền trên được user mở và có evidence exact-SHA riêng.
- Tài liệu này **không** tuyên bố pilot ready hay production ready.
