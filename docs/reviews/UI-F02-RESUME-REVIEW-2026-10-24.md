# #859 — Revalidation độc lập F02 (resume batch)

> Coordinator sau review: candidate trong báo cáo này đã được thu hồi do F02-SEC-02. Source cuối trở về hash trước batch; xem [báo cáo tổng hợp](UI-FIXALL-2026-10-23.md). Verdict và foreground proof bên dưới chỉ áp dụng candidate được fingerprint tại lúc review, không áp dụng cho source sau rollback.

**Tóm tắt (cập nhật bổ sung evidence `task_f7d4a003b43a`).** Batch Zico giữ generation guard, sửa eligibility flicker + `runForegroundSync` chain — **38/38** targeted tests + typecheck PASS trên `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` dirty. **Runtime mới (harness đúng):** vé `29aec431-…` ACTIVE trong `ticket_fixall_859`, UUID **36 ký tự** qua AX, offline queue >5s, proxy online → Home → relaunch → **25s foreground «Được vào»** không manual sync ([uat-29aec-foreground-summary.txt](assets/UI-F02-RESUME-REVIEW-2026-10-24/uat-29aec-foreground-summary.txt)). Lượt trước **tenant-not-found** là lỗi harness (DB sai tên + UUID không đủ / trùng khi gõ), **không** chứng minh fixture inactive. **F02-SEC-02** (chrome staff user A trong lúc `establish` user B) vi phạm O02 fail-closed — **Security FAIL**, không PASS-with-gap. **DoD** vẫn **FAIL** cho #859: M10 restart `ffea00b3-…` chưa chạy; orphan `6c812d24-…` chưa đóng; một ca foreground không thay mandatory gap toàn exception.

## Provenance

| Mục | Giá trị |
| --- | --- |
| Reviewer | James · `reviewer-dod` / `reviewer-merged.md` · `dod+sec+ux` |
| Session | `task_6c065e8fa1b5` + `task_f7d4a003b43a` + M10 `task_7290c4191204` · dispatch `ctx_e70df376ee01` / `ctx_0256c986ce03` |
| Implementer | Zico · `ctx_02eb58763524` (≠ reviewer) |
| HEAD | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` · **dirty** · không integrated SHA |
| Hash delta | [source-hashes-delta.json](assets/UI-F02-RESUME-REVIEW-2026-10-24/source-hashes-delta.json) |
| Simulator | `UI-FixAll-859` / `B0727247-340D-423A-8547-A6C107A9756A` · Debug 26 · 393×852 @3 · VI |
| DB fixture | `docker … -d ticket_fixall_859` — [db-ticket-fixall-859.txt](assets/UI-F02-RESUME-REVIEW-2026-10-24/db-ticket-fixall-859.txt) |
| Metro / bundle | `[::1]:8083` (sim TCP); manifest [metro-manifest-ticket-public.json](assets/UI-F02-RESUME-REVIEW-2026-10-24/metro-manifest-ticket-public.json) · `apiBaseUrl` **3009** |
| Staff JWT | Refresh `private/refresh-native-staff.mjs` + một lần `open-staff-session.mjs`; metadata [jwt-staff-metadata.json](assets/UI-F02-RESUME-REVIEW-2026-10-24/jwt-staff-metadata.json) (không token) |
| Proxy cuối | `mobile-proxy-mode.txt` **online** · `:3009/v1/health` **200** |

### Loaded config vs manifest

Manifest Expo tại `http://[::1]:8083/` bake `extra.ticketPublic.apiBaseUrl=http://127.0.0.1:3009` (khớp root 16:28Z). **Chưa** có introspection in-app độc lập; bằng chứng: manifest + sim kết nối Metro `[::1]:8083` + ca offline (proxy health **000**) → queue UI (chứng minh client dùng base có proxy khi submit). Root quan sát proxy PID 5660 không log trong lượt harness sai — **không** suy app bỏ 3009 khi UUID đủ và flow đúng.

## Findings ổn định

