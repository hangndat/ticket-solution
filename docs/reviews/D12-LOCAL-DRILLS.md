# D12 — Local restore + load drills (Issue #296)

**Ngày chạy:** 2026-10-18T06:17Z–06:22Z (UTC)  
**Tip SHA tại lúc chạy:** `d7fba8bbcc7d082ed9287e5c2966e72cd2700cba` (`origin/main` = docs O06 #292)  
**Branch tài liệu:** `hangndat/hangndat-d12-coord-release-gates` · Parent Epic [#293](https://github.com/hangndat/ticket-solution/issues/293) · Task [#296](https://github.com/hangndat/ticket-solution/issues/296) · Run `run_f4516ebdd968`  
**Ownership:** coordinator docs/ops · **không** deploy / SSH secrets / store

```yaml
productionClaim: false
```

## Phần cứng (hạn chế)

| Trường | Giá trị |
| --- | --- |
| Model | Mac16,5 |
| CPU | Apple M4 Max · `hw.ncpu=14` |
| RAM | 36 GB (`hw.memsize=38654705664`) |
| OS | macOS 26.5.1 (25F80) · arm64 |
| Runtime | Docker Postgres throwaway + Nest API local + Keycloak `192.168.86.8:8080` + Homebrew k6 |

Số đo chỉ ràng buộc máy này. **Không** suy ra capacity VPS / SLO production / RPO continuous ≤15 phút.

## 1. Business restore — `./scripts/d5-business-restore-drill.sh`

```text
D5_BUSINESS_RESTORE_PASS tenants=2 events=4 kid=local-v1 crypto=1 api_reconnect=1 api_business_read=1
rpo_post_mutation_absent=1 dump_bytes=150768 dump_s=0 restore_s=1 rto_wall_s=1
artifact=docs/reviews/D12-BUSINESS-RESTORE-c41cdafa.json
```

| Gate | Kết quả |
| --- | --- |
| AES-GCM decrypt sau restore | PASS |
| API reconnect + `GET /v1/me/tickets` | PASS |
| Mutation sau backup vắng sau restore | PASS (dump-point RPO method) |
| `productionBackup` / continuous RPO | **false** — không claim |

## 2. Load baseline — `./scripts/d5-load-baseline.sh`

Defaults PRD: 2×20000 tickets (SQL seed) · 50 scanners/event · issue 50/s · confirm 20/s · sustain 60s.  
`D5_LOAD_SKIP_BUILD=1` (dist đã build trong restore drill trên cùng tip).

```text
D5_LOAD_BASELINE_PASS scanners_total=100 issue_ok=3000 issue_rps=50.00 confirm_ok=1201 confirm_rps=20.02
sustain_s=61.0 health=true gate=true inv=true meets_prd=true
artifact=docs/reviews/D12-LOAD-SUMMARY-3a5be02d.json
```

| Metric | Mục tiêu | Kết quả local |
| --- | --- | --- |
| Issue sustained | 50/s × ≥60s | **50.00 rps** · 3000 ok · p95 **34 ms** |
| Confirm sustained | 20/s × ≥60s | **20.02 rps** · 1201 ok · p95 **20 ms** |
| Error rate | ≪0.05 | **0%** |
| Gate scanners | 50/event ×2 | **100** · gate k6 PASS |
| Invariants | quota / check-in / decrypt | **ok** |
| `meetsPrdPilotWithoutCaveat` | honest local gate | **true** (vẫn `productionClaim: false`) |
| Admission S4 | tách script | **không** inlined — xem `./scripts/d5-admission-s4.sh` |

Volume 2×20k = SQL seed; **không** gắn nhãn HTTP RPS cho volume.

## Giới hạn (bắt buộc đọc)

- Không SaaS runtime; không secrets thật; không đụng DB worker khác.
- Không EAS Cloud; không claim production recovery / SLO / opening-shock 50k.
- Local PASS ≠ pilot ready ≠ Epic #293 Hoàn thành.
- Sau commit docs trên branch này, SHA tip PR sẽ khác SHA chạy drill — ghi rõ trong go/no-go và comment PR.

## Artifacts

| File | Nội dung |
| --- | --- |
| [D12-BUSINESS-RESTORE-c41cdafa.json](./D12-BUSINESS-RESTORE-c41cdafa.json) | Restore result + `productionClaim: false` |
| [D12-LOAD-SUMMARY-3a5be02d.json](./D12-LOAD-SUMMARY-3a5be02d.json) | Load summary + hardware + `productionClaim: false` |
| `/tmp/d5-issue25-d12/k6-*.json` | Raw k6 (local only; không commit dump lớn) |
