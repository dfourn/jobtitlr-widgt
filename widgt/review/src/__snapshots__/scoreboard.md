# Review loop scoreboard

Written by `npm run loop`. One row per iteration; iteration 00 is the baseline before any generated change. The total is 0 whenever a gate fails. Signals are 0-100; – means missing or off.

| Iter | Total | Δ | Gates | Contract | Unit | A11y | Responsive | Visual | Judge | Commit | Change |
|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|---|
| 00 | 42.0 | – | pass | 40 | 50 | 100 | 25 | – | – | abc1234 | baseline |
| 01 | 0.0 | -42.0 | G1, G2 | 40 | 50 | 100 | 25 | – | – | def5678 | broke the types |
| 02 | 57.5 | +57.5 | pass | 40 | 50 | 100 | 25 | – | 67 | this commit | fixed \| rows |
