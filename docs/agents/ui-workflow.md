# Chọn role và skill cho UI/UX

Áp dụng khi Task thiết kế, sửa hoặc review giao diện. Scope/AC và quyết định đã chốt của repo là đầu vào; skill không tự mở thêm feature hay đổi brand. Chỉ coordinator gốc spawn qua Orca theo [routing](../../.cursor/rules/orca-agent-routing-coordinator.mdc); worker không spawn con.

## Chọn role theo việc thực sự cần làm

| Task                                          | Role / thứ tự                                                                       | Khi nào cần thêm người                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Sửa spacing, màu, responsive theo mẫu hiện có | `web` hoặc `ios` trực tiếp                                                          | Review UI trong session DoD nếu có tiêu chí UI cần nghiệm thu; không tạo Task PD riêng         |
| Màn mới, đổi bố cục/flow đáng kể, revamp      | `product-design` → `web` / `ios` phụ thuộc handoff → `reviewer-uiux`                | Chốt một màn đại diện trước khi nhân rộng; gộp UI review với DoD khi cùng PR/SHA               |
| Chỉ thiết kế/prototype                        | `product-design`                                                                    | `reviewer-uiux` khi Task yêu cầu critique độc lập; không spawn implementer khi chưa giao code  |
| Chỉ review UI/UX                              | `reviewer-uiux`                                                                     | Không tự sửa code; bàn giao findings cho đúng owner                                            |
| Nghiệm thu PR có UI                           | Gộp `dod+ux` / `dod+sec+ux` — Read [reviewer-merged.md](./roles/reviewer-merged.md) | Thêm security khi slice nhạy cảm (`dod+sec` / `dod+sec+ux`); từng verdict riêng trong artifact |

BA chỉ khi bài toán/AC chưa rõ; architect khi có quyết định IA/route/contract thật sự cần giải; backend khi đổi nghiệp vụ/API. Không thêm các role đó chỉ vì Task có UI. Task độc lập vẫn chạy ngay, chỉ consumer thiếu handoff mới chờ.

Reviewer UI độc lập với tác giả phần đang duyệt, kể cả tác giả prototype khi review thiết kế. Gộp DoD+UI dùng `James · dod+ux`; nếu có security dùng `James · dod+sec+ux`. Review UI riêng dùng `Mira · ux`. Không spawn các reviewer trùng checklist trên cùng PR/SHA; vẫn giữ cap reviewer hiện hành.

## Nạp skill theo phạm vi

| Phạm vi                                      | Skill cần nạp                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thiết kế visual/flow/prototype               | `impeccable` — chỉ playbook liên quan (`shape`, `critique`); không nạp skill coding khi chưa code                                                                                                        |
| Đặc tả/duy trì Vemoki Design System          | [`vemoki-design-system`](../../.cursor/skills/vemoki-design-system/SKILL.md) — nguồn chuẩn, token/component mapping, governance; chỉ Task `product-design` đúng scope. Thêm `impeccable` khi cần thiết kế/render, không mặc định nạp skill coding |
| Sửa UI web                                   | `impeccable` theo thay đổi; `vercel-react-best-practices` khi viết/sửa React/Next; không nạp backend/EAS                                                                                                 |
| Review UI web                                | `impeccable` (`critique`); `web-design-guidelines` khi kiểm code web; `audit` khi Task có kiểm chất lượng kỹ thuật                                                                                       |
| Sửa/review code UI iOS                       | `expo-overview` trước; `react-native-best-practices`; chọn `expo-native-ui` khi làm màn hoặc `expo-design-system` khi đổi token/component dùng chung; chỉ thêm skill chuyên môn khác khi thay đổi cần nó |
| Review ảnh/prototype iOS, không đọc/sửa code | `impeccable` (`critique`) theo hành vi native; không áp quy tắc DOM/CSS của web                                                                                                                          |
| UAT cần điều khiển browser/simulator         | Đọc [uat-headless.mdc](../../.cursor/rules/uat-headless.mdc), rồi skill công cụ Orca tương ứng; đây là công cụ lấy evidence của Task UI                                                                  |

Task Spec ghi tên skill + mục đích; chỉ đọc `SKILL.md` và reference cần cho bước đang làm. Không nạp toàn bộ catalog, không biến skill thành `alwaysApply`. Các yêu cầu nền tảng bắt buộc vẫn áp dụng khi đọc/sửa code; “chỉ UI” không miễn accessibility hoặc checks liên quan.

Marketing ưu tiên thông điệp/nhận diện; consumer web bám brand tokens và O22; portal chỉ dùng UI component và giao diện/token mặc định của `antd` theo O26, không tạo wrapper/UI component/CSS riêng; iOS bám hành vi native. ProComponents hiện có cần migration theo O26, không dùng cho UI mới. `brand/vemoki/tokens.json` vẫn là token SoT cho các bề mặt Vemoki khác, không áp vào Portal. Hướng dẫn thẩm mỹ của skill không được tự thay font native, locale tiếng Việt, component hay brand đã chốt. Nếu skill dùng `PRODUCT.md`/`DESIGN.md`, tham chiếu PRD/handoff hiện có, không tạo nguồn quyết định cạnh tranh.

