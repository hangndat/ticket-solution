# Production readiness — Security (reviewer-security)

| Trường | Giá trị |
| --- | --- |
| Role | `reviewer-security` · `docs/agents/roles/reviewer-security.md` |
| Run / Task / Dispatch (revalidate) | `run_127c4628d08d` · `task_08e67bd0f20c` · `ctx_c2b67ace10b0` |
| Ngày | 2026-10-18 (audit gốc + revalidate cùng ngày) |
| Worktree HEAD | `e8512d0055e0e9d6585007e8363b6224a7138b12` (dirty — không suy merged) |
| Revalidate SHA | `origin/main` = `2416a94b02acb50a5186309aa619c04fec106317` (`git fetch` + `git show`) |
| Runtime destructive / prod auth | **Không** (chỉ HEAD công khai `/` và `/privacy` lúc audit gốc) |
| Phạm vi sửa | Chỉ file này |

**Verdict:** **Chưa pilot / production ready.** P0 còn lại đã chứng minh: **O06 mở**, **`/privacy` 404**. S03 Gate BFF thiếu Origin/CSRF guard trên `origin/main` là **fact code**; **không** nâng thành confirmed CSRF exploit (xem §3 S03). MFA/platform step-up là **gate bắt buộc đã approved** — chỉ còn việc chứng minh IdP runtime, không hỏi lại user.

Audit readiness độc lập — **không thay** exact-SHA DoD/security từng PR.

---

## 1. Bối cảnh

| Mục | Fact |
| --- | --- |
| Local HEAD vs `origin/main` | Local `e8512d0…` **cũ hơn** `2416a94…`; kết luận S03 lấy từ `git show origin/main:…` |
| Uncommitted | Nhiều path dirty/untracked; evidence local ≠ đã merge |
| Project #3 (audit gốc) | Nhiều **Hoàn thành**; #255 public events **Chờ duyệt**; D11/event-server đang làm |
| Đồng đội | BA / UX / Arch / Roadmap reports **đã có** — không mở lại audit rộng |

| Mức | Trạng thái |
| --- | --- |
| Code / acceptance complete | Nhiều slice board **Hoàn thành** ≠ pilot |
| Pilot / production ready | **Chưa** (O06, privacy, custody/IdP/abuse gates) |

---

## 2. Threat model rút gọn

| Actor | Kiểm soát (fact) | Gap |
| --- | --- | --- |
| Cross-tenant | `withTenant` + RLS FORCE; deny-by-default membership | CI isolation trên SHA deploy — **chưa re-run** đợt này |
| Gate browser cookie | API authz + session + token; BFF Gate **không** gọi Origin/CSRF | Potential CSRF — cần test (§3 S03); không confirmed |
| Offline replay | ADR-18 + idempotency/conflict + tests | Multi-device UAT runtime **chưa xác minh** |
| Quota race | `FOR UPDATE` trong `issue.ts` | Load local ≠ SLO prod |
| Abuse | App rate-limit chủ yếu notification; `infra/admission/*` = **sample local** (“NOT production”) — **không** là fact edge đang chạy | Staging/prod admission **chưa xác minh** |
| Platform MFA | Verifier bắt ACR/`auth_time` | Gate **bắt buộc**; chứng minh IdP realm prod còn thiếu |
| Export / CS / deletion | Permission, mask email, ACK-only deletion | O06 + privacy public |
| Supply / secrets | Fail-closed SMTP/APNs; cấm EAS Cloud | CI audit/Dependabot **không thấy** trong grep; custody **chưa xác minh** |

---

## 3. Ma trận gap (đã hiệu chỉnh)

**F** fact · **I** inference · **R** recommendation · **P?** potential (cần test)

