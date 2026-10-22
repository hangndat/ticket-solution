# Reviewer gộp — checklist ngắn (`dod+ux` · `dod+sec` · `dod+sec+ux`)

**Một file Read** khi Spec gộp nhiều reviewer trên cùng PR/SHA. Chi tiết đầy đủ vẫn ở file role gốc — không bỏ gate.

| UI label     | Role ID gộp                          | File chi tiết (khi cần đào sâu)                                                       |
| ------------ | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `dod+ux`     | `reviewer-dod` + `reviewer-uiux`     | [reviewer-dod.md](./reviewer-dod.md) · [reviewer-uiux.md](./reviewer-uiux.md)         |
| `dod+sec`    | `reviewer-dod` + `reviewer-security` | [reviewer-dod.md](./reviewer-dod.md) · [reviewer-security.md](./reviewer-security.md) |
| `dod+sec+ux` | cả ba                                | cả ba file trên                                                                       |

**Mapping gate (không thay file gốc):**

| Gate                                                                              | Nguồn                  | Bắt buộc khi                   |
| --------------------------------------------------------------------------------- | ---------------------- | ------------------------------ |
| Independence (session ≠ implementer)                                              | dod · sec · uiux       | Luôn                           |
| Exact SHA + scope paths + verdict riêng DoD / UI / security                       | dod · uiux · sec       | Luôn                           |
| AC correctness, CI/tests/UAT trên SHA, skeptical claims                           | dod § Cách làm 1–3     | Luôn                           |
| Automation vs physical-device (headless ≠ thay device AC)                         | dod § 4                | Khi AC/ROADMAP yêu cầu         |
| Architecture impact ↔ handoff/ADR                                                 | dod § 5                | Spec `Architecture impact: Có` |
| [orca-review-convergence.mdc](../../../.cursor/rules/orca-review-convergence.mdc) | dod · uiux · sec       | Luôn                           |
| O02 / PD §6.1 chrome (D-O02 … D-DECISION-ROW)                                     | dod § Checklist O02    | Spec đụng chrome/permission/IA |
| UI: mẫu, viewport đo, probe, journey, evidence ảnh + `ui-evidence-check.sh`       | uiux § Cách review 1–7 | `dod+ux` / `dod+sec+ux`        |
| UI finding types + verdict UI riêng                                               | uiux § Artifact        | Có UI trong scope              |
| Tenant/authz/idempotency/secrets/supply-chain trong diff                          | sec § Trọng tâm        | `dod+sec` / `dod+sec+ux`       |
| Verdict security riêng                                                            | sec § Artifact         | Có security trong scope        |

**Artifact:** một file `docs/reviews/*` hoặc comment PR — cột/bullet **DoD** | **UI/UX** | **Security** (chỉ phần áp dụng), chung SHA và checks. UI PASS không cấp DoD PASS; DoD không thay security.

**Spec:** `File role: docs/agents/roles/reviewer-merged.md` (không liệt kê từng `reviewer-*.md` khi gộp). Chọn role theo [ui-workflow.md](../ui-workflow.md).
