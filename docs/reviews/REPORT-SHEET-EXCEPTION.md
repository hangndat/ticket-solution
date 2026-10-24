# MR-SHEET-EXCEPTION — Issue #859 / run_2c9e147d89e6

**ANCHOR SHA:** `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (dirty working tree — no commit)\
**Worker:** task_e7da3a9ba010 · Persona Liv · **not acceptance PASS** (exception fix only)

## Diagnosis (MR-R04 / MOCKUP-REFRESH)

| Finding | Root cause | Fix |
| --- | --- | --- |
| `sheet-nav-radix.mjs` JSX | Browser parse fail; `node --check` fail | `React.createElement` only |
| `?external=react,react-dom` without import map | Module load fail; `VemokiSheetNav` missing | `?deps=react@18.3.1,react-dom@18.3.1` on Radix URL + shared `react` imports |
| Duplicate React copies | `setOpen` no-op; dialog never opens | esm.sh `deps=` pins singleton |
| Loader `isOpen` / async `bindRadixSheet` | API mismatch vs callers | Sync `isOpen()` boolean; sync `bindRadixSheet` + `pendingOpen` bridge |
| Trigger lost on re-render (app) | Click listener on replaced node | Document capture delegation by `triggerId` |
| MR-R10 manifest self-hash | `indexArtifacts` included `source-manifest.json` | Removed self entry; hashes updated in manifest body only |

## Source fingerprints (SHA256)

| Path | Before (MOCKUP-REFRESH) | After |
| --- | --- | --- |
| `sheet-nav-radix.mjs` | `3793b448…e53c` | `7c69738b…41e6` |
| `sheet-nav-loader.mjs` | `57a7ef14…c30f` | `b7645e10…e32d` |
| `marketing/index.html` | `cc9444ba…f9f0` | `d2cea9a7…e476` |
| `marketing/js/marketing.js` | `44e75fbf…fcc4` | `37dfa86c…f39e` |
| `app/index.html` | `627f4df5…0821` | `5ab88476…b076` |

## Checks

```bash
node --check docs/design/ui-framework-2026-10/prototype/sheet-nav-radix.mjs
node --check docs/design/ui-framework-2026-10/prototype/sheet-nav-loader.mjs
bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/MR-SHEET-EXCEPTION-2026-10-23
# → OK: 47 file
bash docs/reviews/assets/MR-SHEET-EXCEPTION-2026-10-23/capture-sheet-exception.sh
```

## Orca probes (live @390, server :57277)

| Capture | `typeofVemokiSheetNav` | Dialog open | Title | Tab focus in dialog | Esc → trigger |
| --- | --- | --- | --- | --- | --- |
| marketing VI | object | yes | Menu | yes (`A`) | `focusOnTrigger: true` |
| marketing EN | object | yes | Menu | yes | yes |
| app VI | object | yes | Menu | yes | yes |
| app EN | object | yes | Menu | yes | yes |
| desktop 1024 EN | object | n/a (sheet closed) | — | — | — |

Evidence: `docs/reviews/assets/MR-SHEET-EXCEPTION-2026-10-23/` (PNG + sidecar JSON with `innerWidth` / `dpr` / locale).

## Out of scope / left

- Independent MR-REVIEW verdict on full mockup refresh wave\
- Commit / PR / merge (coordinator policy)
