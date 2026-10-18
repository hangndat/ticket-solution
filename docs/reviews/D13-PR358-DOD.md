# DoD — PR #358 (D13 S4-T1 local App Store IPA archive evidence)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD worker `term_8d5aa74b-b142-49cc-9351-9e18cd34dfe9` · task `task_e58085108c64` · dispatch `ctx_b16fd1ef52bb` (≠ implementer) |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Task [#325](https://github.com/hangndat/ticket-solution/issues/325) · PR [#358](https://github.com/hangndat/ticket-solution/pull/358) · paths: `docs/reviews/D13-S4-T1-LOCAL-ARCHIVE.md`, `docs/reviews/D13-S4-T1-LOCAL-ARCHIVE.json` |
| Architecture impact | **Không** — evidence-only IPA archive docs; không đổi source app / OpenAPI / contracts |
| Commit SHA reviewed (PR tip) | `58f03c5d479cd31c1ea6d8393b64d2000ae19f7e` (`git rev-parse` + PR `headRefOid`, live verified) |
| Source provenance (build input) | `6002d09afa9382a72ee9840c8ba1dd41c7b09065` — merge PR #353 on `main`; ancestor of tip |
| Prior source DoD (PR353) | Independent PASS-with-gap on tip `cbf84078c5423cb148c469fb64fb26f0436f2037` (behavior SHA `e72514bd…`) — cited for provenance only; **not** revalidated here |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` first; docs-heavy review — **source + local IPA spot-check thắng** |
| Verdict | **PASS with known gap** |

---

## Checklist vs AC (Task #325 / PR #358)

| AC | Result |
| --- | --- |
| Exact tip SHA live = claimed | **PASS** — `git rev-parse HEAD` + `gh pr view 358` `headRefOid` = `58f03c5d479cd31c1ea6d8393b64d2000ae19f7e` |
| PR tip is evidence-only (no app source in tip commit) | **PASS** — tip commit adds only the two `D13-S4-T1-LOCAL-ARCHIVE.*` files |
| Source provenance SHA recorded + exists | **PASS** — JSON/MD `sourceSha` = `6002d09afa9382a72ee9840c8ba1dd41c7b09065`; `git cat-file` = commit; ancestor of tip |
| IPA 1.0.0 (10), bundle `com.hangndat.ticket` | **PASS** — Info.plist `CFBundleShortVersionString=1.0.0`, `CFBundleVersion=10`, `CFBundleIdentifier=com.hangndat.ticket`, `MinimumOSVersion=16.4` |
| Distribution signing / team `BLUA62D52G` | **PASS** — `Authority=Apple Distribution: Hang Nguyen Dat (BLUA62D52G)`; `TeamIdentifier=BLUA62D52G` |
| App Store profile, no device list | **PASS** — profile name `iOS Team Store Provisioning Profile: com.hangndat.ticket`; `ProvisionedDevices=ABSENT` |
| APNs production | **PASS** — entitlements + profile `aps-environment=production` |
| No debug (`get-task-allow=false`) | **PASS** — entitlements + profile |
| `codesign --verify --deep --strict` | **PASS** — exit 0 on extracted app |
| Production endpoints in compiled bundle | **PASS** — `main.jsbundle` contains `https://api.vemoki.com`, `https://auth.vemoki.com/realms/ticket`, `ticket-mobile` |
| IPA SHA256 / size match JSON allowlist | **PASS** — live `37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7` / `11722935` bytes ≡ JSON |
| No binary / signing secrets committed | **PASS** — tip commit = docs only; IPA under `apps/mobile/.expo/` gitignored; no private keys / `.p12` / profiles in commit |
| Honest limitations (no upload / ASC validate / device smoke) | **PASS** — MD + JSON `uploaded:false` / `submitted:false` / `cloudBuild:false`; prose states no ASC processing, no signed-in E2E, no physical camera/push smoke |
| No EAS / Expo Cloud Build claimed | **PASS** — JSON `cloudBuild:false`; MD forbids Expo Cloud Build |

---

## Checks (exact tip SHA `58f03c5d479cd31c1ea6d8393b64d2000ae19f7e`)

```bash
git rev-parse HEAD
# → 58f03c5d479cd31c1ea6d8393b64d2000ae19f7e

gh pr view 358 --json headRefOid
# → 58f03c5d479cd31c1ea6d8393b64d2000ae19f7e

# Local IPA path from artifact (not uploaded):
IPA=apps/mobile/.expo/d13-release/export/Vemoki.ipa
shasum -a 256 "$IPA"   # → 37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7
stat -f%z "$IPA"       # → 11722935

# Extract + codesign / entitlements / profile / jsbundle string spot-check
# (see checklist; codesign --verify --deep --strict → exit 0)
```

| Check | Result |
| --- | --- |
| Tip SHA live | **match** |
| IPA path present locally | **yes** (gitignored) |
| IPA SHA256 / bytes | **match JSON** |
| Signing / APS / debug / team | **match claims** |
| Production config strings in `main.jsbundle` | **all three found** |
| Secrets in tip commit | **none** |
| Runtime UAT / ASC upload | **not claimed; not run by reviewer** |

---

## Findings

### Residual nits (do not block PASS)

1. **Branch vs tip scope** — `git diff main...HEAD` still lists many pre-existing D13 files on the branch history relative to local `main`; PR #358 tip commit itself is docs-only archive evidence (1 commit on PR). DoD scope = tip + named IPA artifact, not re-review of all ancestors.
2. **CRG lag** — graph `built_at_sha` may lag this worktree; conclusions from live git + IPA binary inspection.
3. **ipaPath absolute** — JSON records absolute Mac path; fine for local allowlist, not portable CI evidence.

### Known gaps (intentional — do not treat as publish/DoD close for store)

- Chưa upload / ASC processing / validate trên App Store Connect.
- Chưa chọn build cho draft, chưa submit / release.
- Chưa signed-in deletion E2E trên binary này; chưa physical-device camera / push smoke.
- Archive thành công **không** đóng gate publish / pilot-ready.

Các gap trên **đã được artifact ghi rõ** và khớp AC “honest limitations”; không phải finding ẩn.

---

## Verdict

**PASS with known gap** cho PR #358 tip `58f03c5d479cd31c1ea6d8393b64d2000ae19f7e`: bằng chứng archive/IPA local khớp claim (provenance, Distribution/`BLUA62D52G`, APNs production, no debug, production endpoints, SHA256, không commit binary/signing). Gap có chủ đích: chưa upload/ASC validate/device smoke — không đủ để tuyên bố store submit hoặc đóng publish gate #325.

Không merge / upload / submit trong session reviewer này.
