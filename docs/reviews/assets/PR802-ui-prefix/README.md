# PR #802 — interest-form UAT (prefix `ui:`)

| Trường | Giá trị |
| --- | --- |
| **PR** | [#802](https://github.com/hangndat/ticket-solution/pull/802) |
| **Issue** | [#787](https://github.com/hangndat/ticket-solution/issues/787) |
| **SHA (after)** | `dc2ee0393be95a5fe5e2def8047513d91970c5b9` |
| **SHA (before)** | `fb3396fdc88c1ee1d455d7e71bb37a05bbc9be03` (`origin/main`, dev `:3001`) |
| **URL** | `http://127.0.0.1:3000/marketing#interest-form` (vi) |
| **Capture** | `node apps/web/tests/pr802-ui-prefix-evidence.mjs <baseUrl> before\|after` |

## Ma trận (4 state × 2 viewport × before/after)

| File | Base | Viewport | State | Ghi chú |
| --- | --- | --- | --- | --- |
| `before-default-1280.png` | main `:3001` | 1280×900 | default | crop form (`scrollIntoView`) |
| `before-hover-1280.png` | main | 1280×900 | hover submit | |
| `before-focus-visible-1280.png` | main | 1280×900 | Tab → email, focus-visible | form element |
| `before-loading-1280.png` | main | 1280×900 | submit in-flight | `aria-busy`, spinner |
| `before-default-390.png` | main | 390×844 | default | |
| `before-hover-390.png` | main | 390×844 | hover submit | |
| `before-focus-visible-390.png` | main | 390×844 | focus-visible | |
| `before-loading-390.png` | main | 390×844 | loading | |
| `after-default-1280.png` | branch `:3000` | 1280×900 | default | form element |
| `after-hover-1280.png` | branch | 1280×900 | hover submit | |
| `after-focus-visible-1280.png` | branch | 1280×900 | focus-visible | viewport (ring/caret) |
| `after-loading-1280.png` | branch | 1280×900 | loading | |
| `after-default-390.png` | branch | 390×844 | default | |
| `after-hover-390.png` | branch | 390×844 | hover | |
| `after-focus-visible-390.png` | branch | 390×844 | focus-visible | |
| `after-loading-390.png` | branch | 390×844 | loading | |

**Verify:** `bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR802-ui-prefix` → `OK`.
