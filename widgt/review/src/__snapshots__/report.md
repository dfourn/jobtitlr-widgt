# widgt review: 0 / 100 (gates failed: G2; 63.4 without the cap)

Generated 2026-10-11T12:00:00.000Z · iteration 03 · judge: none · 40 unit tests

## Gates

| Gate | Check | Result | Detail |
|---|---|---|---|
| G1 | TypeScript | pass | npm run typecheck passed |
| G2 | ESLint | **FAIL** | npm run lint exited with 1 |
| G4 | Contract lock | pass | 12 locked files unchanged |

**G2 ESLint output (excerpt)**

```text
3:7  error  x | y is unused
```

## Signals

| Signal | Value | Weight | Effective weight | Points | Detail |
|---|---:|---:|---:|---:|---|
| Contract tests | 81.8 | 25 | 29.4 | 24.1 | 18/22 contract tests passed |
| Unit tests + AC coverage | 70.0 | 15 | 17.6 | 12.3 | 40/40 unit tests passed; AC coverage 40% (14/34) |
| Accessibility (axe) | 85.0 | 20 | 23.5 | 20.0 | axe: 0 critical, 1 serious, 0 moderate, 0 minor |
| Responsiveness | 50.0 | 15 | 17.6 | 8.8 | 2/4 AC-5 contract tests passed |
| Visual similarity | missing | 10 | 11.8 | 0.0 | screenshot not found: review/runs/latest/screenshots/visual-401.png |
| AI judge | off | 15 | 0.0 | 0.0 | judge off; weight redistributed |
| **Total** |  | 100 | 100.0 | **63.4** | gates failed: total capped at 0 |

**Missing signals** (scored 0): Visual similarity

## Top failures

| # | AC | Source | Test | File | Message |
|---:|---|---|---|---|---|
| 1 | AC-2.1 | unit | AC-2.1 rounds 4.65 \| 4.7 | src/domain/rating.test.ts | expected 4.6 to be 4.7 |
| 2 | AC-4.3 | contract | AC-4.3 test | review/contract/widget.spec.ts | expected true |
| 3 | AC-5.2 | contract | AC-5.2 test | review/contract/widget.spec.ts | expected true |

## Notes

- contract results: 1 test file failed to load