| ID | Gap | Evidence / SHA | Rủi ro | P | Owner | Dep | AC / check | User chốt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | O06 retention / region / SLA mở | `docs/ops/O06-OPTIONS.md`; deletion ACK-only | Ingest PII thật / claim privacy sai | **P0** | Product+legal+ops | Không block mọi UX code; **block** ingest thật | Đóng O06 trong DECISION-LOG (kể cả N/A MVP) | **Có** — gói §5 |
| S02 | `/privacy` 404 | Live HEAD 2026-10-18 → HTTP/2 404 | Store/support/release | **P0** | web + deploy ủy quyền | Nội dung duyệt | `GET /privacy` = 200; không bịa retention | Duyệt copy + publish |
| S03 | Gate BFF POST thiếu Origin/CSRF guard | **F:** `git show origin/main:apps/web/app/api/bff/gate/{sessions,reservations,confirm}/route.ts` @ `2416a94…` — chỉ `forwardWithBearer`; **không** `assertSameOrigin` / `assertMutatingBrowser`. Cookie access: `sameSite: 'lax'`, `httpOnly: true` (`cookies.ts`). Body parse JSON → form `urlencoded` → 400. | **P?** CSRF cross-site cổ điển **không được chứng minh**: Lax thường **không** gửi cookie trên cross-site POST/XHR; JSON Content-Type cản form CSRF đơn giản. Còn lại: same-site subdomain, XSS, hoặc cookie bị hạ SameSite — **cần test có chủ đích**, không claim exploit. Defense-in-depth: thêm Origin (hoặc tương đương) cho đối xứng redeem/admin. | **P1** (hardening / potential) | web | Cookie BFF | Test: cross-site POST **không** kèm cookie → 401; missing Origin nếu thêm guard → 403; document threat assumptions | Không — hardening kỹ thuật |
| S04 | Admin lẫn Origin-only vs double-submit | Origin fail-closed khi thiếu Origin (`origin.ts` trên main) | Origin-only **không** tự = yếu nếu SameSite+JSON đủ threat model; double-submit = defense-in-depth tùy chọn | **P2** | web | — | Inventory nhất quán **theo threat model đã chọn**; không bắt buộc đổi toàn bộ sang double-submit | Không |
| S05 | Abuse limit ngoài notification | App: `tryConsumeRateLimit`; repo sample `infra/admission/*` **không** chứng minh live edge | Public scrape / shock nếu không có limit ở môi trường thật | **P1** | ops + coordinator | Đo **staging/prod thực tế** (chưa làm) | Xác minh config đang chạy + số liệu 429; không suy từ sample | Ngưỡng staging/prod |
| S06 | Access JWT sống hết TTL sau logout/revoke cookie | Membership/Gate revoke có; chưa thấy denylist | Cửa sổ token tới expiry | **P1** | backend + IdP | Short TTL / refresh revoke | Document TTL; membership revoke chặn request mới (DB) | TTL access prod |
| S07 | MFA IdP runtime chưa chứng minh | `createPlatformOidcVerifier` + platform wire | Thiếu ACR/`auth_time` đúng → fail hoặc bypass cấu hình sai | **P0 gate** (invariant đã approved) | ops Keycloak + backend | Realm MFA | Smoke: thiếu ACR → `MFA_REQUIRED`; ACR trong cửa sổ OK | **Không hỏi** “có bắt MFA?” — đã bắt buộc; chỉ vận hành đúng |
| S08 | Deletion ACK / `UNRESOLVED` | `account-deletion.ts` | User hiểu nhầm đã xóa | **P1** | product + backend | S01 | Copy chờ policy; sau O06 purge/anonymize | Sau O06 |
| S09 | Export object TTL vs erasure | `export.ts` | Object/backup sống sau “xóa” | **P1** | backend + ops | S01 | Lifecycle khớp policy | TTL/backup |
| S10 | SMTP/APNs custody prod | Fail-closed adapters | Misconfig / key lộ | **P1** | ops | No noop prod | Smoke prod config; không log PEM/token | Ai giữ secret |
| S11 | Supply-chain CI | Không thấy audit/Dependabot trong workflow grep | CVE / malicious install | **P1** | coordinator | — | CI audit high+ khi đụng dep | Bật Dependabot? |
| S12 | #255 public events | Project Chờ duyệt | Surface public / scrape | **P1** | BE reviewer ≠ impl | Exact-SHA DoD+security trước merge | Chỉ published; không PII; limit | Publish mặc định? |
| S13 | Offline multi-device UAT | ADR-18 + tests | Conflict/skew thực tế | **P2** | Gate web/iOS + QA | Device UAT | 2 device / skew >300s | — |
| S15 | Support dán PII/OTP/QR | CS mask; runbook | Leak kênh support | **P2** | ops | — | Runbook cấm PII/OTP/QR | Kênh support |

