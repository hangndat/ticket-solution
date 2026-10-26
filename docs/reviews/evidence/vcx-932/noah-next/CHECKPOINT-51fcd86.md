# Checkpoint — integration `51fcd86f` (Noah)

**integrationSha:** `51fcd86f7acf95b3a7362a0bc6310707c1aee0a6`
**priorTestedSha:** `6b2a5ffa5c5fe6bec321d7d64079147ef788994b`
**portalBuildId:** `_8PxUE1nhvhw-KLm-X__p`

## Stack (restarted, không đụng :3015 / #928)

| Dịch vụ | Endpoint | PID file |
| --- | --- | --- |
| API | `127.0.0.1:3542` | `.local-dev/.uat-artifacts/vcx932-noah/api.pid` |
| Portal | `http://uat932.localhost:3016` | `.local-dev/.uat-artifacts/vcx932-noah/portal.pid` |

Cookie isolate: `uat932.localhost` + `ticket-admin-web-vcx932-uat932`.

## Re-probe hẹp (artifact: `integration-51fcd86-probe.json`)

| Check | Kết quả |
| --- | --- |
| first-save UI | PASS |
| CAS 409 `REVISION_CONFLICT` | PASS |
| reload | PASS |
| preview đúng version | PASS |
| unsaved cancel/confirm (Orca) | **FAIL harness** — `window.confirm` không gọi; ProForm `onValuesChange` không kích hoạt qua eval/fill Orca |

**Matrix viewport VI:** reuse ảnh `matrix-config-*-vi.png` @ `6b2a5ff` — merge chỉ CAS/capability/unsaved guard, không đổi layout shell.

## Unsaved guard — phân loại

- **Product:** coordinator báo 204 tests PASS trên integrationSha; có `setup-drafts.test.ts` / `context-switch.test.ts` cho `unsaved-changes`.
- **Runtime Orca:** chưa tái hiện dirty + link «Sự kiện»; không claim bug sản phẩm; owner follow-up: Orca `fill` field `#organizationName` hoặc review UI.

## Gate ngoài scope

Thiết bị thật / inbox mail thật: **chưa đạt** — không chờ trong phiên này.

## Dừng

Không spawn Run/worker; tab Orca đã đóng; server review giữ.
