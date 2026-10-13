# Testing and verification report

Final verification of the submission against the brief, run on 13 October 2026 in a fresh clone of the repository (commit `1073b10`, branch `chore/final-verification`) by an agent that had seen none of the development work. Every number and quoted line in sections 2 and 3 was produced by the commands below in that clone; nothing was copied from the project's own documentation.

Environment: macOS 26.3, Temurin OpenJDK 21 (build 21+35-LTS, the default `java` on `PATH`), Node v22.23.1, npm 10.9.8.

## 1. Traceability: brief item to acceptance criterion to test

The brief's items are `B1.x` (part 1) and `B2.x` (part 2) in [`docs/brief/README.md`](brief/README.md). Acceptance criteria are prefixed with their spec: `01/` from [`docs/specs/01-jobtitlr.md`](specs/01-jobtitlr.md), `02/` from [`docs/specs/02-widgt.md`](specs/02-widgt.md) and `03/` from [`docs/specs/03-review-loop.md`](specs/03-review-loop.md), because specs 01 and 02 reuse the same AC numbers. Every test below names its AC ID in its title: JUnit `@DisplayName` strings, Playwright test titles and vitest test titles all start with the ID they verify.

### Part 1: jobtitlr

JUnit 5 tests in `jobtitlr/src/test/java/dev/jobtitlr/`.

| Brief item | Acceptance criteria | Verifying tests |
|---|---|---|
| B1.1 A class that returns the best match for an input string from a list of normalised titles | 01/AC-5.1 (highest q wins), 01/AC-5.2 (first-listed wins a tie), 01/AC-5.3 (deterministic), 01/AC-4.5 (`bestMatch` exposes q) | `NormaliserSelectionTest` ("AC-5.1 the title with the highest q wins", "AC-5.2 on equal q the title listed first wins", "AC-5.3 the same input and configuration always give the same result", "AC-4.5 bestMatch exposes q through MatchResult.quality()") |
| B1.2 Default list: Architect, Software engineer, Quantity surveyor, Accountant | 01/AC-1.1 to 01/AC-1.4 (given the default titles), 01/AC-8.5 (documented default minimumQuality 0.2) | `NormaliserBriefTest` ("AC-1.1 to AC-1.4 the brief's examples normalise to the expected titles"), `NormaliserConfigurationTest` ("AC-8.5 the documented default minimumQuality is 0.2") |
| B1.3 The four example mappings | 01/AC-1.1, 01/AC-1.2, 01/AC-1.3, 01/AC-1.4 | `NormaliserBriefTest`, plus `WorkedExamplesTest` ("AC-4.5 spec 01 section 4 worked examples") and `DemoTest` ("AC-1.5 Demo prints the brief's four examples") |
| B1.4 Internal quality score q, 0.0 <= q <= 1.0 | 01/AC-4.1 (bounded, 1000 seeded random pairs), 01/AC-4.2 (identical scores 1.0), 01/AC-4.3 (disjoint scores 0.0), 01/AC-4.4 (symmetric, bit-identical), 01/AC-4.6 (one-to-one token pairing) | `TokenDiceScorerTest` (all five groups above), `NormaliserSelectionTest` (AC-4.5) |
| B1.5 Sample code `new Normaliser().normalise(jt)` runs unchanged | 01/AC-1.5 | `NormaliserBriefTest` ("AC-1.5 the brief's sample code compiles and runs unchanged"), `DemoTest` ("AC-1.5 Demo prints the brief's four examples using the sample code unchanged") |
| B1.6 Runnable, testable project importable into an IDE, with testing evidence | 01/NFR-3 (`./mvnw` commands, no global Maven), 01/NFR-4 (every AC covered by a test citing its ID) | This run: `./mvnw verify` exit 0 with 110/110 tests (section 2), `./mvnw -q compile exec:java` exit 0 printing the four examples. IDE import steps in `jobtitlr/README.md` section 2. This document is the testing evidence. |
| B1.7 Good structure, OOP principles, defensive coding, unit testing | 01/AC-7.1 to 01/AC-7.3 (invalid input), 01/AC-8.1 to 01/AC-8.7 (configuration validation, defensive copies, scorer guard), 01/AC-9.1 (custom scorer injected), 01/AC-9.2 (`MatchResult` validation), 01/NFR-1 (no runtime dependencies), 01/NFR-2 (immutable, thread-safe) | `NormaliserInputTest` (AC-7.1 to AC-7.3), `NormaliserConfigurationTest` (AC-8.1 to AC-8.7, 20 tests), `NormaliserSelectionTest` ("AC-9.1 a custom scorer is used without changing Normaliser"), `MatchResultTest` (AC-9.2, 10 tests) |

