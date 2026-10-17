# D11-B3 — Attendee iOS headless UAT (#235)

**Issue:** [#235](https://github.com/hangndat/ticket-solution/issues/235)  
**Ownership:** `apps/mobile` · **không** EAS Cloud Build · Team `BLUA62D52G`  
**Evidence tip SHA:** `b5c285fb61cce752d49dcf67d543e7370b24a652` (feature `0c0eb7cccc29a466566df8a4b2295d680ce3613f`)

## Commands

```bash
# Unit + static
cd apps/mobile && pnpm test && pnpm typecheck && pnpm lint

# Simulator (đã boot — không open -a Simulator)
UDID=F191CF59-4B73-44E5-BFA8-4CE439EB31AD
scripts/sim-uat.sh boot "$UDID"
# Expo Go / local: mở bundle sau Metro :8083
SIM_UAT_OUT_DIR=apps/mobile/.uat-artifacts/d11-b3 \
  scripts/sim-uat.sh screenshot "$UDID" \
  apps/mobile/.uat-artifacts/d11-b3/ios-tenant-demo-fun.png
scripts/sim-uat.sh tap --udid "$UDID" --label "Đổi tổ chức demo"
SIM_UAT_OUT_DIR=apps/mobile/.uat-artifacts/d11-b3 \
  scripts/sim-uat.sh screenshot "$UDID" \
  apps/mobile/.uat-artifacts/d11-b3/ios-tenant-demo-studio.png
scripts/sim-uat.sh tap --udid "$UDID" --label "Đổi mã"
SIM_UAT_OUT_DIR=apps/mobile/.uat-artifacts/d11-b3 \
  scripts/sim-uat.sh screenshot "$UDID" \
  apps/mobile/.uat-artifacts/d11-b3/ios-redeem.png
```

## Brand-test S-P0-C

| Surface | Expect |
| --- | --- |
| demo-fun | `Tổ chức: demo-fun` · Demo FUN Collective · primary `#245B47` |
| demo-studio (sau tap) | `Tổ chức: demo-studio` · Demo Studio Organization · `#59428A` |
| Redeem | Title «Đổi mã lấy vé»; không Nest/BFF trên chrome |

Artifacts (gitignored): `apps/mobile/.uat-artifacts/d11-b3/`

## Limits

- Simulator + Expo Go / local install ≠ device UAT
- Không claim pilot / store
- Ví signed-in / QR live cần OIDC — không bắt buộc cho brand-test demo catalog
