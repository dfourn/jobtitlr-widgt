# Review loop scoreboard

Written by `npm run loop`. One row per iteration; iteration 00 is the baseline before any generated change. The total is 0 whenever a gate fails. Signals are 0-100; – means missing or off.

| Iter | Total | Δ | Gates | Contract | Unit | A11y | Responsive | Visual | Judge | Commit | Change |
|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|---|
| 00 | 12.4 | – | pass | 0 | 70 | 0 | 0 | 0 | – | e82625b | baseline |
| 01 | 95.8 | +83.4 | pass | 100 | 100 | 100 | 100 | 64 | – | this commit | Build the ProductRating widget and demo page: component tree (ProductRating, RatingLabel, StarRow, Star, StarIcon, ScoreText, BrandLine, RatingBreakdown, BreakdownRow), CSS-module tokens, URL-driven demo scenarios, and full unit-test coverage for the uncovered AC IDs. |
