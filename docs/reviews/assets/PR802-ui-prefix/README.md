# PR #802 — interest-form UAT (prefix `ui:`)

| Trường | Giá trị |
| --- | --- |
| **PR** | [#802](https://github.com/hangndat/ticket-solution/pull/802) |
| **Issue** | [#787](https://github.com/hangndat/ticket-solution/issues/787) |
| **SHA (after)** | `d8347a5bbfea2ce1de01b8b27818761b40577cd5` |
| **URL** | `http://localhost:3000/marketing#interest-form` (vi) |
| **Browser** | Orca embedded tab `93b1abdf-4d14-468b-991d-e328fae71d90` |

## After (branch `hangndat/uif-787-ui-prefix`)

| File | Viewport | State |
| --- | --- | --- |
| `after-default-1280.png` | 1280×900 | default |
| `after-hover-1280.png` | 1280×900 | hover submit |
| `after-focus-visible-1280.png` | 1280×900 | focus email field |
| `after-loading-1280.png` | 1280×900 | submit in-flight |
| `after-default-390.png` | 390×844 | default |

## Before (`main`)

Baseline broken variant order (`variant:ui:*`) is documented in audit W-01 (Epic #786); no separate Orca capture on tip `main` in this run — hover/focus/disabled/placeholder utilities did not compile under `prefix(ui)` until this fix.
