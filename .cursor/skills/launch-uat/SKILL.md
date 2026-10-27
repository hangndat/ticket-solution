---
name: launch-uat
description: >-
  Run Vemoki production launch UAT against the case catalog. Use when the user
  asks for prod UAT, pilot ready, launch go/no-go, or to execute
  docs/plans/PROD-LAUNCH-UAT.md. Design-only requests stop at the catalog.
---

# Launch UAT (Vemoki production)

Catalog: [docs/plans/PROD-LAUNCH-UAT.md](../../../docs/plans/PROD-LAUNCH-UAT.md).
Role: [docs/agents/roles/launch-uat.md](../../../docs/agents/roles/launch-uat.md).
Browser/emulator policy: `.cursor/rules/uat-headless.mdc`.

## Trước khi chạy

1. Xác nhận user đã yêu cầu **chạy** UAT. Yêu cầu “thiết kế” thì dừng ở catalog, không đụng production.
2. Ghi SHA catalog (`git rev-parse HEAD` nếu file đã commit; nếu chưa commit, ghi “working tree” + hash nội dung file).
3. Không deploy, không sửa realm, không in `/opt/vemoki/.env`.

## Cách drive

- Web prod: `orca tab create --url <url> --worktree path:<repo> --json` rồi `orca exec --page <id>`.
- HTTP smoke (không thay UI): `curl` status + redirect. Không dùng cookie session của user.
- iOS: boot local build, `orca emulator attach`. Không EAS Cloud Build. Máy thật USB: skill [ios-usb-device](../ios-usb-device/SKILL.md) — chọn **prod** vs **local API**, không trộn extras.
- Ảnh: `apps/web/.uat-artifacts/prod-launch-<date>/` hoặc `apps/mobile/.uat-artifacts/` (gitignored). Evidence trỏ path đó.

## Tài khoản

Chỉ user demo trong catalog. Không tạo user mới trên realm production trong lúc UAT.

## Kết quả

Một review file mới theo role. Verdict launch là `GO` hoặc `NO-GO`. `PASS with known gap` của DoD cũ không được nâng thành `GO`.

Epic [#914](https://github.com/hangndat/ticket-solution/issues/914) / S6: **iOS VoiceOver ngoài phạm vi / quyết định owner** — không phải case catalog, không known gap, không chặn đóng Epic.

[O27](../../../docs/DECISION-LOG.md): guest **không** NativeTabs / catalog Sự kiện; attendee verified chỉ Sự kiện + Vé của tôi; privacy **native** (không WebView); staff đổi sự kiện chỉ header SF icon; banner **per-event** (không tô cả list từ event đầu). Không FAIL UAT theo AC guest-tab hoặc WebView privacy cũ.