| ID | Trạng thái / chặn | Evidence | Điều kiện đóng |
| --- | --- | --- | --- |
| **F01** | **Đóng** (kế thừa) | Hash/config tests không đổi trong batch F02. | — |
| **F02** | **Mở — blocker một phần / Có** | Exception: foreground `abd2` fail + orphan `6c812d24-…`. **Bổ sung:** batch + harness đúng → ca `29aec431-…` foreground **25s APPLIED** ([f02-29aec-foreground-25s.png](assets/UI-F02-RESUME-REVIEW-2026-10-24/f02-29aec-foreground-25s.png), [ax-foreground-25s.json](assets/UI-F02-RESUME-REVIEW-2026-10-24/ax-foreground-25s.json)). Chưa: M10 restart cùng op; History/pending badge terminal chưa AX đủ; orphan lifecycle. | M10 + pending=0 + History; quyết định orphan; không miễn gap bằng một ca. |
| **F02-ENV-01** | **Đã sửa — đóng (harness)** | Trước: query nhầm DB `ticket_solution` (rỗng) + PNG không AX length → kết luận sai «fixture inactive». Sau: `ticket_fixall_859` ACTIVE; char-by-char type → AX 36 chars. | — |
| **F02-CODE-01** | **Đã xác minh** | Source/tests batch (eligibility + foreground chain). | — |
| **F02-SEC-02** | **Mở — Security blocker / Có** | Probe `SessionBoundary`: `establish(staffA)` → `refresh` true → `establish(attendeeB)` → `refresh` in-flight → **`{staffEligible:true, resolved:true, loading:true}`** ([cross-identity-eligibility-probe.txt](assets/UI-F02-RESUME-REVIEW-2026-10-24/cross-identity-eligibility-probe.txt)). `_layout.tsx` verified→verified chỉ `refresh`, không `reset` khi `userId` đổi. `isStaffWorkspace` = `resolved && staffEligible` → **staff chrome có thể hiện cho B** trước MeEvents B (O02 deny-by-default / SEC-CACHE: không persist eligible, nhưng **ephemeral chrome sai owner** vẫn là lỗi authz UI). Batch **cố ý** giữ snapshot cùng user khi revalidate — **không** miễn cross-user. Gate API vẫn bearer B (server SoT) — phân biệt **class probe** vs **lifecycle UI**; cả hai đều cần fail-closed chrome khi identity đổi. | `reset` hoặc clear `staffEligible` khi `identity.userId` thay đổi; test hồi quy; không PASS security với gap. |
| **F02-M10** | **Mở — chưa đạt / Có** | `ffea00b3-…`: offline queue chứng minh ([f02-m10-ffea-queued-offline-8s.png](assets/UI-F02-RESUME-REVIEW-2026-10-24/f02-m10-ffea-queued-offline-8s.png)). `simctl terminate`+`launch` (no logout): cold start **attendee Events** lỗi tải offline rồi recover sau «Thử lại» — **không** terminal gate/History trong budget ([m10-ffea-restart-summary.txt](assets/UI-F02-RESUME-REVIEW-2026-10-24/m10-ffea-restart-summary.txt)). `clientEventId` chưa đọc từ UI; root query DB theo `ticket_id=ffea00b3-4c99-4293-abe6-053c81b469b4`. | Relaunch → cùng op terminal + pending=0 + `clientEventId` khớp partition. |

### Artifacts mislabeled (sửa metadata)

| File cũ | Ghi chú đúng |
| --- | --- |
| `f02-queued-offline-6s.png`, `f02-da4a-offline-8s.png`, `f02-offline-queued-7s-v2.png` | Terminal **Không tìm thấy vé** — harness UUID, **không** offline queue |
| `f02-29aec-queued-offline-8s.png`, `ax-queued-offline-8s.json` | **Offline queue** đúng contract |

## Checks (reviewer)

```text
targeted tests (staff-eligibility, staff-regression, offline-scan-reconciliation, config, retail-public-guard, dev-only-routes) → 38/38 PASS
apps/mobile: npm run typecheck → PASS
ui-evidence-check.sh assets/UI-F02-RESUME-REVIEW-2026-10-24 → OK
```

## UAT native (Orca) — ca `29aec431-…`

Xem [uat-29aec-foreground-summary.txt](assets/UI-F02-RESUME-REVIEW-2026-10-24/uat-29aec-foreground-summary.txt). Không rebind JWT giữa restart flow (chỉ trước ca). Không test vé owner / không reset USED.

## Verdict

| Gate | Verdict |
| --- | --- |
| **DoD** | **FAIL** — M10 + orphan + phạm vi exception chưa đủ; đã có **một** foreground APPLIED sau batch (không thay toàn #859). |
| **Security** | **FAIL** — **F02-SEC-02** cross-user staff chrome window; revoke/401/unknown trên path đã review vẫn fail-closed nhưng **không** đủ PASS khi batch mở rộng eligibility snapshot. |
| **UI/UX** | **FAIL còn phạm vi #859** — ca `29aec431` foreground feedback **đạt**; History/pending chưa chứng minh; exception stale chưa revalidate đủ. |

**Code complete (batch):** có. **Local software acceptance:** chưa (M10, orphan, security). **Pilot ready:** chưa.

## Giới hạn

- Không sửa business source / commit / spawn.
- Không in JWT/password; không reset SecureStore/DB.
- `clientEventId` durable chưa trích từ UI/DB local trong phiên bổ sung.
