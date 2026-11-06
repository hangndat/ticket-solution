# Review #1233 — Staff Gate quét vé và kết quả

- Reviewer: James `dod+sec+ux`, session `049c1c5b-fb99-43e8-8351-afd75c830d13`, độc lập Zico/Dispatch `ctx_4c25bf3ec18d`. Fix counter **1/2**.
- Scope: initial mobile diff `fc17fdd24cce3104108a4a25f50ce7cd131211ce` → `bc073a8fbfb6f7625a4f9776431cf7e331629e27`; revalidate fix diff → exact SHA `f55e102bb1c7bf2271cb04ef525dc69422313674`. Architecture impact **Không**: không đổi API/contract. Decision IDs: PRD M10; O23/O31/O32/D12.
- CRG ticket: cập nhật từ base, stats 1,645 files/10,390 nodes, `head_matches_build=true` tại SHA trên; `get_review_context` và `file_summary(staff-scan.tsx)` đã query. Source/ảnh/AX là evidence chính.
- Checks trên SHA: worker báo typecheck PASS, 573/573 tests PASS, lint 0 error/8 warning, mobile UI budget PASS, local Xcode Release simulator PASS, `git diff --check` PASS. Reviewer đối chiếu source và artifact, không chạy lại suite.
- Visual pin xác minh SHA-256: Gate scan `88d511a7800838d35bc2890491ba9d17ebc95c621e3a3b63a20a31794b6edb0a`; status `da152b37e1b8c70bac6d22ebf51d164b79ad5d194685624c857923118a49d865`; board `eca0dbc1e391c22521f97e697200877cf9c0d2844f3520c1b1e4e43b3849efcf`. D12 mới hơn legend ảnh.

## Findings và điều kiện đóng

| ID | Mức | Finding / căn cứ | Điều kiện đóng |
| --- | --- | --- | --- |
| G1233-01 | P1, **đã đóng tại `f55e102`** | Initial SHA: `staff-gate-workspace-context.tsx` chỉ chặn lock/cùng payload, nên callback khác QR có thể vượt kết quả pending trước re-render. | Fix đã revalidate: handler và `submitScan` đều chặn bằng refs đồng bộ; test callback khác QR lúc lock/busy/pending và sau “Quét tiếp”. |
| G1233-02 | P1, chặn UI/DoD acceptance | Artifact `gate-guest-390.png` SHA `b41b9975c2b9126a3e1027d54345af2d28f8b16ba08f590fadab80e56d5034b6` và AX SHA `180385161a5555f1d5095c8e53f4e786fc6f281801aed360ede6d4170b282fee` đều là **guest Events**, có lỗi khôi phục phiên; ảnh/AX không chứa Staff Gate. SecureStore session restore chặn verified staff. Vì vậy AC1 (event/gate/idle), AC2 (camera/scroll/tab), AC3 (5 kết quả/tone/CTA) đều **GAP runtime**; camera vật lý cũng chưa có evidence. | Cung cấp build/phiên staff verified hợp lệ, ảnh+AX 390×844 của các state AC1–AC3, hành trình nút/scroll/permission và bằng chứng camera thiết bị theo AC; so lại với visual pin/D12. |

## Verdict tách riêng

- **DoD: FAIL.** G1233-01 đã đóng trên fix SHA; AC1–AC3 chưa nghiệm thu runtime theo G1233-02. Picker event ở header, 0-gate explicit open, overlay/CTA trong scroll và padding safe area có code evidence, chưa có Staff Gate runtime.
- **Security: PASS (code scope trên fix SHA).** Guard đồng bộ chặn quét QR khác khi lock/busy/pending trước khi sửa feedback; “Quét tiếp” mới nhả pending. Reserve/confirm vẫn đi backend; `applyConfirm` chỉ tạo `admitted` từ HTTP 200/201 + `USED` + `checkinId`; `canReconcile` chỉ với unknown có reservation/token. Queued/used/denied/unknown không xanh hoặc “Được vào”. Không thấy diff dependency, secret, tenant/RBAC contract.
- **UI/UX: FAIL.** Native critique theo source và visual pin; guest screenshot đã mở và đối chiếu AX, chỉ chứng minh guest. Chưa thể đánh giá thực tế overlay, CTA, Dynamic Type, safe area hoặc camera Staff; không gọi UI PASS từ mapping/unit tests.

## Revalidation fix 1/2 — `f55e102bb1c7bf2271cb04ef525dc69422313674`

- CRG ticket đã update và stats đúng HEAD (1,645 files, 10,394 nodes); `get_review_context` trên base `bc073a8` thấy 3 mobile files đổi. Reviewer đọc toàn fix diff và các đường `applyScanResult`, `submitScan`, `handleCameraScan`, `dismissPendingAction`, offline replay, reconcile.
- `pendingOpRef` được đặt trước `setPendingOp` trong `applyScanResult` và offline replay; `busyRef` đặt trước `setBusy`; lock lấy trước mọi state update/await. Cả native callback và `submitScan` gọi `isScanIntakeBlocked`; callback khác QR không thể thay payload/generation khi pending. `dismissPendingAction` xóa ref cùng toast/timer, nên “Quét tiếp” mở lượt mới. `reconcile` vẫn dùng `canReconcile`; offline replay vẫn dùng `needsStickyPendingOp` và có thể publish terminal feedback. Regression test `a different QR callback...` bao phủ lock/busy/pending trước re-render, release và same-QR dedupe.
- Worker báo fix SHA: 574/574 tests, typecheck, lint (0 error/8 warning), UI budget, diff check, local Xcode Release đều PASS; reviewer không chạy lại suite. **G1233-02 vẫn OPEN**: report mới không có ảnh/AX Staff verified, chỉ guest, nên DoD/UI FAIL và không kết luận pilot ready.

**Coordinator evidence mới, chờ reviewer — build 50 / `b5a9f0ee`:** USB iPhone 16 Pro có Staff verified, sự kiện/cổng tổng hợp và màn Quét vé ở trạng thái camera tắt, nút Mở phiên cổng. Ảnh `usb-staff50-scan.png` cùng hash/provenance trong `apps/mobile/.uat-artifacts/d6/usb-verified-staff-report.md`. AC1 entry/idle có evidence bước đầu; chưa bấm mở phiên, cấp camera, quét QR hoặc đi qua năm kết quả, và viewport 402×874 pt. G1233-02/DoD/UI vẫn mở.