Supporting algorithm tests: `TokeniserTest` (01/AC-2.1 to 01/AC-2.4, 01/AC-7.3) and `LevenshteinTest` (01/AC-3.5) cover the tokenisation and edit-distance layers that 01/AC-3.1 to 01/AC-3.4 (typo and plural tolerance, tested in `NormaliserInputTest` and `TokenDiceScorerTest`) rest on.

### Part 2: widgt

Unit and component tests (vitest, Testing Library) in `widgt/src/`; contract tests (Playwright) in `widgt/review/contract/`.

| Brief item | Acceptance criteria | Verifying tests |
|---|---|---|
| B2.1 Implement the design: label, 4.6-star row, score text, heading with logo, five breakdown bars | 02/AC-1.1 to 02/AC-1.5 | Playwright `review/contract/rendering.spec.ts` ("AC-1.1 shows the label, the score text, the heading and the feefo logo" ... "AC-1.5 the counts are shown in en-GB number format"); vitest `src/components/ProductRating/ProductRating.test.tsx`, `RatingBreakdown.test.tsx`, `StarRow.test.tsx`, `src/domain/rating.test.ts` |
| B2.2 The design reproduced accurately | 02/AC-6.1 (Poppins, self-hosted), 02/AC-6.2 (colours from the measured reference tokens), 02/AC-6.3 (screenshot compared with the reference card; a soft signal, not a gate) | Playwright `review/contract/visual.spec.ts` ("AC-6.1 the font is Poppins, loaded and served from the app itself", "AC-6.2 bar colours come from the reference tokens", "AC-6.3 captures the widget in its 360px wrapper for the similarity score") |
| B2.3 Layout grows and shrinks sensibly with the viewport | 02/AC-5.1 (fills 260-420px containers), 02/AC-5.2 (no overflow or clipping at 320/768/1280), 02/AC-5.3 (container queries; counts stay visible), 02/AC-5.4 (relative units, 200% zoom) | Playwright `review/contract/responsive.spec.ts` (all four groups; 16 executed tests, reported as the review's responsive signal) |
| B2.4 Sensible component boundaries and separation of responsibilities | 02/AC-7.3 (domain logic isolated in `src/domain/`; ESLint keeps React, `import.meta` and dynamic `import()` out of it), 02/AC-7.4 (one folder per component with its CSS Module and tests), 03/judge signal (component boundaries in the rubric) | vitest `src/domain/boundaries.test.ts` ("AC-7.3 rejects a React import in a .tsx file in src/domain", "AC-7.3 rejects import.meta in src/domain", "AC-7.3 allows a React import outside src/domain"), `src/domain/index.test.ts`; folder layout per `widgt/README.md` component tree |
| B2.5 TypeScript for props and data structures | 02/AC-2.1 (domain functions behave as specified, including rounding edges), 02/AC-7.1 (strict mode, no `any`, no `!` in `src/`) | vitest `src/domain/rating.test.ts`, `rating.property.test.ts` (fast-check invariants), `types.test.ts`; 02/AC-7.1 enforced by gates G1/G2 in `npm run verify` (this run: pass) |
| B2.6 Clean, readable, maintainable code | 02/AC-7.1, 02/AC-7.2 (ESLint, zero warnings), 02/AC-7.3 | Gate G2 (`eslint . --max-warnings 0`, pass this run); vitest boundary tests above |
| B2.7 Semantic HTML and accessibility throughout | 02/AC-3.1 (`<section>` named by its heading), 02/AC-3.4 (uppercase via CSS only), 02/AC-3.6 (axe: 0 WCAG 2.2 AA violations in default, static and selected states) | Playwright `review/contract/accessibility.spec.ts` ("AC-3.1 the widget is a <section> named \"Product rating\"", "AC-3.4 ... sentence case in the DOM and uppercase through CSS", three AC-3.6 axe tests); vitest `ProductRating.test.tsx`, `RatingBreakdown.test.tsx` |
| B2.8 ARIA attributes where they add value | 02/AC-3.2 (star graphic `aria-hidden`, text alternative exposed), 02/AC-3.3 (list semantics; row accessible names "N stars: C reviews (P%)"), 02/AC-3.5 (logo `alt="feefo"`, decorative stars hidden), 02/AC-4.2 (`aria-pressed` toggles) | Playwright `accessibility.spec.ts` (AC-3.2, AC-3.3, AC-3.5), `interactions.spec.ts` ("AC-4.2 with onRatingSelect each row is a <button aria-pressed=..."); vitest `StarRow.test.tsx`, `BreakdownRow/rowName.test.ts` |
| B2.9 Automated tests covering component behaviour and user interactions | 02/AC-4.1 (static mode: no buttons, no tab stops) to 02/AC-4.7 (selection not by colour alone), plus the whole suite | Playwright `review/contract/interactions.spec.ts` (10 tests: click, toggle off, move selection, Tab order 5 to 1, Enter, Space, focus contrast AC-3.7, colour-independence AC-4.7); vitest `ProductRating.interactions.test.tsx` ("AC-4.5 Tab reaches the rows 5 to 1, and Enter and Space toggle them") |
| B2.10 React and TypeScript | Stack requirement; enforced by the build | `npm run verify` gates G1 (`tsc -b --noEmit`) and G3 (`vite build`), both pass this run; 39 vitest files compile under strict TypeScript |
| B2.11 Font: Google Font Poppins, sizes need not be pixel-perfect | 02/AC-6.1 | Playwright `visual.spec.ts` AC-6.1 (self-hosted, no third-party font request); pixel leniency is the brief's own note, mirrored by 03 (visual similarity weighted 10%, never a gate) |
| B2.12 Free choice of styling; the reasoning matters | 02/AC-6.2 (tokens match the measured reference), design decision recorded | ADR 0001 (`docs/decisions/0001-widgt-styling.md`, CSS Modules and container queries); token values checked by `visual.spec.ts` AC-6.2 |
| B2.13 Vitest or Jest with Testing Library, or equivalent | 02/AC-8.1 | This run: `npm test` inside `npm run verify` — 472 tests in 39 files, all passing (section 2) |
| B2.14 Extra libraries allowed, but be ready to explain why | Dependency set is minimal and each is justified | `widgt/package.json` (React, Vite, Vitest, Testing Library, Playwright, axe-core, pixelmatch, fontsource Poppins); reasoning in `widgt/README.md` and ADR 0001 |
| B2.15 Must run locally by following the README | 02/AC-8.1 (`npm ci`, `dev`, `test`, `test:e2e`, `verify` all work) | This run: every README command exit 0, and the dev server answered HTTP 200 (section 2) |
| B2.16 Share it in the GitHub repository | Delivery step, outside the code | Repository at commit `1073b10` on `chore/final-verification`; publication is Dan's action (master plan H6), not verifiable in the clone |
| B2.17 The approach is marked, not pixel-matching | 03 in full: the harness scores the brief's own signals, with pixels at weight 10/100 and never a gate | The loop harness's own tests (table below) and the recorded run: total 95.8/100 with the visual signal at 64.2 while every gate and every contract test passes |

### The review loop harness (spec 03)

The harness that produced the widgt evidence is itself tested (vitest in `widgt/review/src/`). Its acceptance criteria carry the `AC-L` IDs.

| Criterion | Verifying tests |
|---|---|
| 03/AC-L1 `npm run review` runs offline, no AI, writes report and screenshots | `run-review.test.ts`, `report.test.ts`, `signals/*.test.ts`, `config.test.ts` |
| 03/AC-L2 score() is a pure, unit-tested function incl. gates and judge redistribution | `score.test.ts`, `signals/unit.test.ts` |
| 03/AC-L3 changing any locked file fails G4 | `gates.test.ts`, `run-review.test.ts` |
| 03/AC-L4 `.skip` in `src/` or `review/contract/` fails G5 | `gates.test.ts` |
| 03/AC-L5 loop stops on each stop condition | `loop/stop.test.ts`, `loop/runner.test.ts` (fake generator and fake review) |
| 03/AC-L6 each iteration commits and rows the scoreboard | `loop/runner.test.ts`, `html.test.ts`, `report.test.ts` |
| 03/AC-L7 generator adapters swap through `--generator`; `external` suffices | `loop/generators.test.ts`, `loop/prompt.test.ts`, `io/claude-cli.test.ts` |
| 03/AC-L8 a11y/responsive/visual score 0 unless the reference content rendered | `signals/presence.test.ts`, `run-review.test.ts` |
| 03/AC-L9 a11y is the mean over the three axe states; a missing state scores 0 | `signals/axe.test.ts`, `run-review.test.ts` |
| 03/AC-L10 visual signal: foreground pixels only, scored 0 unless AC-6.3 passed | `signals/visual.test.ts`, `score.test.ts`, `loop/prompt.test.ts` |
| 03/AC-L11 unit AC coverage counts only AC IDs cited by passing tests | `signals/coverage.test.ts` |
| 03/AC-L12 workspace guard refuses tool-config files, reinstalls dependencies | `guard.test.ts`, `loop/generators.test.ts`, `loop/runner.test.ts` |
| 03/AC-L13 `claude`/`glm` generators run with a write allow list | `loop/generators.test.ts` |

## 2. Results generated in this run

Commands were run one at a time, in a fresh clone, judging by exit code only.

| Part | Command | Exit code | Result |
|---|---|---|---|
| 1 | `./mvnw verify` (in `jobtitlr/`) | 0 | 110 tests, 0 failures, 0 errors, 0 skipped; jar built |
| 1 | `./mvnw -q compile exec:java` (in `jobtitlr/`) | 0 | prints the brief's four example mappings |
| 2 | `npm ci` (in `widgt/`) | 0 | 0 vulnerabilities |
| 2 | `npx playwright install chromium` (in `widgt/`) | 0 | Chromium ready |
| 2 | `npm run verify` (in `widgt/`) | 0 | typecheck, lint, 472 vitest tests, then the strict review: total 95.8/100, all six gates pass, 0 failures |
| 2 | `npm run test:e2e` (in `widgt/`) | 0 | 58 Playwright contract tests passed |
| 2 | `npm run dev` in the background, then `curl` the root | 200 | `http://localhost:5173/` answered 200 within the 30-second budget; server stopped afterwards |

### Part 1: JUnit

Totals from `./mvnw verify`:

```text
[INFO] Tests run: 110, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

Genuine lines from the per-class output:

```text
[INFO] Running dev.jobtitlr.NormaliserConfigurationTest
[INFO] Tests run: 20, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.011 s -- in dev.jobtitlr.NormaliserConfigurationTest
[INFO] Running dev.jobtitlr.TokenDiceScorerTest
[INFO] Tests run: 21, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.088 s -- in dev.jobtitlr.TokenDiceScorerTest
```

The demo (`./mvnw -q compile exec:java`, exit 0):

```text
Java engineer -> Software engineer
C# engineer -> Software engineer
Accountant -> Accountant
Chief Accountant -> Accountant
```

### Part 2: vitest, Playwright and the review

`npm run verify` runs typecheck and lint (both silent on success), then the unit and component suite:

```text
 Test Files  39 passed (39)
      Tests  472 passed (472)
   Duration  2.99s
```

Of the 472, 172 live in `src/` (the widget: domain logic and components) and 300 in `review/src/` (the loop harness); the review's own accounting agrees: "172/172 unit tests passed; AC coverage 100% (20/20)".

The strict review at the end of `npm run verify` (exit 0, `--strict`, so any gate failure would have failed the command):

```text
widgt review (judge: none)
  gates      G1 pass  G2 pass  G3 pass  G4 pass  G5 pass  G6 pass
  contract     100.0  58/58 contract tests passed
  unit         100.0  172/172 unit tests passed; AC coverage 100% (20/20)
  a11y         100.0  axe, mean of default, static, selected: default 100; static 100; selected 100
  responsive   100.0  16/16 AC-5 contract tests passed
  visual        64.2  foreground similarity 61.4% (13193 of 34169 foreground pixels differ)
  judge          off  judge off; its weight is spread over the other signals
  total      95.8 / 100
  failures   0
```

The visual signal is deliberately soft (weight 10/100, never a gate), per the brief's "not simply whether every pixel matches" (B2.17).

`npm run test:e2e` (exit 0):

```text
58 passed (6.3s)
```

Genuine lines from its output:

```text
✓   4 [chromium] › review/contract/accessibility.spec.ts:45:3 › AC-3 accessibility › AC-3.1 the widget is a <section> named "Product rating" (415ms)
✓   6 [chromium] › review/contract/accessibility.spec.ts:66:3 › AC-3 accessibility › AC-3.2 a text alternative "4.6 out of 5" is exposed (404ms)
✓  24 [chromium] › review/contract/interactions.spec.ts:102:3 › AC-4 interactions › AC-4.5 Tab reaches the rows in order 5 to 1 (137ms)
✓  51 [chromium] › review/contract/responsive.spec.ts:110:3 › at a 320px viewport › AC-5.3 at narrow widths the counts stay visible (183ms)
✓  54 [chromium] › review/contract/visual.spec.ts:317:3 › AC-6 visual fidelity › AC-6.2 bar colours come from the reference tokens (98ms)
```

## 3. How to reproduce

Run in order, one command at a time, from a fresh clone. JDK 21 or newer and Node 22 or newer must be on the `PATH` (if the default JDK is not 21, prefix the Maven commands with `JAVA_HOME="$HOME/.sdkman/candidates/java/current"`).

```sh
git clone <repository> clone && cd clone

# Part 1 (jobtitlr)
cd jobtitlr
./mvnw verify                    # exit 0, "Tests run: 110, Failures: 0, Errors: 0, Skipped: 0"
./mvnw -q compile exec:java      # exit 0, prints the four example mappings
cd ..

# Part 2 (widgt)
cd widgt
npm ci                           # exit 0
npx playwright install chromium  # exit 0
npm run verify                   # exit 0, 472 vitest tests, review total 95.8/100
npm run test:e2e                 # exit 0, 58 passed
npm run dev &                    # background
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/   # 200
kill $(lsof -ti tcp:5173)        # stop the dev server
```

Do not run two Playwright-based commands concurrently (`npm run verify` and `npm run test:e2e` each drive Chromium against a dev server). `npm run review:lock`, `npm run loop` and `npm run test:watch` were not run: the first rewrites the locked contract, the second spends AI budget, and the third never exits.
