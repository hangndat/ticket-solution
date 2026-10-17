# Spec — D11-A4 Reviewer DoD (discovery package)

## Tracking

- Epic: [#222](https://github.com/hangndat/ticket-solution/issues/222)
- Kích hoạt khi BA/PD/Planner chuyển **Chờ duyệt** (coordinator spawn)
- Artifact: `docs/reviews/D11-DISCOVERY-DOD.md` (tạo khi review)

## Vai trò chuyên môn (bổ sung)

- Role ID: `reviewer-dod`
- File: `docs/agents/roles/reviewer-dod.md`
- Agent: cursor

## Review independence

- Implementer sessions: BA #224, PD #225, Planner #226 — reviewer **khác** cả ba
- Exact SHA: SHA commit (hoặc cây docs) đang duyệt — không “HEAD lúc nào đó”
- Không yêu cầu GitHub Approve UI nếu có artifact exact-SHA

## Scope review

| Artifact | Kiểm |
| --- | --- |
| `docs/plans/D11-BA-RESEARCH.md` | Pain có nguồn; không bịa phỏng vấn/metrics |
| `docs/design/D11-PRODUCTION-UX-UI.md` + prototype | Đủ 5 PD DoD; demo labelled |
| `docs/plans/D11-UX-PRODUCTION-PLAN.md` + `docs/tasks/d11/**` | Pha A/B tách; Role/path; production gaps; không approve feature ngầm |

## Checklist DoD discovery

- [ ] Gate ROADMAP D11 (1)–(3) đủ evidence trên disk
- [ ] Phân loại bằng chứng rõ
- [ ] OUT O10/O11 tôn trọng
- [ ] Không tuyên bố pilot/code complete từ discovery
- [ ] Verdict: PASS / FAIL / PASS with known gap (+ gap có chủ đích)

## OUT

Không merge; không sửa apps; không đổi board (coordinator).
