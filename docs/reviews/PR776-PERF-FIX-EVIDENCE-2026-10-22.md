# PR #776 — perf fix (F01–F04)

| | JS transfer (Lighthouse Scripts) | Total chunk JS (`measure-web-chunk-bytes`) |
| --- | ---: | ---: |
| Parent `82d8504f` (no bento) | 164_093 | 1_192_375 |
| Prior tip `5608379c` (Motion island) | 234_357 | 1_383_704 |
| **This fix** (CSS view reveal) | **164_849** (+756 B vs parent) | **1_198_915** (+6_540 B) |

Lighthouse mobile 390×844 local (`next start`, `x-forwarded-host: vemoki.com`):

| Locale | Perf | LCP | CLS | TBT | JS transfer |
| --- | ---: | --- | --- | --- | ---: |
| VI | 0.87 | 4.1 s | 0 | 10 ms | 164_849 |
| EN | 0.85 | 4.3 s | 0 | 10 ms | 164_849 |

Screenshots: `docs/reviews/assets/PR776-marketing-screenshots/` (1280 + 390, VI/EN, reduced-motion).
