# D13 — S6-T1 (#332) Submit readiness (Wave B prep)

Task [#332](https://github.com/hangndat/ticket-solution/issues/332) · Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story S6 [#310](https://github.com/hangndat/ticket-solution/issues/310).

**Mục đích:** go/no-go checklist trước **Submit for Review** — **không** thực hiện submit trong task S4-T3 / prep này. Submit ≠ publish (§0 `docs/plans/D13-APP-STORE-RELEASE-PLAN.md`).

| Trường | Giá trị |
| ------ | ------- |
| Role | `ios` / coordinator (submit ops) |
| Docs tip SHA | `git rev-parse HEAD` trên branch evidence |
| ASC read-only (session S4-T3 re-verify) | App `1.0.0` · `PREPARE_FOR_SUBMISSION` · `releaseType=MANUAL` |
| Latest TF train | `1.0.0` builds **10–13** · `processingState=VALID` · Internal `IN_BETA_TESTING` |
| Cấm | EAS Cloud; commit secrets; claim In Review / Ready for Sale từ checklist này |

## Dependency matrix (plan § S6 deps)

| Dep | Issue / artifact | Yêu cầu S6-T1 | Trạng thái | Go? |
| --- | ---------------- | ------------- | ---------- | --- |
| **S3** ASC prep | #322–#324 | Metadata, screenshots, review notes paste-ready | S3-T2/T3 evidence **Chờ duyệt** (`D13-S3-T2-SCREENSHOTS.md`, PR #308 review notes) | **CONDITIONAL** — coordinator DoD S3 trước submit |
| **S4-T3** physical TF smoke | #327 · [D13-S4-T3-DEVICE-SMOKE.md](./D13-S4-T3-DEVICE-SMOKE.md) | Attendee + staff **camera** trên binary đã upload; verdict PASS | **NO-GO** — binary `1.0.0 (13)` trên DatHN iPhone; checklist chưa chạy (device locked) |
| **S5-T2** demo reviewer prod | #329 · [D13-S5-T2-DEMO-REVIEWER.md](./D13-S5-T2-DEMO-REVIEWER.md) | Hai persona prod + ASC paste path; không secret git | **GO** (ops revalidated 2026-10-19) |
| **S5-T4** DoD + security S5 | #331 · [D13-S5-T4-DOD.md](./D13-S5-T4-DOD.md) | PASS exact SHA ≠ implementer | **GO** — **PASS with known gap** @ `9910173dc1c4f016448e2bc230ab6843c419b315` (explicit: không claim #327 PASS) |
| **Roadmap + go/no-go runtime** | [D12-RELEASE-GO-NO-GO.md](./D12-RELEASE-GO-NO-GO.md) · plan §2 | SMTP/email delivery thật; không bịa pilot ready | **NO-GO** — SMTP vẫn Mailpit; có thể **không chặn cứng** ASC upload/submit nhưng **rủi ro App Review** nếu flow email |

## S4-T3 vs S5-T2 vs S5-T4 (tóm tắt)

| Task | Câu hỏi | Kết luận |
| ---- | ------- | -------- |
| **S4-T3** | TF binary trên device + camera attendee/staff? | **Chưa PASS** — cài `1.0.0 (13)` OK; smoke blocked (unlock + operator session) |
| **S5-T2** | Apple reviewer đăng nhập prod? | **Đủ ops evidence** — paste ASC là bước S6, không blocker checklist |
| **S5-T4** | Code/authz deletion đủ DoD? | **PASS (gap)** — không thay thế S4-T3 |

## Wave B (#332) — overall go/no-go

| Gate | Verdict |
| ---- | ------- |
| **Submit for Review (#332)** | **NO-GO** cho tới khi S4-T3 physical smoke **PASS** + coordinator chốt S3 DoD + chấp nhận SMTP gap hoặc đóng SMTP |
| **Wave B parallel prep** | **OK** — tiếp S3 review queue, S5 ops, S2 runtime verify; **không** bấm Submit |

## Hành động mở (không tự làm trong S4-T3)

1. Operator: unlock DatHN iPhone (`00008130-000618E402D1001C`), chạy checklist § [D13-S4-T3-DEVICE-SMOKE.md](./D13-S4-T3-DEVICE-SMOKE.md) → cập nhật verdict PASS.
2. Coordinator: DoD S3-T2/T3 trên tip hiện hành.
3. Chọn build submit: khuyến nghị **cùng build đã PASS smoke** (hiện tip TF `1.0.0 (13)` id `fa4f322d-6a18-4a62-b5a9-e2133a055f8f` — không auto-submit build 10 nếu đã supersede).
4. S6-T1 dispatch: chỉ sau bảng trên **GO**; ghi timestamp In Review + exact SHA archive/source trong `docs/reviews/D13-S6-T1-SUBMIT.md` (chưa tạo).

JSON mirror: [d13-s6-t1-332-readiness.json](./d13-s6-t1-332-readiness.json).
