# UI-F02-RESUME-REVIEW-2026-10-24

Simulator **UI-FixAll-859** `B0727247-340D-423A-8547-A6C107A9756A`, 1179×2556 px.

## Harness / env

| File | Mô tả |
| --- | --- |
| `db-ticket-fixall-859.txt` | Ticket states trong DB đúng `ticket_fixall_859` |
| `metro-manifest-ticket-public.json` | Expo dev manifest `ticketPublic` (API 3009) |
| `jwt-staff-metadata.json` | `iat`/`exp`/`sub` only |
| `ax-uuid-36chars-proof.txt` | AX TextField length 36 |

## Ca `29aec431-…` (foreground APPLIED)

| File | Mô tả |
| --- | --- |
| `f02-preview-modal.png` | Preview trước submit |
| `f02-29aec-queued-offline-8s.png` | Offline queue panel |
| `ax-queued-offline-8s.json` | AX: «Offline — chờ đồng bộ», value UUID đầy đủ |
| `f02-29aec-foreground-25s.png` | Sau Home→app 25s, «Được vào» |
| `ax-foreground-25s.json` | AX terminal admit |
| `uat-29aec-foreground-summary.txt` | Lệnh flow tóm tắt |

## M10 `ffea00b3-…` (restart — incomplete)

| File | Mô tả |
| --- | --- |
| `f02-m10-ffea-queued-offline-8s.png` | Offline queue sau submit |
| `ax-m10-queued-offline.json` | AX queued state |
| `f02-m10-ffea-after-restart-30s.png` | Cold start attendee Events (chưa gate terminal) |
| `ax-m10-after-restart-30s.json` | AX sau relaunch |
| `m10-ffea-restart-summary.txt` | Flow + DB lookup hint cho root |

## Mislabeled (lượt harness sai — giữ để audit)

`review-start-state.png`, `f02-queued-offline-6s.png`, `f02-da4a-offline-8s.png`, `f02-offline-queued-7s-v2.png` — **tenant-not-found**, không queue.
