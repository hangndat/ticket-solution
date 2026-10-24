# D9-S2 media seed evidence

- Issues: #140 (checklist), #141 (seed), Story #139, Epic #134
- Finished: 2026-10-24T08:40:41.286Z
- Endpoint: `http://127.0.0.1:9002`
- Bucket: `vemoki-assets`
- Objects: 11
- Verdict: **PASS**
- Mode: put+smoke

## Object keys

| Role | Key | Bytes | Smoke |
| --- | --- | ---: | --- |
| mfest-demo/mfest/logo | `tenants/11111111-1111-4111-8111-111111111111/events/11111111-1111-4111-8111-111111111101/assets/ready/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001.png` | 11186 | PASS |
| mfest-demo/mfest/banner | `tenants/11111111-1111-4111-8111-111111111111/events/11111111-1111-4111-8111-111111111101/assets/ready/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002.png` | 37546 | PASS |
| demo-studio/studio-night/logo | `tenants/22222222-2222-4222-8222-222222222222/events/22222222-2222-4222-8222-222222222201/assets/ready/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001.png` | 11186 | PASS |
| demo-studio/studio-night/banner | `tenants/22222222-2222-4222-8222-222222222222/events/22222222-2222-4222-8222-222222222201/assets/ready/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002.png` | 37546 | PASS |
| platform/lockup.png | `demo/brand/vemoki/lockup.png` | 11186 | PASS |
| platform/og.png | `demo/brand/vemoki/og.png` | 37546 | PASS |
| platform/email-header.png | `demo/brand/vemoki/email-header.png` | 7063 | PASS |
| platform/app-icon.png | `demo/brand/vemoki/app-icon.png` | 23994 | PASS |
| platform/mark.svg | `demo/brand/vemoki/mark.svg` | 336 | PASS |
| platform/mark-mono.svg | `demo/brand/vemoki/mark-mono.svg` | 292 | PASS |
| platform/tokens.json | `demo/brand/vemoki/tokens.json` | 1573 | PASS |

## Commands

```bash
./scripts/d9-seed-media.sh
./scripts/d9-seed-media.sh --smoke-only
```

## Limitations

- Seed ghi thẳng object **ready** (ops path); không gọi API quarantine/finalize.
- UUID demo trong `brand/demo/manifest.json` cần S1 DB seed gắn cùng id để publish brand.
- Bucket private: smoke = SigV4 GET, không anonymous URL công khai.
