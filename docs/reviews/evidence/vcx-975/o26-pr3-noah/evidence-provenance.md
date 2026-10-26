# O26-PR3 Noah UAT — provenance

| Trường | Giá trị |
| --- | --- |
| Runner | Noah (fixture/UAT) |
| Issue / PR | #975 · draft [#982](https://github.com/hangndat/ticket-solution/pull/982) |
| **codeSha (exact)** | `ecda980af0231466c62164d9c77f308e779d0291` |
| Tip lúc chạy | `ecda980a` — sau `317ab62d` (fix analytics 403 title) + `chore(portal): drop analytics source-string regression test` |
| Portal | `http://uat975pr3.localhost:3021` · OIDC client `ticket-admin-web-vcx975-uat975pr3` (dedicated, ≠ #928) |
| API | `http://127.0.0.1:3542` read-only (reuse `vcx932-noah`) |
| Driver | Orca `tab create` + `exec` (snapshot/screenshot/viewport) |
| Screenshot (gitignored) | `apps/portal/.uat-artifacts/vcx975-pr3/*` |
| Machine JSON | **`uat-results-ecda980a.json`** (matrix 3 viewport và route, PASS with GAP) |
| Harness | `.local-dev/.uat-artifacts/vcx975-noah-pr3/` — fork `vcx975-noah-shell` scripts, env port **3021** |

Không bootstrap/drop `ticket_d9_demo`. Không sửa product code trong phiên này.
