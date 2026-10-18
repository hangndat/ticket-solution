# DoD review — Roadmap Portal (`portal.vemoki.com` / Ant Design)

| Trường | Giá trị |
| --- | --- |
| Role | `reviewer-dod` · [`docs/agents/roles/reviewer-dod.md`](../agents/roles/reviewer-dod.md) |
| Reviewer / session | Orca worker `term_30c20a9a-b62a-4a6f-a649-0868d14b6f7d` · Run `run_df32d5572a2d` |
| Dispatch (delta) | Task `task_dfaa25a4b11c` · Dispatch `ctx_6fc0c6d430b3` — **revalidation** sau glossary/wave map |
| Dispatch (review gốc) | Task `task_ae34a0d6070d` · Dispatch `ctx_0581c23228cc` — verdict trước: PASS with known gap |
| Độc lập | ≠ implementer docs coordinator `orca_session_id:codex_bcb66ba7_2f13_4e05_9b59_388347ec03c2`; ≠ research authors |
| Scope | **Planning review only** — primary freeze: `docs/plans/PORTAL-ROADMAP.md` + pointer `docs/ROADMAP.md`. HTML sơ đồ = consistency check tài liệu. **Không** acceptance implementation / security runtime / Project Hoàn thành |
| Architecture impact | **Có** — đề xuất host/session/packaging; chưa ADR accept |
| Source baseline (repo HEAD) | `400ad87a1401972476c79f17c4fd726ca7538063` — không gán cho nội dung docs mới |
| Ngày | 2026-10-18 (delta cùng ngày) |

> **Verdict (planning): PASS**  
> KG-1…KG-4 đã có **resolution trung tâm** trong `PORTAL-ROADMAP.md` (glossary tên tường minh + map wave planner→gói). Đủ đóng planning review cho user duyệt gói. Artifact con PD/security vẫn có option lệch — **không** còn known gap planning vì roadmap là primary và đã ghi rõ alternative ≠ recommendation. Gate tiếp theo = implementation (user duyệt → ADR → coding/deploy ủy quyền riêng), không bịa PASS triển khai.

---

## Delta revalidation (sau sửa coordinator)

### Thay đổi trong scope freeze

Coordinator (ownership docs) cập nhật `docs/plans/PORTAL-ROADMAP.md`:

1. **Cuối §1 — glossary:** `GATE-STAY-APP` · `PORTAL-SEPARATE-APP` · `PLATFORM-PORTAL-ZONE` · `ANTD-CORE-FIRST`; mã `G1/G2/P1` chỉ nghĩa nội bộ từng file; cấm copy vào ADR/Task Spec.
2. **Platform:** PD “giữ app” + dòng security đối chiếu PD = **phương án thay thế / option**, không recommendation của gói tổng hợp (`PLATFORM-PORTAL-ZONE`).
3. **§4 — ánh xạ:** R0/S0→R0; I1/S1→P0.1; I2/S2→P0.2–P0.4; S3→P1.1; S4→`GATE-STAY-APP` regression only; I3/S5–S6→P1.2; **P2 out** (backlog duyệt riêng).
4. **`docs/design/PORTAL-ROADMAP.html`:** sơ đồ tài liệu 6 phase P0.1–P1.2 (không app runtime).

Pointer `docs/ROADMAP.md` **không đổi** hash so với review gốc.  
`PORTAL-RESEARCH-RUN.md` đổi hash (IDs/checks/cleanup) — **ngoài freeze scope** theo Spec; không dùng làm kết luận.

### KG-1…KG-4

| ID | Trước (known gap) | Sau delta | Planning status |
| --- | --- | --- | --- |
| **KG-1** | Mã G1/G2/P1 va chạm PD↔architect↔packaging | Glossary + lệnh dùng tên tường minh; mã local-file-only | **Resolved (planning)** |
| **KG-2** | Platform PD/security ≠ freeze gói | Footnote: PD/security = alternative; gói = `PLATFORM-PORTAL-ZONE` | **Resolved (planning)** |
| **KG-3** | Wave I1/I2/I3 vs P0.x thiếu map | Bảng ánh xạ §4; P2 out | **Resolved (planning)** |
| **KG-4** | PD Pro* vs AntD thuần | `ANTD-CORE-FIRST`; Pro* chỉ sau spike/peer | **Resolved (planning)** |

Không yêu cầu edit authors con trong delta này — đúng Spec. Khi mở ADR/coding: Task Spec ghi tên tường minh; có thể footnote PD/security “superseded by gói đã duyệt” (limitation implementation, không fail planning).

### HTML consistency (tài liệu)

| Check | Kết quả |
| --- | --- |
| 6 phase ids | `P0.1` … `P1.2` — khớp bảng §4 roadmap |
| Nội dung cổng (Gate stay / Platform zone / AntD / parity / cutover) | Khớp khuyến nghị gói; không thêm P2 coding |
| R0 / P2 trong diagram | **Không** — đúng (R0 đã xong discovery; P2 out gói) |
| JS syntax | `node` `vm.Script` trên inline `<script>` → **PASS** (1 script, ~3957 bytes); coordinator đã PASS cùng cách |
| Runtime / a11y / browser | **Không claim** — docs-only diagram |

---

