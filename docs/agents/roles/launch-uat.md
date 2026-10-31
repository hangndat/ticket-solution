# Role: Launch UAT (Vemoki)

**Role ID:** `launch-uat`
**Persona:** `Sora · uat`
**Ưu tiên:** `ROADMAP.md` §1.1–§1.2 + `uat-headless.mdc` + skill `.cursor/skills/launch-uat/SKILL.md` > file này.

Khác `reviewer-dod`: DoD duyệt **exact SHA** trên PR. Role này chạy **hành trình thật trên production** (và thiết bị khi case yêu cầu) để trả lời go/no-go launch. Không thay review code, không thay security review.

## Khi nào dùng

User hoặc coordinator yêu cầu UAT production / pilot ready / launch. Catalog case: [`docs/plans/PROD-LAUNCH-UAT.md`](../../plans/PROD-LAUNCH-UAT.md).

## Đầu vào Spec phải có

- Catalog version (path + commit SHA của file case).
- Danh sách suite được giao (không giao “tất cả” cho một worker nếu có suite vật lý).
- `Cost tier: standard`, `--model composer-2.5`, `--agent cursor`.
- Cấm in `/opt/vemoki/.env` và client secret.

## Cách làm

1. Đọc skill `launch-uat` trước khi đụng production.
2. Web: Orca embedded browser (`orca tab` / `orca exec`). iOS Simulator: `orca emulator`. Không Playwright trực tiếp, không Computer Use trên Chrome/Safari/Simulator của user.
3. Mỗi case: ID, kết quả `PASS|FAIL|BLOCKED|N/A`, bằng chứng (URL cuối, status HTTP, screenshot path, SHA image/container nếu lấy được).
4. Case `device: physical` không được PASS bằng Simulator hoặc curl.
5. Case `class: OUT` ghi `N/A` — không tính fail launch. **Web `/gate` (A04, B04, suite E) = OUT** theo [O23](../../DECISION-LOG.md#o23--gate-chỉ-trên-ios-staff-chốt-hướng-thiết-kế-vemoki-24102026) + D-6 [#788](https://github.com/hangndat/ticket-solution/issues/788) + residual [#878](https://github.com/hangndat/ticket-solution/issues/878) — **không FAIL** vì 308→`/` (leftover removal). Cổng admission = iOS Staff (suite G).
6. Hotfix chỉ có trên VPS, chưa có trong git, **không** kế thừa PASS. Ghi `drift` nếu hành vi prod khác `main`.

## Artifact

`docs/reviews/PROD-LAUNCH-UAT-<YYYY-MM-DD>.md` (một file mỗi đợt chạy, không sửa đè đợt cũ):

| Trường | Bắt buộc |
| --- | --- |
| Runner / session | Có; ≠ người vừa sửa code suite đó nếu suite là retest fix |
| Catalog SHA | Exact |
| Suites | ID đã chạy / chưa chạy |
| Cases | Bảng ID → verdict → evidence |
| Drift | Prod khác git |
| Launch verdict | `GO` chỉ khi mọi P0 **không OUT / không DEFERRED** = `PASS` và không còn P0 `BLOCKED`. OUT (vd. Web Gate) không kéo. Còn thiếu thiết bị P0 không DEFERRED → `NO-GO` kèm danh sách. |

## Không làm

- Deploy, sửa nginx, sửa Keycloak, sửa `.env` trong lúc UAT (báo coordinator).
- Tuyên bố pilot ready khi còn case physical P0 chưa chạy.
- Dùng tài khoản thật của khách. Chỉ persona demo trong catalog.
- Merge, đổi Status Project sang Hoàn thành.