**Đã gỡ S14** (finding `activated_at` từ artifact SHA `346bf9e` cũ): **chưa verify trên `2416a94…`** → không ghi defect current.

---

## 4. S03 — prerequisites / mitigations (chi tiết)

| Thành phần | Trên `origin/main` `2416a94…` |
| --- | --- |
| Guard trên Gate BFF POST | **Không** Origin / CSRF double-submit |
| Auth | Cookie `oidc_access_token` → Bearer upstream |
| Cookie flags | `httpOnly: true`, `sameSite: 'lax'`, `secure` theo `AUTH_COOKIE_SECURE` |
| Body | `request.json()` — non-JSON → 400 |

**Điều kiện cần để CSRF “cổ điển” thành công (chưa chứng minh):** trình duyệt gửi cookie session trên cross-site POST **dù** SameSite=Lax, **và** gửi được JSON (hoặc server chấp nhận body khác) kèm đủ UUID/token nghiệp vụ. Với Lax + JSON parse, kịch bản form cross-site thông thường **không đủ** → xếp **potential finding cần test**, không confirmed exploit / không P0.

---

## 5. Gói O06 (user chốt — không bịa số)

Giữ khung `docs/ops/O06-OPTIONS.md`: tài khoản / vé+check-in / audit / object / backup undelete / residency / SLA support. Chốt DECISION-LOG trước ingest PII ngoài demo.

---

## 6. Gate trước real users

1. **S01** O06 đã đóng (kể cả N/A có chữ ký).  
2. **S02** `/privacy` 200 đã duyệt.  
3. **S07** MFA IdP smoke đạt (gate đã approved).  
4. RLS/authz isolation CI xanh trên SHA deploy.  
5. **S10** SMTP/APNs prod không noop.  
6. **S05** abuse/admission **đo trên môi trường thật** (không lấy sample repo làm fact).  
7. **S12** nếu merge public: DoD + security exact-SHA.  
8. **S03** test CSRF assumptions; Origin guard = hardening khuyến nghị, không blocker P0 khi chưa có PoC.

Production ready thêm: S11, backup/erasure khớp O06, runbook, không EAS Cloud Build.

---

## 7. Giới hạn

- Không pentest / không authenticated prod.  
- Không re-run full suite trên `2416a94…`.  
- Sample `infra/admission` ≠ live deployment.  
- Chỉ sửa file này.

---

## 8. Handoff

| Report | Trạng thái |
| --- | --- |
| BA / UX / Architecture / Roadmap | Đã có (đồng đội) |
| Security (file này) | Revalidated |

Wave gợi ý sau user review roadmap: chốt O06 ∥ publish privacy (ủy quyền) ∥ MFA IdP smoke ∥ test S03 / optional Origin Gate ∥ #255 review trước consumer.

---

## 9. Nguồn ngoài

| Claim | URL | Ngày | Kết quả |
| --- | --- | --- | --- |
| Site | `https://vemoki.com/` | 2026-10-18 | 200 |
| Privacy | `https://vemoki.com/privacy` | 2026-10-18 | **404** |

*Không PASS production. Confirmed P0: O06 + privacy. S03 = potential/hardening sau kiểm chứng `origin/main`.*
