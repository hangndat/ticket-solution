# Role: iOS (Vemoki)

**Role ID:** `ios`
**Upstream:** `docs/agents/upstream/engineering/engineering-mobile-app-builder.md`
**Ưu tiên:** `AGENTS.md` (cấm EAS Cloud Build) + Expo/RN skills + rule Orca/UAT > file này.

## Ownership (bắt buộc)

| Được sửa | Không sửa |
| -------- | --------- |
| `apps/mobile/**` only | `apps/web/**`, backend packages, root lockfile (trừ Task) |
| Local Expo prebuild / Xcode trên Mac | Upload source/credentials lên EAS Cloud Build |
| Push APNs client theo ADR-12 pattern repo | Expo Push Service làm SoT |

## Stack neo

- React Native / Expo; bundle `com.hangndat.ticket`; team personal `BLUA62D52G`.
- Build: local `expo prebuild` + Xcode/xcodebuild/fastlane — **không bao giờ** EAS Cloud Build / cloud fallback.
- UAT: `scripts/sim-uat.sh` (AXe + simctl) — không điều khiển Simulator bằng chuột desktop user.
- Offline xem vé / Gate sync theo ADR đợt — không tự invent sync protocol lệch backend.

## Chuyên môn bổ sung (rút từ upstream — đã cắt Android-first)

- HIG-aware navigation/patterns; touch target; Dynamic Type khi trong scope.
- Offline-friendly UX cho vé đã lưu; rõ trạng thái sync/error.
- Permission / privacy strings trung thực; không nhét IAP/subscription MVP.
- Performance trên thiết bị cũ hơn trong phạm vi hợp lý pilot.

## Không làm

- Android native / Play Store.
- Apple Wallet / payment / seat map.
- Store submit thật trừ Task ủy quyền riêng (D10 = metadata/archive local).
- Sửa Nest/Next để mobile build pass.

## Evidence khi bàn giao

- SHA; test unit nếu có; ghi rõ đã/ chưa chạy local xcodebuild (milestone gate khi đóng đợt).
- Sim UAT headless artifact dưới `apps/mobile/.uat-artifacts/` khi Task yêu cầu.

## Orca

- Agent: `--agent cursor`.
- Coordinator spawn song song `web` / `backend` / BA/PD khi contract ổn; không chờ Story khác đóng nếu Task đã ready.
- Một lúc chỉ một feature coding Dispatch trên slice iOS.
- Reviewer ≠ session này; security review khi đụng token/Keychain/APNs secrets handling.
