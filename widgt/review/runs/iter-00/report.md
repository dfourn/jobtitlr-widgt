# widgt review: 12.4 / 100

Generated 2026-10-13T15:53:45.066Z · iteration 00 · judge: none · 121 unit tests

## Gates

| Gate | Check | Result | Detail |
|---|---|---|---|
| G1 | TypeScript | pass | npm run typecheck passed |
| G2 | ESLint | pass | npm run lint passed |
| G3 | Build | pass | npm run build passed |
| G4 | Contract lock | pass | 71 locked files unchanged |
| G5 | Forbidden patterns | pass | none in src, review/contract |
| G6 | Test count | pass | 121 tests (no previous run) |

## Signals

| Signal | Value | Weight | Effective weight | Points | Detail |
|---|---:|---:|---:|---:|---|
| Contract tests | 0.0 | 25 | 29.4 | 0.0 | 0/58 contract tests passed |
| Unit tests + AC coverage | 70.0 | 15 | 17.6 | 12.4 | 121/121 unit tests passed; AC coverage 40% (8/20) |
| Accessibility (axe) | 0.0 | 20 | 23.5 | 0.0 | 0: the widget is not rendered (AC-1.1/AC-1.2 contract tests failing) |
| Responsiveness | 0.0 | 15 | 17.6 | 0.0 | 0: the widget is not rendered (AC-1.1/AC-1.2 contract tests failing) |
| Visual similarity | 0.0 | 10 | 11.8 | 0.0 | 0: the widget is not rendered (AC-1.1/AC-1.2 contract tests failing) |
| AI judge | off | 15 | 0.0 | 0.0 | judge off; its weight is spread over the other signals |
| **Total** |  | 100 | 100.0 | **12.4** |  |

## Top failures

| # | AC | Source | Test | File | Message |
|---:|---|---|---|---|---|
| 1 | AC-1.1 | contract | AC-1 renders the design › AC-1.1 shows the label, the score text, the heading and the feefo logo | review/contract/rendering.spec.ts:28 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 2 | AC-1.2 | contract | AC-1 renders the design › AC-1.2 the breakdown has exactly 5 rows, ordered 5 down to 1, with the reference counts | review/contract/rendering.spec.ts:37 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 3 | AC-1.3 | contract | AC-1 renders the design › AC-1.3 the 5-star bar fill is that rating's share of the total | review/contract/rendering.spec.ts:52 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 4 | AC-1.3 | contract | AC-1 renders the design › AC-1.3 the 4-star bar fill is that rating's share of the total | review/contract/rendering.spec.ts:52 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 5 | AC-1.3 | contract | AC-1 renders the design › AC-1.3 the 3-star bar fill is that rating's share of the total | review/contract/rendering.spec.ts:52 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 6 | AC-1.3 | contract | AC-1 renders the design › AC-1.3 the 2-star bar fill is that rating's share of the total | review/contract/rendering.spec.ts:52 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 7 | AC-1.3 | contract | AC-1 renders the design › AC-1.3 the 1-star bar fill is that rating's share of the total | review/contract/rendering.spec.ts:52 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 8 | AC-1.4 | contract | AC-1 renders the design › AC-1.4 the stars are filled [1, 1, 1, 1, 0.6] and the fifth star is 60% filled | review/contract/rendering.spec.ts:67 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 9 | AC-1.5 | contract | AC-1 renders the design › AC-1.5 the counts are shown in en-GB number format, in order 5 to 1 | review/contract/rendering.spec.ts:81 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |
| 10 | AC-2.2 | contract | AC-2.2 empty state › AC-2.2 with zero reviews the widget says "No reviews yet" | review/contract/empty.spec.ts:12 | Error: expect(locator).toBeVisible() failed Locator: getByTestId('product-rating') Expected: visible |

48 more in report.json.
