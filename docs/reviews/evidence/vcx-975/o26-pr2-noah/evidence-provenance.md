# O26-PR2 Noah evidence — provenance

## Canonical F01 pass (@ `ebb2fa3f`)

| Artifact | Role |
| --- | --- |
| [`f01-visual-verify-ebb2fa3f.json`](f01-visual-verify-ebb2fa3f.json) | Latest probe |
| [`f01-drawer-visual-390x844-ebb2fa3f.png`](f01-drawer-visual-390x844-ebb2fa3f.png) | Visible menu screenshot |

## e619 @ stale `.next` (FAIL — preserved)

| Artifact | Verdict |
| --- | --- |
| [`f01-visual-verify-e61986a9-fail.json`](f01-visual-verify-e61986a9-fail.json) | **FAIL** — `wrapper.x: -240` (stale build) |
| [`f01-visual-verify-e61986a9.json`](f01-visual-verify-e61986a9.json) | Interim PASS after clean build pre-`ebb2` (superseded) |

[`f01-visual-verify.json`](f01-visual-verify.json) points at latest `ebb2fa3f` probe.

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