## Checklist planning (giữ từ review gốc; cập nhật C6)

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| C1 | `portal.vemoki.com` + AntD confirmed | **PASS** |
| C2 | Portal chuyên nghiệp + parity existing flows | **PASS** |
| C3 | Gap BFF / contract / Nest phân biệt | **PASS** (neo BACKEND-GAPS; không re-audit source trong delta) |
| C4 | Không 2 feature cùng slice web/BE | **PASS** |
| C5 | UI ≠ API ≠ runtime honesty | **PASS** |
| C6 | Architecture options + mã không gây nhầm | **PASS** — glossary trung tâm |
| C7 | Auth/RLS/CSRF/cookie/logout flags | **PASS** (không re-spot-check source trong delta; giữ evidence review gốc) |
| C8 | OUT: multi-event BI / billing / SSO enterprise / Android / payment… | **PASS** |
| C9 | Links + ROADMAP pointer | **PASS** |
| C10 | Gate/Platform đề xuất, không mặc định chuyển quyền | **PASS** — Gate=`GATE-STAY-APP`; Platform đề xuất cần user duyệt |

---

## Limitations kế tiếp (implementation — không fail planning)

1. User chưa duyệt gói → chưa ADR, chưa coding, chưa DNS/deploy.
2. Artifact PD/security vẫn chứa option Platform-on-app với mã local — đọc kèm glossary roadmap; cập nhật pointer khi có Task docs sau duyệt (tùy coordinator).
3. Epic Issue trên Project #3 chưa tạo; dùng map §4 khi tạo Story/Task.
4. Spot-check source (cookie/CSRF/G-R2/events cursor) thuộc review gốc @ `400ad87a…` — delta **không** re-run; nếu source đổi → revalidation riêng.
5. HTML không phải UAT/a11y evidence.
6. Verdict này **không** = security acceptance, DoD code, pilot ready, hay Project Hoàn thành.

---

## Checks (delta)

```text
git rev-parse HEAD
# 400ad87a1401972476c79f17c4fd726ca7538063

shasum -a 256 docs/plans/PORTAL-ROADMAP.md docs/ROADMAP.md docs/design/PORTAL-ROADMAP.html

# Glossary / wave map present in PORTAL-ROADMAP.md
# HTML phase_ids == P0.1..P1.2
node -e "… vm.Script(inline script) …"  # PASS

orca orchestration check  # empty before worker_done
```

Không: build app, Playwright, GitHub mutate, cài package, sửa file ngoài output này.

---

## Fingerprints — freeze kết luận (cuối delta)

| File | SHA256 | Vai trò |
| --- | --- | --- |
| `docs/plans/PORTAL-ROADMAP.md` | `575d2dfb6cc07f8b72fbf32d1b058c3a79a4fe09a6c3e463cc61e153787ad8ec` | **Primary freeze** |
| `docs/ROADMAP.md` | `7a848434a93cdc15c944f894dca569a094f233fb68aad1ddc328330c5f4c160f` | Pointer (không đổi vs review gốc) |

| File | SHA256 | Vai trò |
| --- | --- | --- |
| `docs/design/PORTAL-ROADMAP.html` | `12e2cc0f11d798ee5e3fca05bcb565afedae790c3e85208fc4dfe6a117ef0ca1` | Consistency diagram only |

### Supporting (không đổi authors; tham chiếu — không mở lại gap planning)

| File | SHA256 |
| --- | --- |
| `docs/plans/PORTAL-PRODUCT-RESEARCH.md` | `b1186b22ac22601a60bb4c8222c553e89a6479973c42929d36807bc463cd39be` |
| `docs/design/PORTAL-ANTD-UX.md` | `dbd582654c8d95af74d175929851c9831cbb0134609df9c96345f80d17d4d808` |
| `docs/architecture/PORTAL-SUBDOMAIN-ANTD.md` | `1e7510f99a9c53c44cf335ab2f65f397b538b1063cb204ab2544312eaca10de4` |
| `docs/plans/PORTAL-WEB-FEASIBILITY.md` | `60613051d0a953dc0edd3ca22e7080d6a055535b04c2cfae8fa1bb076ffd9d57` |
| `docs/plans/PORTAL-BACKEND-GAPS.md` | `140c0f3a45507313578e1c70a8f10ae2747926e3aa1968e7990f87e668ff8812` |
| `docs/reviews/PORTAL-DISCOVERY-SECURITY.md` | `ffd393be559a95a4251a94c433d9a80501f321d4ea6c7e8ca65bfb1659833875` |
| `docs/plans/PORTAL-EPIC-TASKS.md` | `660084fa8c89aaa6d700576f75d49a3ffa757ced82ea92198852c0a6a5e66d36` |
| `docs/plans/PORTAL-RESEARCH-RUN.md` | `903167978aae9874d835d494ce2661cb490d82a7ac87c53f6fcd6fa9adf9bdd1` *(đổi vs review gốc; ngoài freeze)* |

Nếu `PORTAL-ROADMAP.md` hoặc `docs/ROADMAP.md` đổi sau hash trên → **revalidation** bắt buộc.

---

## Lịch sử verdict

| Lần | Dispatch | Verdict planning | Ghi chú |
| --- | --- | --- | --- |
| 1 | `ctx_0581c23228cc` | PASS with known gap | KG-1…KG-4 mở; roadmap hash khi đó `a4aaf2bb…` |
| 2 (này) | `ctx_6fc0c6d430b3` | **PASS** | KG resolved trung tâm; freeze hash `575d2dfb…` |

---

## Kết luận cho coordinator

Planning DoD **PASS**. User có thể review/duyệt gói trên `PORTAL-ROADMAP.md` (tên tường minh + P0+P1, Gate stay app, Platform zone đề xuất). Tiếp theo ngoài scope review này: user approve → ADR → Epic board theo map §4 → coding khi được ủy quyền.
