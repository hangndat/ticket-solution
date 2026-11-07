# D6.1 / #1242 — manifest con trỏ evidence

Manifest này không chứa ảnh, token hoặc credential. Các đường dẫn `.uat-artifacts` bị gitignore; coordinator đã copy 129 PNG token-free vào checkout này. PNG không thay thế manifest gốc, AX/action, fixture hoặc build receipt. Ma trận: [d61-45-acceptance-draft.md](d61-45-acceptance-draft.md).

| Nhóm | Candidate copy trong `apps/mobile/.uat-artifacts/d61-matrix-inputs/` | Provenance / receipt còn ở worktree nguồn | Source/build SHA |
| --- | --- | --- | --- |
| M1 wallet #1244 | `wallet/` 18 PNG | [PR #1244 receipt/comment](https://github.com/hangndat/ticket-solution/pull/1244#issuecomment-6702058261), raw AX/fixture tại `d6/issue1237-uat-ccaa0d41/` | `ccaa0d4176ba2a092029fdded7fe91899ca27cef` |
| M1/VF03 #1251 | `wallet-vf03-receipt.md`, `vf03/` 5 PNG | [PR #1251 review](https://github.com/hangndat/ticket-solution/pull/1251#issuecomment-6705246606), `vf03/receipt-311a87a7/` có manifest/AX/fixture | `311a87a7b4ea9028c460db41c5e335a540534716` |
| M2 attendee #1248 | `attendee-evidence.md`, `attendee/` 38 PNG | [PR #1248 receipt/comment](https://github.com/hangndat/ticket-solution/pull/1248#issuecomment-6703407665), `d6/pr1248-uat-exact/` có manifest/AX/fixture | `fd3af6ee5f34d8c1ff76aeed2b9615b346e5a70f` |
| M3 account #1249 | `account-report.md`, `account/` 19 PNG; `account-fix1-report.md`, `account-fix1/` 7 PNG | [PR #1249 review](https://github.com/hangndat/ticket-solution/pull/1249#issuecomment-6704018232), `d61-1239/` và `fix1/` có manifest/AX/fixture | `a1c8bd04a1f4699d04ee17116c76e6b90ec77d4f`; fix1 `957f0987fcbb68672b1d6b962118254527a61f81` |
| M4 Gate #1250 | `gate-report.md`, `gate-keyboard.md`, `gate/` 38 PNG | [PR #1250 review](https://github.com/hangndat/ticket-solution/pull/1250#issuecomment-6704756634), `d61-1240/` có manifest/AX/runtime log; PR còn mở | `bd71988bf06a22505c1379861d97e7cb7e9e7be7` |
| M5 Web invite #1243 | `web/` 4 PNG | [PR #1243 receipt/comment](https://github.com/hangndat/ticket-solution/pull/1243#issuecomment-6701377099); browser 390×844, native WebView receipt còn thiếu | head `c180424eccaa2c9303c436bf31a3aa7f4aa9a147`; merge `084025ff0395b00df977089b4cd822f4a558d6f1` |
| Baseline WF | `docs/design/mobile-approved-wireframes-2026-11-05/README.md`, `MANIFEST.sha256` | 15 `originals/*.html`; browser screenshots theo từng row cần pin | Manifest HTML gốc; không phải app build |

Kiểm kê header/hash bản copy: 129 PNG, 127 digest khác nhau; 2 cặp trùng bytes trong `wallet/` được ghi ở ma trận. App iOS đều 1170×2532; WF/browser 390×844. `main` SHA `0fff8c681128ba362235a2bad72e0084f3b5876e` có CI run 42361340636 SUCCESS sau #1251 nhưng chưa gồm PR #1250. Không có final D6.1 integrated source/build SHA hoặc physical smoke receipt trong manifest này. Mọi row hiện GAP theo ma trận.
