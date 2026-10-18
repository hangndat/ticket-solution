# Deploy prod — Visual Identity v2 Live Pulse (2026-10-19)

| Field | Value |
| ----- | ----- |
| Authorization | Plan implement «Visual Identity v2» + todo deploy |
| Tip SHA | `e6f5571462d2a8af205cbcec14e5a16164d50acd` (`main`) |
| Marker | `/opt/vemoki/deployed-sha.txt` |
| Host | SSH `dexter@…` (alias `conanphong` không resolve máy agent) |
| Services | `web` (rsync + build + restart) |
| EAS / mobile | **Không** (iOS merged; không store) |
| Migrate / keycloak / nginx | **Không** |

## Epic / PRs

- Epic #486
- PD #487 → PR #490
- Web #488 → PR #504 (DoD PASS feature SHA `15eb341e…`)
- iOS #489 → PR #507 (DoD PASS feature SHA `456f68cd…`)

## Verify

| Check | Result |
| ----- | ------ |
| `https://vemoki.com/` | **200** — tokens `--ink:#0B1220;--paper:#F4F6F8;--signal:#E11D48;--focus:#2563EB` + Sora |
| `https://app.vemoki.com/` | **200** — cùng Live Pulse tokens + Sora |
| `https://app.vemoki.com/auth` | **307** → `/` |
| `https://app.vemoki.com/redeem` | **200** |
| `https://app.vemoki.com/account` | **200** |
| `https://app.vemoki.com/api/bff/me` (anon) | **401** |
| `https://api.vemoki.com/v1/health` | **200** |
| `https://ancafe.anphong.vn/` | **200** (không đụng) |

## Verdict

**PASS** — tip `e6f55714…` live; palette/type Live Pulse visible trên marketing + attendee web.
