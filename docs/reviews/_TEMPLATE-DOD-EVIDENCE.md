# DoD evidence template (copy per PR)

Reviewer ≠ implementer. **Exact SHA** bắt buộc.

| Trường | Giá trị |
| --- | --- |
| PR | # |
| Commit SHA | `git rev-parse HEAD` |
| CI on SHA | Output của `./scripts/gh-dod-evidence.sh <pr>` (không dùng `gh pr checks` trừ debug) |
| Verdict | PASS / FAIL / PASS with known gap |

```bash
gh auth switch --user hangndat
git rev-parse HEAD
./scripts/gh-dod-evidence.sh <pr>
```

Nếu GraphQL rate limit: chỉ REST + `git`; xem `.cursor/rules/github-api-hygiene.mdc`.
