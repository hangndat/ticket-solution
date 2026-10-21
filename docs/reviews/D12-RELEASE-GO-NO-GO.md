# D12 — Release GO / NO-GO (cập nhật sau deploy)

**Ngày đối chiếu:** 2026-10-18 (sau user **deploy đi** + **tiếp tục đi**)  
**Tip đã deploy VPS:** `0a65f3c2f2d51357ee1a6270151d279758188fb7`  
**Evidence deploy:** [D12-DEPLOY-PROD-2026-10-18.md](./D12-DEPLOY-PROD-2026-10-18.md)  
**Checklist:** [`docs/ops/RELEASE-CHECKLIST.md`](../ops/RELEASE-CHECKLIST.md) · O06: [`O06-OPTIONS.md`](../ops/O06-OPTIONS.md)  
**Epic:** [#293](https://github.com/hangndat/ticket-solution/issues/293)

```yaml
productionClaim: false
pilotReadyClaim: false
deployedTipSha: 0a65f3c2f2d51357ee1a6270151d279758188fb7
```

## Verdict

| Mức | Trạng thái |
| --- | --- |
| Code / acceptance D12 coding (#294–#296) | **DONE** trên `main` |
| Deploy tip D12 lên VPS + health/OIDC/privacy | **DONE** (evidence trên) |
| **Pilot ready / production ready** | **NO-GO** — còn device APNs DELIVERED, on-call người thật, store (nếu cần); SMTP internet **đã bật** (evidence 2026-10-21) |

## Cổng đã đóng

| Gate | Evidence |
| --- | --- |
| O06 chốt số | #292 / DECISION-LOG |
| Privacy live 200 + copy O06 | `GET /privacy` |
| D12 web/BE/coord merge + DoD | PR #297–#299 |
| Deploy VPS tip `0a65f3c…` | D12-DEPLOY-PROD |
| Migrate O06 anonymize | Applied trên prod |
| Keycloak healthy + OIDC | Recreate sau realm sync |
| `TICKET_CREDENTIAL_KEY` trong api/worker | Recreate sau source `.env` (len 64) |
| APNs key mount + `APNS_ENABLED=true` / production | Worker inspect |

## Blocker còn lại (cần user / ops)

| # | Blocker | Ghi chú |
| --- | --- | --- |
| ~~1~~ | ~~**SMTP internet**~~ | **Đóng 2026-10-21:** worker `SMTP_URL` Porkbun; Keycloak `kcadm` + `realm-ticket.prod.json`; smoke Keycloak `execute-actions-email` HTTP 204 + worker send OK → `hangndat@gmail.com`. DNS: SPF `include:_spf.porkbun.com`, DKIM `default._domainkey`, DMARC `p=quarantine`. Chi tiết: [D12-SMTP-KEYCLOAK-2026-10-21.md](./D12-SMTP-KEYCLOAK-2026-10-21.md). |
| 2 | **APNs device DELIVERED** | Gateway prod đã bật; cần UAT thiết bị signed / TF production topic. |
| 3 | **On-call Gate** | Điền người/kênh vào RUNBOOK §6.1 (template sẵn). |
| 4 | **Store submit** | Ủy quyền ASC riêng nếu cần phân phối rộng. |
| 5 | **Resend email DEAD** | 2 notification email DEAD lịch sử (credential trống) — CS resend sau khi key đã nạp. |

## Local drills (không = prod SLO)

Vẫn: [D12-LOCAL-DRILLS.md](./D12-LOCAL-DRILLS.md) `productionClaim: false` trên tip drills cũ `d7fba8b…`.
