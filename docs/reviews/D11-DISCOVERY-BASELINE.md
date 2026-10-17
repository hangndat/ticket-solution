# D11 — Baseline và phạm vi discovery/design

Ngày: 18/10/2026 (Asia/Manila). Epic [#222](https://github.com/hangndat/ticket-solution/issues/222), Story #223, Task BA #224 / PD #225 / planner #226. Run `run_61b25d359766`.

## Ủy quyền

User yêu cầu mở rộng MVP, đẩy mạnh UX/UI và giao BA/PD nghiên cứu, thiết kế cho production. Pha này tạo tài liệu/prototype để review roadmap trước feature coding; không commit/push/PR/merge, deploy production hay submit store. Không thay đổi runtime. Các thay đổi docs/prototype còn local chưa commit; không gán SHA baseline cho chúng.

## Trạng thái trước D11

- Đã đọc Project #3 qua `gh project item-list 3 --owner hangndat --format json --limit 300`: 101 item, 100 Hoàn thành; #7 Chưa lên lịch là phạm vi hủy. Parent D0–D10 Hoàn thành. Sau đó coordinator mở D11 #222–#226, Status Đang làm.
- `gh pr list --repo hangndat/ticket-solution --state open`: rỗng tại checkpoint trước discovery.
- Source base/local HEAD và remote main: `3e61cde42d55654897048d6d627ab6834b54b808`. Đây là baseline source, không chứng minh SHA deployment web production.
- `docs/ROADMAP.md` snapshot 17/10 chậm hơn board; coordinator bổ sung thông báo live đầu file, giữ phần cũ làm lịch sử.

## Kiểm tra web public mới

Lệnh:

```text
scripts/web-uat.sh screenshot https://vemoki.com /tmp/d11-baseline-public.png
```

Kết quả:

```json
{"ok":true,"status":200,"url":"https://vemoki.com/","title":"Vemoki","screenshot":"/tmp/d11-baseline-public.png"}
```

Bản lưu: [screenshot public baseline](./d11-public-baseline.png). Playwright Chromium headless; không điều khiển chuột macOS. Chỉ GET trang public, không auth/admin hay mutation.

```text
curl -sS -o /dev/null -w 'privacy HTTP %{http_code}\n' --max-time 15 https://vemoki.com/privacy
privacy HTTP 404
```

Quan sát: trang public đang hiển thị rõ demo fixtures; copy có thuật ngữ triển khai (Nest BFF, API thật). Cần BA/PD quyết định nội dung trải nghiệm production và cách giữ demo có nhãn riêng; không tự bỏ nhãn demo trước khi nguồn dữ liệu thật được kiểm chứng. Privacy 404 là gap release thực tế tại thời điểm kiểm tra.

## Evidence lịch sử và giới hạn

Coordinator xem `docs/reviews/d8-uat/web/d8-admin.png`: trang admin dài, nhiều field ID và thuật ngữ kỹ thuật; đây là screenshot lịch sử D8, không phải current authenticated production capture. BA/PD phải xác minh source nếu dùng kết luận cho implementation hiện tại.

D10 checklist `docs/reviews/D10-S5-T1-ASC-CHECKLIST.md` ghi metadata prep hoàn tất nhưng có gap console/upload/distribution/privacy; không suy ra store submitted. O06 retention vẫn cần quyết định trước dữ liệu người thật. Không chạy usability test với người dùng thực; không có baseline conversion/task-time mới; không chứng minh a11y, concurrency, capacity hay device UAT từ các GET/screenshot này.

## Dispatch evidence

Agent `cursor` theo `.cursor/rules/orca-agent-routing.mdc`; không override model/effort. Cùng workspace, scope file riêng, không commit hoặc đổi branch:

| Task | Chuyên môn | Dispatch | Ownership |
| --- | --- | --- | --- |
| #224 | `product-ba`, `docs/agents/roles/product-ba.md` | `ctx_ba1b62ca6533` | `docs/plans/D11-BA-RESEARCH.md` |
| #225 | `product-design`, `docs/agents/roles/product-design.md` | `ctx_08badda9c351` | `docs/design/D11-PRODUCTION-UX-UI.md`, `docs/design/d11-prototype/**` |
| #226 | Epic planner | `ctx_207c4324db7d` | `docs/plans/D11-UX-PRODUCTION-PLAN.md`, `docs/tasks/d11/**` |

Worker kết thúc không tự đủ DoD; proposal chi tiết chờ user review roadmap. Thiết kế hướng production không đồng nghĩa pilot ready.
