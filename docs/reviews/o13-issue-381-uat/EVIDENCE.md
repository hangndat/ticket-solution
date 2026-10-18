# O13 Issue #381 — headless UAT evidence

- Issue: https://github.com/hangndat/ticket-solution/issues/381
- Command: `scripts/web-uat.sh o13-sales http://127.0.0.1:3810`
- Base URL: `http://127.0.0.1:3810`
- Host header: `(none — /marketing paths)`
- Tip SHA (branch): `7e6d16137903864d9cf2404a4c0447424f9d2fc9`
- Feature/UAT content SHA: `5cbfde0386d033001036091aaf4af21cddabff06` (screenshots taken against this tree; subsequent commits only stamp this evidence)
- Captured: 2026-10-18 (local Next.js; host-aware apex rewrite also smoke-tested `Host: vemoki.com` → 200)

## AC spot-check (VI `/marketing`)

| AC | Result |
| -- | ------ |
| AC-1 brand + headline + support + CTA demo + quan tâm | PASS (screenshot `o13-sales-vi.png`) |
| AC-2 demo nhãn giả lập | PASS (`Demo giả lập` near hero CTA) |
| AC-4 EN strings | PASS (`o13-sales-en.png`) |
| AC-5 privacy/support 200 | PASS (`o13-privacy.png`, `o13-support.png`) |
| AC-6 no pricing/Wallet/Android/seat | PASS (unit `marketing-copy.test.ts`) |
| AC-7 brand-first first viewport | PASS (wordmark hero-level) |

| Shot | Path | File |
| ---- | ---- | ---- |
| sales-vi | `/marketing` | `o13-sales-vi.png` |
| sales-en | `/marketing/en` | `o13-sales-en.png` |
| privacy | `/marketing/privacy` | `o13-privacy.png` |
| support | `/marketing/support` | `o13-support.png` |
