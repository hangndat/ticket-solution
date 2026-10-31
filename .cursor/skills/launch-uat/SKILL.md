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

[O33](../../../docs/DECISION-LOG.md): iOS/web a11y (VoiceOver, Dynamic Type, WCAG UAT) **OUT / N/A** MVP/pilot — không chạy, không known gap, không chặn #879/#889/#874/#1008/#914. Khớp O28 VoiceOver-ngoài-#914; **thay** leftover a11y hold VD-06/VD-08.

[O28](../../../docs/DECISION-LOG.md) (sửa O27 §3–§4): guest NativeTabs **Sự kiện + Đổi mã**; verified **Sự kiện + Đổi mã + Vé của tôi**; Đổi mã là tab (không footer Events); header guest → OIDC. Privacy **native**; staff đổi sự kiện chỉ header SF icon; banner **per-event**. Không FAIL UAT theo AC guest-no-tabs hoặc WebView privacy cũ.

[O23](../../../docs/DECISION-LOG.md#o23--gate-chỉ-trên-ios-staff-chốt-hướng-thiết-kế-vemoki-24102026) + D-6 [#788](https://github.com/hangndat/ticket-solution/issues/788)/[#804](https://github.com/hangndat/ticket-solution/pull/804) + residual [#878](https://github.com/hangndat/ticket-solution/issues/878): **bỏ Web Gate**. Catalog A04/B04/E = OUT/`N/A`. **`308→/` không FAIL.** Không khôi phục `apps/web/app/gate`. Cổng = iOS Staff (suite G / #879 — không nhầm O31). Portal hint iOS (#806/#808).
