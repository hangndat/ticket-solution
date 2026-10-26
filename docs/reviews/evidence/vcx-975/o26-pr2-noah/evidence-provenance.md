# O26-PR2 Noah evidence — provenance

## Canonical F01 pass (@ `e61986a9`)

| Artifact | Role |
| --- | --- |
| [`f01-visual-verify-e61986a9.json`](f01-visual-verify-e61986a9.json) | Rects + nav click |
| [`f01-visual-verify.json`](f01-visual-verify.json) | Same run (latest pointer) |
| [`f01-drawer-visual-390x844-e61986a9.png`](f01-drawer-visual-390x844-e61986a9.png) | Screenshot — visible menu |

## Historical F01 fail (@ `af6374bd`)

| Artifact | Verdict |
| --- | --- |
| [`f01-visual-verify-af6374bd-fail.json`](f01-visual-verify-af6374bd-fail.json) | **FAIL** — `wrapper.x: -240` |
| [`f01-drawer-visual-390x844-af6374bd-fail.png`](f01-drawer-visual-390x844-af6374bd-fail.png) | **FAIL** visual |
| [`f01-drawer-visual-390x844.png`](f01-drawer-visual-390x844.png) | Duplicate of af637 fail capture (legacy path) |
| [`f01-drawer-open-390x844.png`](f01-drawer-open-390x844.png) | **Invalid** — DOM-only false PASS |

## Shell matrix (not drawer proof)

`final-shell-{390,1024,1440}*.png` @ `af6374bd` — smoke only.

## Retest notes

See [`F01-RETEST.md`](F01-RETEST.md). UAT required clean portal production build before `next start` (stale `.next` served pre-fix drawer behavior once).
