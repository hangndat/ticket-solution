# Production readiness — Architecture audit (Vemoki)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-18 |
| Role | `architect` · [docs/agents/roles/architect.md](../agents/roles/architect.md) |
| Mode | Kiểm tra sự phù hợp + đề xuất ADR/handoff (không coding) |
| Architecture impact | **Có** — readiness hệ thống, topology, ops gates |
| Ownership duy nhất | File này (`docs/plans/PRODUCTION-READINESS-ARCHITECTURE.md`) |
| Base HEAD (worktree) | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| `origin/main` (đối chiếu) | `2416a94b02acb50a5186309aa619c04fec106317` — **ahead** worktree; không suy evidence local đã merge |
| Project #3 snapshot | 2026-10-18 · 126 items · `Hoàn thành` 114 · `Đang làm` 5 · `Sẵn sàng` 3 · `Chờ duyệt` 1 · `Bị chặn` 2 · `Chưa lên lịch` 1 |
| Non-goals | Feature code · commit/push/PR/merge · deploy · cloud · store submit · EAS Cloud · sửa ADR/contracts/root tooling · spawn worker · benchmark/deploy prod |

> **Errata (2026-10-18, [#373](https://github.com/hangndat/ticket-solution/issues/373)):** Snapshot research này **stale một phần**. Nguồn quyết định hiện tại: [`GAP-AUDIT-2026-10-18-INDEX.md`](../reviews/GAP-AUDIT-2026-10-18-INDEX.md). **Không còn mở như claim cũ:** D11 / [#254](https://github.com/hangndat/ticket-solution/issues/254) / ADR-19 triển khai public SoT **đã đóng board**; O06 **đã chốt**; `GET https://vemoki.com/privacy` → **HTTP 200**. **Còn mở:** Navigation O02 theo permission — [#368](https://github.com/hangndat/ticket-solution/issues/368)–[#371](https://github.com/hangndat/ticket-solution/issues/371). Ops release-verify (RLS/MFA/SMTP/restore/load) vẫn **U** khi claim pilot — xem INDEX GAP-OPS-REVAL.

**Kết luận ngắn:** Hệ thống **chưa production ready**. Nhiều Epic D0–D10 **acceptance complete** trên Project #3; **pilot/production** còn thiếu evidence release-grade (backup/restore + load trên hạ tầng phát hành, SMTP outbound **chưa xác minh**, ADR-19 chưa đóng, O06 chưa chốt trước PII). **Không** miễn gate security (RLS/MFA) hay đảo O15 đã duyệt. D5 board Done → camera/APNs/MinIO = **revalidation trước release**, không mở lại như “chưa từng làm” nếu thiếu evidence ngược. Runtime VPS **không** chạm trong Task — nhiều mục **U**.

**Top 15 (§4):** G18 RLS · G17 MFA/Keycloak · G02 backup/restore đích · G05 load-on-target · G03 SMTP outbound · G04 ADR-19 · G01 O06 · G13 staging · G10 metrics/on-call · G06 admission · G11 CSRF invite · G12 O13 · G07 MinIO reval · G08 APNs reval · G14 migrate freeze.

---

## 1. Phạm vi & nguồn

### 1.1 Đã đọc (bắt buộc)

- `AGENTS.md`, [PRD](../PRD.md), [TECHNICAL-DESIGN](../TECHNICAL-DESIGN.md), [DECISION-LOG](../DECISION-LOG.md), [ROADMAP](../ROADMAP.md)
- Ops: [RUNBOOK](../ops/RUNBOOK.md), [RELEASE-CHECKLIST](../ops/RELEASE-CHECKLIST.md), [ENV-MANIFEST](../ops/ENV-MANIFEST.md), [O06-OPTIONS](../ops/O06-OPTIONS.md), [R-INT-MATRIX](../ops/R-INT-MATRIX.md), [PLATFORM-POLICY](../ops/PLATFORM-POLICY.md), ADR-17/18/19
- Deploy: [infra/deploy/README.md](../../infra/deploy/README.md), CI `.github/workflows/ci.yml`
- Evidence tracked: [D5-ISSUE-25-EVIDENCE](../reviews/D5-ISSUE-25-EVIDENCE.md) (commit `54d267ae…`), [D4-TENANT2-PROD-UAT](../reviews/D4-TENANT2-PROD-UAT.md) (`ab68d3a1…`), [D5-APNS-DEVICE-UAT-STATUS](../reviews/D5-APNS-DEVICE-UAT-STATUS.md) (tracked)
- Handoff local **untracked** (đọc, không sửa): ADR-19, `docs/architecture/*`, nhiều `docs/reviews/D11-*`, `D5-PUSH-APNS-WIRED.md`

### 1.2 Trạng thái working tree (evidence)

| Hạng mục | Trạng thái | Ý nghĩa |
| --- | --- | --- |
| Modified tracked | ~17 file (rules, AGENTS, PRD, DECISION-LOG, mobile…) | Dirty — **không** coi là đã integrate |
| Untracked | ~51 path (architecture, ADR-19, D11 DoD, plans…) | Handoff local — **chưa** merge; cite như “local only” |
| Report này | File mới trong ownership | Chỉ output được phép sửa |

### 1.3 Live board (Project #3) — không tin ROADMAP cũ làm Status

| Status | Ví dụ Issue |
| --- | --- |
| Đang làm | #222 D11 Epic · #230/#232 Gate UX · #236 UAT UX · #254 Event server source |
| Sẵn sàng | #233 attendee UX · #245 EventReport O12 · #246 CS email recovery |
| Chờ duyệt | #255 BE public events (ADR-19) |
| Bị chặn | #256 web · #257 iOS (chờ BE #255) |
| Hoàn thành (Epic liên quan) | #6 D5 · #103 D7 · #119 D8 · #134 D9 · #150 D10 |
| Ngoài phạm vi | #7 Android/payment/seat/Wallet |

**Fact:** ROADMAP §1 vẫn ghi D5 “Đang làm”, D7–D10 “Chưa lên lịch” — **lệch Project**. Authority Status = Project #3; ROADMAP là phạm vi/gate lịch sử.

### 1.4 Open PRs (ảnh hưởng readiness — không merge trong Task)

| PR | Chủ đề | Ghi chú readiness |
| --- | --- | --- |
| #261 | BE public events ADR-19 | Unblocks #256/#257 |
| #252 | MinIO cleanstart pin | Ops durability image |
| #247 | O13 marketing host-aware | Cutover apex/`app.` chưa deploy |
| #262 | D11 DoD reval docs | Docs-only |
| #253 | Rename Fun Fest → MFest | Demo naming |

---

## 2. Phân biệt mức hoàn thành

| Mức | Định nghĩa (ROADMAP §1.1 + PRD §12) | Đánh giá 2026-10-18 |
| --- | --- | --- |
| **Code complete** | Impl merge `main` + CI liên quan | **Phần lớn** D0–D10 + nhiều D11 slice — **có** trên board; ADR-19 BE còn PR mở |
| **Acceptance complete** | DoD + review exact-SHA + merge + CI + evidence Issue | **Nhiều Epic D0–D10 = Hoàn thành** trên Project; **không** suy = pilot/prod |
| **Pilot ready** | D5 gate TD: security/capacity/restore có số; device UAT local-signed; runbook; gap nêu rõ | **Chưa đủ** — xem §4 (O06, SMTP, PITR prod, load-on-target, residual device/prod wiring) |
| **Production ready** | Pilot + user data policy (O06) + SMTP/APNs prod path + backup job thật + on-call + không SoT fixture + SLO đo trên hạ tầng đích | **Không** — **chưa xác minh** đủ gate; **cấm** claim |

**Inference:** Board “Hoàn thành” D5–D10 = acceptance theo Issue criteria, **không** tự nâng productionClaim.

---

## 3. Baseline tải & khôi phục (PRD §9) — đối chiếu evidence

Nguồn PRD (baseline thiết kế/test, **chưa** phải SLA khách hàng đã ký):

| Tiêu chí | Mục tiêu PRD | Evidence hiện có | Verdict |
| --- | --- | --- | --- |
| Pilot tải | 2 event × 20.000 vé; 50 scanner/event | [D5-ISSUE-25-EVIDENCE](../reviews/D5-ISSUE-25-EVIDENCE.md) + LOAD-SUMMARY: local Mac 14CPU/36GB, S3 sustained pass, `meetsPrdPilotWithoutCaveat=true` **local** | **Pass local harness** — **chưa** benchmark VPS/prod |
| API p95 | ≤1s @ 50 issue/s + 20 confirm/s | issue p95 ~33ms · confirm ~19ms (cùng artifact) | Pass **môi trường đo** đã ghi; **không** claim prod SLO |
| Tính đúng concurrency | 0 vượt quota / trùng | invariants ok trong load summary | Pass harness |
| Availability | 99,9%/tháng mục tiêu | **Chưa xác minh** monitoring/SLA tháng | Gap |
| RPO ≤15 phút / RTO ≤2 giờ | Diễn tập trước pilot | Business restore drill **local** wall-clock ~1s; `productionClaim: false`; **không** continuous PITR prod | **Chưa đạt claim prod** |
| S4 opening-shock 50k/10s | TD §14 | Admission S4 **isolated** script pass; edge Caddy **chưa deploy** (RUNBOOK) | Partial — **không** claim 50k |

**Nguồn chính thức tham chiếu (claim ngoài repo):**

| Chủ đề | URL | Ngày tra |
| --- | --- | --- |
| PostgreSQL RLS | https://www.postgresql.org/docs/current/ddl-rowsecurity.html | 2026-10-18 |
| Keycloak docs | https://www.keycloak.org/documentation | 2026-10-18 |
| APNs | https://developer.apple.com/documentation/usernotifications | 2026-10-18 |
| Expo local build (cấm Cloud) | https://docs.expo.dev/guides/local-app-development/ | 2026-10-18 |
| Prisma migrate deploy | https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production | 2026-10-18 |

---

## 4. Top 15 gap tác động cao (release gate)

Ký hiệu: **F** fact (path/SHA) · **I** inference · **R** recommendation · **U** chưa xác minh runtime (Task **không** chạm prod).

**Proof limits:** (1) Docs deploy/README = tài liệu lịch sử — **không** khẳng định config VPS hiện tại. (2) Board D5/D7… **Hoàn thành** = acceptance Issue; trước release cần **revalidation** evidence khớp tải/hạ tầng phát hành — không mở lại gap cũ như “chưa từng làm” khi thiếu bằng chứng regression. (3) **Không** đề xuất user miễn RLS/MFA/security hay đảo O15. (4) O06 chặn PII thật / productionClaim — **không** chặn coding độc lập.

| # | Gap | Evidence / note | Rủi ro | P | AC / check cụ thể | Owner | Dep thật | User chốt? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G18 | RLS / platform DB roles NOBYPASSRLS — **release verify** | #24 acceptance; CI `database-isolation`; RELEASE-CHECKLIST (**F**). Reval trên SHA phát hành **U** nếu chưa ghi | Tenant leak | **P0** | (1) `database-isolation` xanh trên commit release (2) Smoke role `ticket_*` NOBYPASSRLS theo init-db (3) Artifact exact SHA | backend + reviewer | CI | Không miễn |
| G17 | Keycloak MFA / client assurance — **release verify** | `platform-keycloak-assurance-smoke`; RELEASE-CHECKLIST (**F**). Prod realm sync **U** | Mobile nhận platform audience; MFA thiếu | **P0** | (1) Smoke vs realm phát hành (2) Mobile **không** audience `ticket-platform-api` (3) Admin/platform OTP bind | ops + backend | Realm file | Không miễn |
| G02 | Backup/restore **trên hạ tầng phát hành** thiếu claim | D5-ISSUE-25 `54d267ae…` local; `productionClaim: false` (**F**) | Mất data; RPO/RTO PRD không chứng minh | **P0** | (1) Drill restore trên staging/VPS **đồng hình** release (2) Ghi RPO/RTO thực đo khớp mục tiêu phát hành (3) Chỉ khi đó mới `productionClaim` | ops | Staging mirror | PITR vs dump — vẫn phải có drill đích |
| G05 | Load evidence **khớp tải phát hành** (không chỉ Mac) | D5-ISSUE-25 local pass; CI không full 2×20k (**F**) | Overcommit | **P0** | (1) `./scripts/d5-load-baseline.sh` (hoặc tương đương) trên env phát hành/staging đồng hình (2) Đạt baseline PRD §9 trên hardware ghi rõ (3) Không quảng cáo capacity ngoài số đo | ops + backend | Staging | Có/không gate cứng — **không** thay evidence |
| G03 | SMTP outbound Internet **chưa xác minh** | deploy README ghi SMTP prod “chưa bật” / Mailpit path (**F** tài liệu lịch sử); R-INT R15 Unknown (**F**); **config VPS hiện tại U** — không khẳng định đang Mailpit | Email invite/ticket không deliver | **P0** | (1) Xác minh observed SMTP config (staging hoặc ops đọc env — ngoài Task này) (2) Outbound smoke: message rời MTA (3) SPF/DKIM nếu gửi `vemoki.com` | ops + backend | DNS | Postal vs Postfix nếu chưa có MTA |
| G04 | ADR-19 public SoT chưa đóng triển khai | O15 **đã chốt** — không mở lại; #255 Chờ duyệt PR #261; #256/#257 Bị chặn (**F**) | Fixture ≠ server | **P0** | (1) DoD+merge #255 (2) Public GET seed 200 (3) Web∥iOS empty/error, không fixture fallback | BE → web∥iOS | OpenAPI | Chỉ lịch sóng — không đảo O15 |
| G01 | O06 retention/region/SLA mở | [O06-OPTIONS](../ops/O06-OPTIONS.md) (**F**) | PII không policy | **P0 policy** | Chọn §8.1 → DECISION-LOG; trước ingest PII | product + legal | — | §8.1 |
| G13 | Staging tách prod | TD §15.1 (**F**); đủ env **U** | Test đụng PII | **P1** | Checklist tách DB/OIDC/Redis/MinIO/secrets; load không trên DB user prod | ops | — | Bắt buộc staging? |
| G10 | Metrics scrape + on-call release | `/metrics` code + local overlay (**F**); scrape/alert trên env phát hành **U** | Mù sự cố | **P1** | Bearer scrape 200; ≥1 alert→RUNBOOK; tên on-call P1 | ops | token | Ai on-call? |
| G06 | Admission edge | RUNBOOK: Caddy example, “chưa deploy” (**F** docs); edge hiện tại **U** | Opening-shock | **P1** | 429+Retry-After qua edge; Gate bypass | ops | nginx | Bật trước burst? |
| G11 | CSRF invite accept (D4 known gap) | D4-TENANT2-PROD-UAT (**F**) — gap đã ghi; fix hoặc chấp nhận có chủ đích | Owner invite UX | **P1** | Accept qua HTTP BFF; Origin hợp lệ không mismatch | web + backend | — | Fix trước pilot owner-invite? |
| G12 | O13 `app.` cutover | Handoff architect local; PR #247; cookie host-only (**F**) | Session/OIDC vỡ | **P1** | DNS+realm+origin+rollback; cấm `Domain=.vemoki.com` | web + coordinator | O13 | Ngày cutover |
| G07 | MinIO — **revalidation** trước release | D4 từng 503 `MINIO_MISCONFIGURED` (**F** lịch sử); #6/D5 wiring docs; PR #252; **VPS hiện tại U** | Export fail | **P1** | Reval: minio-init 0 + CSV READY trên env phát hành — **không** claim “chưa từng wire” | ops | env | — |
| G08 | APNs — **revalidation** trước release | Tracked DELIVERED sandbox (**F** acceptance); prod gateway/TF build khớp **U** | Push venue | **P1** | Reval: token + NC trên build phát hành; ACCEPTED≠DELIVERED giả | ios + ops | key | — |
| G14 | Migrate freeze / rollback cửa sổ event | TD §15 + RUNBOOK freeze (**F**); drill rollback **U** | Gate gãy sau deploy | **P1** | Runbook migrate+rollback; cấm migrate rủi ro giờ Gate trừ hotfix có owner | backend + ops | — | — |

### 4.1 Phụ lục — theo dõi / không mở rộng MVP

| # | Mục | Ghi chú |
| --- | --- | --- |
| A1 | Camera Gate device | D5 Epic Hoàn thành — **reval** trước event nếu build/env đổi; không reopen “chưa làm” thiếu evidence |
| A2 | Redis fail-closed / R-INT recovery | Scripts Pass local; staging reval tùy release |
| A3 | BullMQ sau benchmark | Giữ ADR-17 trừ load-on-target fail có số |
| A4 | D11 UX Stories | Song song ownership; không block ops P0 |
| A5 | Store submit | D10 = prep; cần ủy quyền riêng |
| A6 | O07 custom domain | Sau MVP — đã chốt |
| A7 | SLO 99,9% / dashboard ≤10s | Chưa đo — không công bố |
| A8 | ROADMAP Status drift | Sync từ Project #3 |

**R:** Không đề xuất Android/payment/seat/Wallet (#7).

---

## 5. Audit theo lớp kiến trúc

### 5.1 Topology self-host (ADR-11/16)

| Thành phần | Thiết kế | Evidence / gap |
| --- | --- | --- |
| Nest API + worker | Modular monolith; worker riêng | Deploy README; compose |
| Postgres + RLS | SoT business; transaction-local tenant | #24 acceptance; isolation CI |
| Redis | Cache/admission **không** SoT quota/check-in | ADR-17; rint recovery |
| Keycloak | `auth.vemoki.com` OIDC | Deploy verify login demo; P4 smoke lịch sử |
| MinIO | Private buckets; D4 từng misconfig (lịch sử) | G07 reval release |
| SMTP | ADR-13 self-host; outbound **U** | G03 |
| APNs | Worker trực tiếp; sandbox DELIVERED có tracked | G08 reval release |
| Edge nginx | `vemoki.com` / `api.` / `auth.` | Deploy “đã kiểm tra” health/OIDC — **F** docs; revalidation định kỳ **U** |

### 5.2 Domain / cookie / OIDC

- Cookie **host-only**; cấm `Domain=.vemoki.com` (ENV-MANIFEST, R-INT R9) — **F**.
- O13 tách marketing apex vs `app.` — handoff architect local; cutover **chưa** — Gap G12.
- Không tin `X-Forwarded-*` thô; nginx ghi đè `X-Forwarded-Host` — **F** deploy README.

### 5.3 Contracts / CI

- OpenAPI + `database-isolation` + d5 hardening smoke trên CI — **F** workflow.
- Full load 2×20k **không** trên CI — **F** D5 evidence.
- PR #261 đang đưa public events contract — dependency G04.

### 5.4 Migration / rollback

- `migrate` one-shot Prisma trên VPS — **F** deploy table.
- Expand→backfill→switch→contract + freeze giờ event — **thiết kế TD**; drill rollback prod **U** (G14).

### 5.5 Observability / on-call

- `/metrics` Bearer; overlay Prometheus local — **F** code + scripts.
- Alert → người on-call giờ event — **thiếu** assignment (G10).
- Runbook MVP tồn tại; “không thay playbook production đầy đủ” — **F** RUNBOOK header.

---

## 6. Đề xuất ADR / handoff (không tự đổi ADR)

| Đề xuất | Mục đích | Ai xác nhận |
| --- | --- | --- |
| **ADR-draft: Production backup & PITR** | RPO/RTO đo trên VPS; tần suất dump; restore drill định kỳ; key custody | coordinator + user (O06 region) |
| **ADR-draft: SMTP production (Postal/Postfix)** | Nếu observed chưa có MTA outbound: chọn self-host; bounce handling; không SaaS — **sau** xác minh config thật | user + ops |
| **Giữ ADR-19** (đã chốt O15) | Hoàn tất triển khai #254; không mở lại fixture SoT | — (implement) |
| **Handoff O13** đã có | Cutover DNS/cookie — không deploy trong research | user chọn ngày |
| **Không** ADR BullMQ trừ khi load-on-target fail | ADR-17 đủ MVP | benchmark G05 |

Kết luận thiết kế: **`Cần làm rõ` + `Đề xuất`** — đủ để planner chia Task ops/BE/web/iOS; **không** “Đủ để tuyên bố production”.

---

## 7. Dependency thật (DAG gợi ý cho coordinator)

```text
Release verify (P0, không miễn): G18 RLS + G17 MFA  —— trên SHA phát hành
Evidence hạ tầng phát hành (P0): G02 restore + G05 load  —— env đồng hình (staging/VPS ops; Task này không chạm)
SMTP outbound (P0): G03  —— xác minh observed + smoke (ops)
ADR-19 (P0 implement): #255 → #256 ∥ #257  —— O15 giữ nguyên
O06 (P0 policy): song song  —— chỉ chặn PII / productionClaim

P1 song song: G13 staging · G10 on-call · G06 admission · G11 CSRF · G12 O13 · G07/G08 reval · G14 freeze
D11 UX: song song nếu không conflict path
```

Planner tổng hợp 4 reports khi đủ; thiếu → `pending` + owner.

---

## 8. Quyết định user cần chốt

### 8.1 Gói O06 (chọn một dòng mỗi hàng — không bịa số)

| Hạng mục | Lựa chọn A | Lựa chọn B | Lựa chọn C |
| --- | --- | --- | --- |
| Tài khoản sau xóa yêu cầu | Anonymize ≤ N ngày (user điền N) | Xóa cứng ≤ N ngày | Giữ đến hết khiếu nại vé + N |
| Vé/check-in sau event | Giữ N tháng rồi anonymize | Giữ N năm (đối soát) | Theo pháp lý VN (legal điền) |
| Audit log TTL | = transactional | Dài hơn transactional (N) | Không TTL MVP |
| Vùng dữ liệu | A Single-region VPS (ghi quốc gia) | B Split DB/object | C EU-only / VN-only |
| SLA support | Business-hours | 24/7 trong cửa sổ event | Chỉ email best-effort MVP |
| P1 phản hồi | ≤15 phút | ≤1 giờ | ≤4 giờ |

**AC đóng O06:** một hàng chọn xong → dòng DECISION-LOG “Đã chốt” + cập nhật RUNBOOK § retention; **trước** ingest PII ngoài demo.

### 8.2 Quyết định khác (không miễn security)

1. Pilot demo-realm trước vs bắt buộc G02+G03+G05 trước mở vé ngoài?
2. SMTP: nếu chưa có MTA — Postal vs Postfix? (sau khi ops xác minh observed)
3. Backup: PITR vs dump — **vẫn** drill trên hạ tầng phát hành
4. Wave: ADR-19 vs D11 vs ops evidence (O15 không reopen)
5. O13 cutover ngày?
6. Store submit ủy quyền khi nào?
7. On-call P1: ai / kênh?

**Cấm đề xuất:** miễn G18/G17; đảo O15; tuyên bố capacity/RPO chỉ từ harness Mac.

---

## 9. Giới hạn nghiên cứu này

- Không chạy load/benchmark, không deploy, không đụng DB/simulator worker khác.
- Không đọc secrets `/opt/vemoki/.env` hay `.p8`.
- Không re-verify live `vemoki.com` trong phiên này — deploy README / D4 UAT là evidence lịch sử; trạng thái VPS hiện tại **một phần U**.
- Untracked reviews (D11, D5-PUSH-APNS-WIRED) **không** được suy đã merge.
- `worker_done` ≠ Hoàn thành Project; report ≠ PASS production.

---

## 10. Kết luận architect

| Câu hỏi | Trả lời |
| --- | --- |
| Code complete (phần lớn MVP mở rộng)? | **Gần đúng** theo board D0–D10; còn #254 và D11 |
| Acceptance complete? | **Nhiều Issue/Epic có** — không đồng nhất mọi residual gap |
| Pilot ready? | **Chưa** — thiếu evidence restore+load trên hạ tầng phát hành; SMTP outbound **U**; O06; ADR-19 chưa đóng; security reval G17/G18 trên SHA release |
| Production ready? | **Không** |
| Verdict file | **`Cần làm rõ`** + top 15 §4; phụ lục §4.1 |

Handoff tiếp theo cho planner: mở Tasks ownership theo cột Owner §4; chỉ chặn consumer khi thiếu artifact (ví dụ web/iOS #256/#257 chờ #255).
)
