# Đợt nghiên cứu hoàn thiện sản phẩm để đưa production

Ngày giao: 18/10/2026. User yêu cầu: “Tôi muốn hoàn thiện sản phẩm để đưa production, spawn đội nghiên cứu đi”.

Run Orca: `run_127c4628d08d`. Coordinator: session `codex_0aa4fdb0_35eb_43c0_ad9e_683de03d94f3`.

## Phạm vi và thẩm quyền

Nghiên cứu nghiệp vụ, UX/UI, kiến trúc/vận hành và bảo mật; tổng hợp roadmap để user review trước feature coding mới. Architecture impact: **Có** — có đánh giá architecture/release gates; chưa thay đổi kiến trúc hay contract.

Đây là đợt nghiên cứu local, không cấp quyền commit/push/PR/merge, production deploy, tạo cloud resource hoặc submit store. Không sử dụng Expo/EAS Cloud Build. Không hồi sinh các non-goals O10. Không coi Status Hoàn thành trên board hoặc build thành công là bằng chứng production ready.

## Phân công

Tất cả worker dùng `cursor`, theo `.cursor/rules/orca-agent-routing.mdc`; không override model. Các task độc lập được giao cùng wave, chỉ ghi report được phân công, không sửa source hoặc tài liệu khác.

| Task | Vai trò / tài liệu | Dispatch | Báo cáo được giao |
| --- | --- | --- | --- |
| Tổng hợp roadmap | Epic planner; không coding, không worker con | `ctx_ac1c063e393e` | `PRODUCTION-READINESS-ROADMAP.md` |
| Nghiệp vụ | `product-ba` / `docs/agents/roles/product-ba.md` | `ctx_bdc9363309a2` | `PRODUCTION-READINESS-BA.md` |
| Trải nghiệm | `product-design` / `docs/agents/roles/product-design.md` | `ctx_72fbe28af246` | `PRODUCTION-READINESS-UX.md` |
| Kiến trúc/vận hành | `architect` / `docs/agents/roles/architect.md` | `ctx_566d14427627` | `PRODUCTION-READINESS-ARCHITECTURE.md` |
| Bảo mật | `reviewer-security` / `docs/agents/roles/reviewer-security.md` | `ctx_03891bf41549` | `PRODUCTION-READINESS-SECURITY.md` |

## Yêu cầu đầu ra

Mỗi report ghi gap, nguồn/bằng chứng và SHA, rủi ro, ưu tiên P0/P1/P2, owner, dependency thật, AC/check và quyết định user cần chốt. Ghi rõ phần chưa xác minh và phân biệt code complete, acceptance complete, pilot ready và production ready. Nguồn trạng thái động là GitHub Project #3; tài liệu/source local có thay đổi chưa commit phải được đánh dấu rõ.

O06 retention/vùng dữ liệu/SLA vẫn là quyết định mở, không được tự chốt số hoặc ingest dữ liệu người dùng thật chỉ vì đợt nghiên cứu này được giao.

> **Errata (2026-10-18, [#373](https://github.com/hangndat/ticket-solution/issues/373)):** Đợt research trên **stale một phần**. Nguồn gap hiện hành: [`docs/reviews/GAP-AUDIT-2026-10-18-INDEX.md`](../reviews/GAP-AUDIT-2026-10-18-INDEX.md). **Đã đóng / chốt:** privacy live **HTTP 200**; Epic D11 / [#254](https://github.com/hangndat/ticket-solution/issues/254) **đóng board**; **O06 đã chốt**. **Còn mở:** Navigation O02 — [#368](https://github.com/hangndat/ticket-solution/issues/368)–[#371](https://github.com/hangndat/ticket-solution/issues/371).

## Trạng thái lúc giao

5 Dispatch đã được Orca nhận input và báo `ready`; sau đó cả 5 có quan sát agent `live` / activity `working`. `worker_done` chỉ là settlement thực thi, không phải nghiệm thu sản phẩm. Báo cáo và cleanup cuối đợt được coordinator đối chiếu riêng.

## Bàn giao cuối đợt

Đủ 4 báo cáo chuyên môn và [roadmap tổng hợp](./PRODUCTION-READINESS-ROADMAP.md), đã đối chiếu trước khi nhận settlement planner. BA được reuse ngay trong follow-up `ctx_b4e0fe5f2a1b` để sửa kết luận Dashboard từ checkout cũ; security được reuse trong `ctx_c2b67ace10b0` để kiểm chứng finding trên `origin/main` `2416a94b02acb50a5186309aa619c04fec106317`. Dashboard #250/#260 đã merge; #245 cần reconcile AC/evidence/board. Gate CSRF là potential/hardening P1 sau revalidation, không phải confirmed exploit P0.

Kết quả nghiên cứu: chưa đủ evidence để tuyên bố production ready; cần hoàn tất D11/#254, chốt O06/privacy trước dữ liệu thật, và kiểm chứng security/UAT/restore/load/email trên bản release cùng hạ tầng tương ứng. Báo cáo không xác nhận cấu hình runtime production từ README hay sample.

Checks đã làm: đọc 4 báo cáo và roadmap; đối chiếu Project #3; `gh pr view 250`, `gh pr view 260`, `gh issue view 245`; xác nhận 6 file mới bằng `git status --short`. Không chạy test/build vì đây là đợt docs/research; runtime suite và security tests chưa được chạy trong đợt này. Các báo cáo còn local/untracked, không commit/push, không deploy/store.

Cleanup: cả 5 terminal nghiên cứu đã được `worker-release` đóng, archive `captured`. 2 Dispatch gốc có nhãn lịch sử `retained` do đã chuyển terminal sang follow-up; các follow-up đều đã release. Audit Run cuối: không active worker, không reclaimable worker; mailbox đã ack và trống. Không đụng worker thuộc Run khác.
