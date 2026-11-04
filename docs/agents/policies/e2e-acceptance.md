# E2E acceptance — chống vòng lặp không hội tụ (F04)

Áp dụng cho mọi đợt nghiệm thu E2E theo `tests/e2e/PLAN.md` (hiện tại: F04, issue #1029–#1037).
Ra đời sau rà soát 04/11/2026: 128 PR `f04-*` đã merge trong 5 ngày mà tiến độ nghiệm thu
vẫn là 0/85 AC, vì không có thước đo dừng và hạt PR quá nhỏ.

## 1. Thước đo bắt buộc

Nguồn duy nhất: `pnpm e2e:f04-status`.

- `tests/e2e/coverage.mjs` cho **source coverage** (`implemented` / `covered` / `blocked` / `out`).
  Coverage **không** phải PASS; một selector đã map không chứng minh AC.
- `tests/e2e/f04-ledger.json` cho **nghiệm thu thật**. Chỉ `accepted: true` khi AC chạy đủ
  lớp B/H/D/R mà PLAN yêu cầu, trên checkout sạch ở đúng SHA, có run ID. Ghi kèm `sha` + `run`.
- Body issue domain phải chứa checklist sinh bởi
  `node tests/e2e/f04-status.mjs --markdown --domain=<KEY>`. Cập nhật mỗi khi ledger đổi.

Không mở dispatch E2E mới khi checklist của domain đó chưa được cập nhật ở lượt trước.

## 2. Hạt PR = một nhóm AC

Mặc định của `docs/agents/policies/project.md` (một Story / một PR / một owner) áp nguyên vẹn:
**một PR đóng trọn một ID AC** (DB-07, GATE-04, …), kèm evidence của mọi lớp PLAN yêu cầu.

Cấm tách PR theo từng assertion. Các chuỗi kiểu
`gate07-http` → `gate07-http-more` → `gate07-audit` → `gate07-audit-detail`,
hay `job07-http` → `job07-expiry` → `job07-actual-expiry` → `job07-foreign-export`
là anti-pattern: mỗi PR trả đủ chi phí dispatch + reviewer + CI + ledger cho vài dòng test.

Ngoại lệ, phải nói rõ lý do trong PR body:

- khác ownership slice (`AGENTS.md` § Ownership), hoặc
- cần contract/ADR chốt trước, hoặc
- PR đã >800 dòng diff và còn AC chưa xong.

## 3. Cost tier theo rủi ro, không theo mặc định

| Loại việc                                                    | Tier       |
| ------------------------------------------------------------ | ---------- |
| Thêm/sửa test cho một AC, không đổi production code          | `standard` |
| Sửa production code thuộc nhánh B (auth, RLS, vé/tiền, race) | `focused`  |
| Thiết kế contract / ADR / phân rã AC                         | `advanced` |
| Chẩn đoán hạ tầng E2E (lane, CI, Chromium, disk, container)  | `cheap`    |

Không đặt `high` mặc định cho PR test dưới 100 dòng.

## 4. Hạ tầng E2E tách khỏi AC

Việc thuộc lane pool, CI runner, Chromium/Playwright, Docker, dung lượng đĩa, Keycloak/Mailpit
fixture **không** tính vào issue domain. Mở/đính vào issue hạ tầng riêng.
Nhánh đặt tên `e2e-infra-*`, không đặt `f04-*`. Issue hạ tầng: **#1220**.

Lý do: các PR `ci-diagnosis`, `gate-dh-salvage`, `chromium-diagnostic`, `codex-luna-fallback`,
`e2e-lane-fixes`, `e2e-lane-pool` đang làm số liệu F04 trông như đang chạy mà AC không nhúc nhích.

## 5. Worktree

Trần ≤8 worktree sống và quy trình dọn đã nằm ở `docs/agents/workflows/worktree.md` §2 — áp nguyên.
Rà soát 04/11/2026 đếm **74 worktree**, phần lớn là `f04-*-review` của PR đã merge. Đó là vi phạm
trần hiện hành, không phải quy tắc mới.

Bổ sung một quy tắc mới:

- Worker **không** coding trên `main`, `main-2`, `main-3`. Các worktree đó để điều phối và đọc.
  Nhiều agent nhảy nhánh trên cùng một worktree làm HEAD đổi liên tục; mọi agent đang mở
  worktree đó phải rebuild CRG graph lại mỗi turn (một lần rebuild ~6k token output) mà không
  tạo ra giá trị nào. Mỗi dispatch: `git worktree add -b <branch> ../<slug> origin/main`.
- Worktree `*-review` xoá ngay khi review xong, không chờ checkpoint Epic.

## 6. Ngân sách và tracking

- `company/work-events.jsonl` append-only, không được đứt. Dispatch phải đi qua
  `pnpm agent:workflow` để receipt tự ghi; gọi tay Orca bỏ qua wrapper là nguồn gây đứt.
  Khi phát hiện khoảng đứt, ghi một bản ghi `type: "checkpoint"` (loại hợp lệ duy nhất cho
  việc này theo `scripts/company-worklog.mjs`) nêu rõ khoảng thời gian và nguyên nhân;
  **không** dựng lại sự kiện đã mất.
- Coordinator đặt trần số PR/ngày cho mỗi domain và báo cáo
  `accepted/scoped` sau mỗi wave. Hai wave liên tiếp mà `accepted` không tăng ⇒ dừng dispatch,
  đưa domain ra roadmap review thay vì chạy tiếp.

## Liên quan

- `docs/agents/policies/project.md` — DoD hai nhánh, evidence exact SHA
- `docs/agents/workflows/dispatch.md` — vòng dispatch
- `tests/e2e/PLAN.md` — nguồn AC