Thiếu skill: kiểm tra catalog/path trước khi spawn, ghi limitation và chuẩn bị skill cần thiết; không nhận đã dùng skill khi chưa đọc. Việc cài skill không tự cấp quyền chạy installer hooks, đổi policy repo hay dùng browser ngoài quy tắc UAT.

## Mẫu trực quan và vòng review

1. Với màn mới/revamp, PD bàn giao một handoff gồm flow/states, token/component và prototype hoặc ảnh render của 1–3 màn đại diện. Dùng copy tiếng Việt, dữ liệu giả lập có nhãn, kích thước màn hình và trạng thái chính trong scope. Sửa nhỏ có thể dùng ảnh/mẫu hiện có.
2. Ghi rõ phiên bản mẫu chuẩn, người xác nhận trong thẩm quyền và điểm còn mở. Coordinator dùng ủy quyền hiện có để xác nhận; chỉ hỏi user khi quyết định vượt thẩm quyền, không thêm vòng xin phép mặc định.
3. Implementer làm màn đại diện bằng component thật, tự xem kết quả ở kích thước mục tiêu trước khi nhân rộng. Handoff gồm exact SHA, route/build, persona/quyền, viewport, locale, state, ảnh và cách tái hiện. Không suy ra runtime từ prototype.
4. Reviewer đối chiếu mẫu và thực hiện hành trình trong scope. Web dùng Orca browser; iOS dùng Orca emulator theo rule UAT. Review ảnh tĩnh phải ghi giới hạn; không kết luận tương tác/a11y đã PASS nếu chưa kiểm.
5. Coordinator kiểm chứng report trước khi giao sửa: mở mẫu 2–3 ảnh/finding mức cao nhất, đối chiếu nội dung ảnh với nhãn và claim. Ảnh lệch nhãn/trùng hoặc finding mâu thuẫn evidence → trả reviewer chụp/kết luận lại, không chuyển cho implementer.
6. Gom findings thành một batch theo [review-convergence](../../.cursor/rules/orca-review-convergence.mdc): ID ổn định, bằng chứng, tác động, căn cứ AC/mẫu, chặn hay không và điều kiện đóng. Lệch mẫu/lỗi sử dụng khác sở thích thẩm mỹ; không thêm AC ngầm. Giữ tối đa hai lượt sửa tự động rồi chẩn đoán, không reset khi đổi reviewer.

UI review PASS không thay DoD/security, CI hoặc UAT thiết bị thật khi AC yêu cầu. Phân biệt code complete / acceptance complete / pilot ready theo ROADMAP.

## Khối thêm vào Task Spec UI

```markdown
- Role ID: <product-design | web | ios | reviewer-uiux | dod+ux | dod+sec+ux>
- File role: <docs/agents/roles/reviewer-merged.md khi gộp review; hoặc một file role đơn>
- Bề mặt / chế độ: <marketing | consumer web | portal | iOS> / <thiết kế | code | review>
- Skills cần nạp: <tên + playbook/mục đích; chỉ những skill liên quan>
- Mẫu thiết kế chuẩn: <artifact + phiên bản/SHA, hoặc mẫu hiện có cho sửa nhỏ>
- Evidence UI: <route/build, viewport đo thật/device, locale, persona, states, nơi lưu ảnh> — quy tắc kiểm evidence theo `reviewer-uiux.md` bước 3 và 7; Task Spec chỉ trỏ tới, không chép lại checklist
```

Điền cùng Issue/paths/AC, Architecture impact, Cost tier, model và Persona trong [Task Spec chung](./README.md). Với review, thêm exact SHA, implementer dispatch và findings/lượt sửa trước. Không mở Task chỉ để điền đủ roster.

## Hai skill đã chọn

Cài ở user scope để Codex và Cursor cùng dùng; nội dung skill chỉ nạp khi Task cần. Nguồn được pin trong lần cài ngày 2026-10-22:

| Skill                   | Nguồn / đường dẫn upstream                                                                                                                                                          | Ref                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `impeccable`            | [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/8644175285360c166e57b1e35ecadfbc85ff5209/.agents/skills/impeccable) — `.agents/skills/impeccable`                   | `8644175285360c166e57b1e35ecadfbc85ff5209` |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/web-design-guidelines) — `skills/web-design-guidelines` | `063bee94c3f4df8453406c830b0a7df0f2860278` |

Bản dùng chung ở `~/.agents/skills/<name>`; Codex active account (`$CODEX_HOME/skills/<name>`) và `~/.cursor/skills/<name>` trỏ đến cùng bản. Máy khác cần cài hai skill từ các nguồn/ref trên trước khi dispatch. `web-design-guidelines` tải checklist upstream khi review: ghi ref/hash checklist đã dùng trong evidence nếu cần tái lập cùng bộ tiêu chí.
