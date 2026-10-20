# DoD review — PR #599 / Issue #598 (iOS gate scan-line)

| Trường | Giá trị |
| --- | --- |
| Reviewer | James (Orca worker · `task_ef499b3ca22d` / `ctx_7434c58af1da`) — **khác** implementer Nam |
| Issue | [#598](https://github.com/hangndat/ticket-solution/issues/598) — Camera QR viewfinder + scan-line |
| PR | [#599](https://github.com/hangndat/ticket-solution/pull/599) |
| Commit SHA | `240e9c789bcba351f986636ac3995710d76d4327` (`git rev-parse HEAD` on worktree `r-598-ios-scanline-review`, branch `pr-599`) |
| Scope | Chỉ `apps/mobile/src/gate/gate-camera.tsx` |
| Verdict | **PASS** |

## Acceptance criteria

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | Khung viewfinder 220×220 giữa preview | **PASS** — `FRAME_SIZE = 220`, overlay `alignItems/justifyContent: 'center'`, border 3px `rgba(255,255,255,0.6)`, `borderRadius: 24`. |
| 2 | Scan-line `#fb7391`, sweep 1.9s ease-in-out, lặp alternate; `Animated` core RN | **PASS** — `SCAN_SWEEP_MS = 1900`, `Easing.inOut(Easing.ease)`, `Animated.loop` + sequence `0 → SCAN_SWEEP_TRAVEL (190)` rồi ngược; tương đương CSS `alternate`. Glow `shadowColor #fb7391`, `shadowRadius: 14`, `shadowOpacity: 0.5`. |
| 3 | `active` = focused && !disabled — pause + ẩn khi không active | **PASS** — `scanning = granted && focused && !disabled`; overlay `opacity: scanning ? 1 : 0`; `barcodeScanningMode` vẫn `scanning`. Thêm `granted` chỉ khi đã có quyền camera (trước đó UI permission return sớm); khớp AC ẩn khi không quyền. |
| 4 | Reduce motion: đứng yên giữa, không shadow, không loop | **PASS** — `AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged`; `SCAN_LINE_REST_Y = 95`; static `translateY`; `scanLineGlow` null khi `reduceMotion`. |
| 5 | Overlay `pointerEvents="none"`, `accessibilityElementsHidden` | **PASS** — kèm `importantForAccessibility="no-hide-descendants"`. |
| 6 | Không đổi props / hành vi quét `GateCamera` | **PASS** — `Props` và `onScan` / `CameraView` giữ nguyên; chỉ thêm visual overlay. |
| 7 | `useState(() => new Animated.Value(0))`, không `useRef().current` | **PASS** — `const [scanLineY] = useState(() => new Animated.Value(0))`. |
| 8 | Unit test component RN | **N/A (cho phép)** — Issue không bắt buộc; logic animation gắn native camera, không tách pure helper — không coi thiếu. |

## Checks (trên SHA)

```text
git rev-parse HEAD
→ 240e9c789bcba351f986636ac3995710d76d4327

cd apps/mobile && npx tsc --noEmit -p tsconfig.json
→ exit 0

cd apps/mobile && npx eslint src/gate/gate-camera.tsx
→ exit 0

./scripts/gh-dod-evidence.sh 599
→ head.sha=240e9c789bcba351f986636ac3995710d76d4327 state=open mergeable=true
→ ci success, turbo-persist success, mobile success, changes success
→ d5-drills, d5-observability, database-isolation, portal, d5-rint, backend, web skipped
```

## Findings

| Mức | Finding |
| --- | --- |
| — | Không blocker. Animation dùng `Animated.loop` + hai `timing` thay vì một tween `alternate` — hành vi UX khớp mockup. |

## Limitations

- Reviewer không merge/commit code PR (theo Spec).
- Không chạy manual UAT trên thiết bị/simulator trong session reviewer; chỉ đối chiếu code + AC + CI/tsc/eslint.
- Local `tsc`/`eslint` chạy sau `pnpm install --frozen-lockfile` tại worktree review.

## Verdict

**PASS** — Diff khớp Issue #598 AC; `tsc`/`eslint` xanh trên file scope; CI GitHub trên exact SHA xanh (mobile + ci + changes; các job khác skip như kỳ vọng). Sẵn sàng merge (do coordinator).
