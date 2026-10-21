# D13 — TestFlight beta metadata (ASC API read-back)

| Trường | Giá trị |
| ------ | ------- |
| Ngày (UTC) | **2026-10-21** |
| Epic | [#301](https://github.com/hangndat/ticket-solution/issues/301) |
| Nguồn copy | `origin/hangndat/docs-tf-beta-info` · PR [#670](https://github.com/hangndat/ticket-solution/pull/670) (chưa merge) |
| App ASC | `6823694490` · Vemoki · `com.hangndat.ticket` |
| Build | **26** · id `0e1fb73f-367c-49b7-bd26-0536bc7f3399` |
| API key id (public) | `KHT3SAL2FS` |
| Worktree tip SHA | `git rev-parse HEAD` trên branch PR này |

## Phạm vi đã làm (beta only)

1. **betaAppLocalizations** `en-US` — `description`, `feedbackEmail`, `privacyPolicyUrl`, `marketingUrl` từ [testflight-test-information.md](../asc/testflight-test-information.md) (branch docs PR #670).
2. **betaBuildLocalizations** `en-US` — `whatsNew` (“What to Test”) cho build 26.
3. **betaAppReviewDetails** — contact name/email, `demoAccountRequired=true`, `demoAccountName=review-attendee@vemoki.com`, `demoAccountPassword` từ VPS `/opt/vemoki/secrets/app-review/asc-sign-in-required.txt` (không commit/log), `notes` = EN block từ [app-review-notes.md](../asc/app-review-notes.md) (branch #670).

**Không làm:** `betaAppReviewSubmission`, gắn build vào external beta group, submit Beta App Review.

## Read-back (che secret)

| Resource | Field | Live |
| -------- | ----- | ---- |
| betaAppLocalizations en-US | feedbackEmail | `hangndat@gmail.com` |
| | privacyPolicyUrl | `https://vemoki.com/privacy` |
| | marketingUrl | `https://vemoki.com` |
| | description | len **371** (preview: “Vemoki is an iOS app for event attendees…”) |
| betaBuildLocalizations en-US | whatsNew | len **1011** (preview: “Please focus on: 1) Sign-in…”) |
| betaAppReviewDetails | contactFirstName / LastName | Hang / Nguyen Dat |
| | contactEmail | `hangndat@gmail.com` |
| | contactPhone | **PLACEHOLDER** `+84900000000` — ASC API **từ chối** PATCH khi thiếu `contactPhone`; không có số thật trong repo. **Operator: thay số thật trên ASC UI trước submit.** |
| | demoAccountRequired | `true` |
| | demoAccountName | `review-attendee@vemoki.com` |
| | demoAccountPassword | `[REDACTED]` (đã set; mask read-back `OT********************CF`) |
| | notes | len **2992** (preview: “Thank you for reviewing Vemoki…”) |

Machine-readable (masked): [D13-TF-BETA-READINESS-2026-10-21.json](./D13-TF-BETA-READINESS-2026-10-21.json)

## Operator gaps

- **contactPhone:** thay placeholder bằng số liên hệ thật trên App Store Connect → TestFlight → App Information / Beta App Review (API không chấp nhận để trống).
- **vi locale:** file docs có VI “What to Test” nội bộ; ASC chỉ patch **en-US** (không có `betaAppLocalizations` vi trên app).
- Submit external beta / Beta App Review — **chờ user duyệt** (giữ gate PR #670).

## Claim boundary

- **Claim:** beta Test Information + build “What to Test” + Beta App Review detail fields (trừ phone thật) đã sync ASC qua API trên build 26.
- **Không claim:** external testers live · Beta App Review submitted · App Store release.
