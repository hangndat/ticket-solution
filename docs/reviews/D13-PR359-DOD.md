# DoD — PR #359 (D13 S4-T2 upload IPA → ASC TestFlight evidence)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_aa07903e-0a77-4c5d-b1dd-3e4dbfefe038` · task `task_e65de529e990` · dispatch `ctx_41b48c69f0e0` (≠ implementer) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#307](https://github.com/hangndat/ticket-solution/issues/307) · Task [#326](https://github.com/hangndat/ticket-solution/issues/326) · PR [#359](https://github.com/hangndat/ticket-solution/pull/359) · paths: `docs/reviews/D13-S4-T2-UPLOAD.md`, `docs/reviews/D13-S4-T2-UPLOAD.json` |
| Architecture impact | **Không** — ASC upload evidence only; không đổi app source / OpenAPI / contracts |
| Commit SHA reviewed (PR tip) | `4fa9071e4d47cba755eb2ff76611e72f8c9ff67f` (`git rev-parse` + PR `headRefOid`, live verified) |
| IPA allowlist (S4-T1) | `docs/reviews/D13-S4-T1-LOCAL-ARCHIVE.json` · `ipaSHA256=37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7` · `ipaBytes=11722935` |
| Source provenance | `6002d09afa9382a72ee9840c8ba1dd41c7b09065` (PR #353 merge tip used for S4-T1) |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` first (ready); docs/ASC evidence — **source + local IPA + ASC read thắng** |
| Verdict | **PASS with known gap** |

---

## Checklist vs AC (Task #326 / PR #359)

| AC | Result |
| --- | --- |
| Exact tip SHA live = claimed | **PASS** — `git rev-parse HEAD` + `gh pr view 359` `headRefOid` = `4fa9071e4d47cba755eb2ff76611e72f8c9ff67f` |
| PR tip is evidence-only (no app source in tip commit) | **PASS** — tip adds only `D13-S4-T2-UPLOAD.md` + `.json` |
| IPA SHA256 matches S4-T1 allowlist `37c96607…` | **PASS** — live `shasum -a 256` on `apps/mobile/.expo/d13-release/export/Vemoki.ipa` = `37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7` ≡ S4-T1 JSON ≡ S4-T2 MD/JSON; bytes `11722935` |
| Delivery UUID recorded | **PASS** — `45c730c3-7caa-4b28-92fb-315cf07bce5d` in MD/JSON + local `/tmp/d13-s4-t2-upload/altool-upload.log` (`UPLOAD SUCCEEDED`) |
| `processingState=VALID` + TF Internal evidence | **PASS** — ASC API read (spot-check, no mutate): build `10`, `processingState=VALID`, `preReleaseVersion=1.0.0`, `internalBuildState=IN_BETA_TESTING`, `externalBuildState=READY_FOR_BETA_SUBMISSION` |
| Team `BLUA62D52G` | **PASS** — claimed in MD/JSON; matches personal team policy + S4-T1 allowlist |
| No EAS / Expo Cloud Build | **PASS** — JSON `cloudBuild:false`; MD + PR body: `xcrun altool` local only |
| No Submit / release | **PASS** — JSON `submittedForReview:false` / `released:false`; ASC ASV `1.0.0` still `PREPARE_FOR_SUBMISSION` / `releaseType=MANUAL` |
| No secrets in commit | **PASS** — tip = docs only; API Key ID `KHT3SAL2FS` (public id); path to `.p8` documented, key/issuer/IPA not committed; no Submit/release secrets |
| Honest limitations | **PASS** — chưa External TF group; chưa physical-device smoke; ≠ Submit (#332) / publish |

---

## Checks (exact tip SHA `4fa9071e4d47cba755eb2ff76611e72f8c9ff67f`)

```bash
git rev-parse HEAD
# → 4fa9071e4d47cba755eb2ff76611e72f8c9ff67f

gh pr view 359 --json headRefOid
# → 4fa9071e4d47cba755eb2ff76611e72f8c9ff67f

IPA=apps/mobile/.expo/d13-release/export/Vemoki.ipa
shasum -a 256 "$IPA"
# → 37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7
stat -f%z "$IPA"
# → 11722935

# Local altool log (host path, not in git):
rg "UPLOAD SUCCEEDED|Delivery UUID" /tmp/d13-s4-t2-upload/altool-upload.log
# → UPLOAD SUCCEEDED; Delivery UUID: 45c730c3-7caa-4b28-92fb-315cf07bce5d

# ASC read-only (JWT from local AuthKey_KHT3SAL2FS.p8; GET only):
# GET /v1/builds/45c730c3-7caa-4b28-92fb-315cf07bce5d?include=preReleaseVersion,buildBetaDetail
# → version=10, processingState=VALID, preReleaseVersion=1.0.0,
#    internalBuildState=IN_BETA_TESTING, externalBuildState=READY_FOR_BETA_SUBMISSION
# GET /v1/apps/6823694490/appStoreVersions
# → 1.0.0 PREPARE_FOR_SUBMISSION MANUAL (chưa submit)
```

| Check | Result |
| --- | --- |
| Tip SHA live | **match** |
| IPA SHA256 / bytes vs S4-T1 allowlist | **match** |
| altool Delivery UUID | **match** |
| ASC processing / Internal TF | **VALID / IN_BETA_TESTING** (read-only) |
| ASV submit/release | **not submitted** |
| Secrets / EAS in tip | **none** |
| Mutating ASC / merge / submit | **not performed by reviewer** |

---

## Findings

### Residual nits (do not block PASS)

1. **Build number vs prior TF train** — prior train `0.1.0` max build `11`; new train `1.0.0` build `10` is not numerically greater. Artifact explains Apple uniqueness is `(CFBundleShortVersionString, CFBundleVersion)` per train; Apple accepted upload → VALID + Internal TF. AC wording «build > prior TF» is satisfied at marketing-version boundary, not cross-train integer order.
2. **CRG lag** — graph `built_at_sha` may lag this tip; conclusions from live git + IPA + ASC API.
3. **altool log host-local** — `/tmp/d13-s4-t2-upload/altool-upload.log` not in repo; corroborated by ASC Delivery/build id + VALID state.

### Known gaps (intentional — do not treat as submit/publish DoD)

- Chưa gắn External TestFlight group (`READY_FOR_BETA_SUBMISSION` only).
- Chưa physical-device smoke / signed-in E2E trên binary TF này.
- Chưa Submit for Review (#332), chưa release / Ready for Sale.
- Upload + Internal TF **không** đóng publish / pilot-ready.

Các gap trên **đã được artifact ghi rõ** và khớp AC Task #326 (upload/processing ≠ publish). Không phải finding ẩn.

---

## Verdict

**PASS with known gap** cho PR #359 tip `4fa9071e4d47cba755eb2ff76611e72f8c9ff67f`: evidence upload local `altool` khớp S4-T1 IPA allowlist `37c96607…`, Delivery UUID `45c730c3-…`, ASC `processingState=VALID` + Internal `IN_BETA_TESTING`, team `BLUA62D52G`, không EAS, không submit/release/secrets trong commit. Gap có chủ đích: External TF / device smoke / Submit (#332) / publish — không đủ để tuyên bố store submit.

Không merge / submit / release trong session reviewer này.
