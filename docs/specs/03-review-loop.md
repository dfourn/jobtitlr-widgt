# Spec 03: self-reviewing UI loop

| | |
|---|---|
| Status | **Accepted** |
| Project | `widgt/review/` |
| Stack | Node 22, TypeScript, Playwright, @axe-core/playwright, pixelmatch |
| Research | `docs/research/self-reviewing-ui-loop.md` |

## 1. Goal

An AI agent builds and refines the widget (spec 02). An **independent, deterministic harness** scores each iteration against the brief's own criteria. Every iteration is committed together with its score, so the reviewer can see how the work progressed.

Principles:
1. **Separate the generator from the evaluator.** The AI never grades its own work. Anthropic's harness research found that agents grading themselves skew positive.
2. **The score uses the brief's vocabulary.** Each signal maps to B2.x and AC IDs.
3. **Pixels are a minor signal** (B2.17: "not simply whether every pixel matches").
4. **The AI is optional.** `npm run review` needs no AI and no API key.
5. **It is honest.** The AI cannot edit the checks or the thresholds, and the history is never rewritten.

## 2. Commands

| Command | What it does | Needs AI? |
|---|---|---|
| `npm run review` | Runs every check once and writes `review/runs/latest/` (report.json, report.md, axe results, screenshots, diff; see §4). | No |
| `npm run loop -- --generator <g> --max-iter 8` | Loops through: generate, review, commit, stop check. | Yes |

Generators (adapters behind one interface):
- `claude`: `claude -p` (Claude Code, headless) on the user's subscription login.
- `glm`: the same CLI pointed at Z.ai's Anthropic-compatible endpoint (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`).
- `external`: prints the next prompt and waits. Used when another agent drives the edits, for example Claude in Cowork with subagents. The harness and commit steps are exactly the same.

Judge (optional): `claude`, `glm` or `none`. When it is `none`, its weight is spread across the other signals in proportion.

## 3. Scoring

### Hard gates (any failure caps the score at 0 for that iteration)
- **G1** `tsc --noEmit` passes.
- **G2** ESLint passes with 0 warnings.
- **G3** `vite build` succeeds.
- **G4** The lock holds: the sha256 of every file in the lock scope matches `review/contract.lock`. The scope is `DEFAULT_LOCK_SCOPE` in `review/src/gates.ts`: `review/contract/**`, `review/reference/**`, `review/rubric.json`, `review/playwright.config.ts` (its `grep` or `testIgnore` could skip contract tests), `review/src/**` (the harness itself), the ESLint, TypeScript and Vite configs (`eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `review/tsconfig.json`, `vite.config.ts`), `package.json` and `package-lock.json`. Only a human rewrites the lock, with `npm run review:lock`. Admitted limit: the lock checks itself, because `checkContractLock` lives in `review/src`, so an edited copy could pass anything. G4 catches careless edits; deliberate ones are caught by the separation check after each generator run (`git status` on `review/` and the configs) and by the generator's deny list.
- **G5** There is no `.skip(`, `.only(`, `xit(`, `xdescribe(`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` or `eslint-disable` in a source file under `src/` or `review/contract/`. `review/src/` is not scanned: it defines and tests these patterns, so it would always match itself, and G4 locks it.
- **G6** The unit and component test count has not gone down since the last iteration, so tests cannot be deleted to make the suite pass.

### Weighted signals (total 100)
| Signal | Weight | Source | Brief |
|---|---|---|---|
| Contract tests passing (Playwright behaviour and AC checks) | 25 | `review/contract/*.spec.ts` | B2.1, B2.9 |
| Unit and component tests in `src/`: the mean of their pass rate and AC coverage. Coverage is the share of spec 02's unit-testable IDs (AC-1.x, AC-2.x, AC-3.1-3.5, AC-4.1-4.6: 20 today) cited by at least one **passing** test, where a test cites the AC IDs its title starts with (AC-L11) | 15 | Vitest JSON reporter (titles and results; no source scan) | B2.9 |
| Accessibility: axe at WCAG 2.2 AA in the default, static and selected states. Each state scores `100 - 25·critical - 15·serious - 5·moderate - 1·minor` (violated rules counted by impact, floored at 0); the signal is the mean of the three. A state without a readable `axe/<state>.json` scores 0 and is named (AC-L9). There is no fallback to the AC-3.6 pass rate | 20 | @axe-core/playwright, via `axe/<state>.json` from the AC-3.6 contract tests | B2.7, B2.8 |
| Responsiveness at 320, 768 and 1280: no horizontal overflow, no clipped text, all 5 rows visible. The pass rate of the contract tests whose title starts with AC-5 | 15 | Playwright DOM checks | B2.3 |
| Visual similarity: the widget's own screenshot (`visual-widget.png`, in the 360px `?visual=1` wrapper) vs the reference cropped to the card (360x405 at x 20, y 16), on foreground pixels only | 10 | pixelmatch (threshold 0.1, anti-aliasing forgiven) over the pixels that are ink in either image (mean of R, G, B below 245): foreground similarity `1 - different/foreground`, mapped linearly from 0.10 to 0.90 onto 0 to 100. Diagnostics, not scored: the card's `diff.png`, and for five regions (label, stars, score, brand, rows) the similarity and the best offset within ±8px | B2.2 |
| AI judge rubric (component boundaries, readability, fidelity), the median of 3 samples | 15 | `review/rubric.json` | B2.4, B2.6 |

- When the judge is off, its weight is spread over the other signals in proportion. Any other missing signal scores 0 and is named; its weight is not redistributed, otherwise breaking a check would pay.

### Precondition: the widget renders (AC-L8)
The accessibility, responsiveness and visual signals score 0, naming the reason, unless at least one AC-1.1 and one AC-1.2 contract test ran and every contract test citing either passed. Without it a page with no widget earns points: axe finds nothing to flag, nothing overflows, and a near-white screenshot resembles a white reference. It is a precondition, not a gate, because a gate would zero the total and hide progress in the contract and unit signals. The visual region diagnostics are dropped too.

### Stopping
- **Done**: score >= 90 **and** all gates pass.
- **Stop**:
  - `--max-iter` is reached (default 8)
  - the score has improved by less than 1 point for 2 iterations in a row (a plateau)
  - the budget is exhausted (`--max-budget-usd`, when the generator reports its cost)

## 4. Outputs

- `npm run review` writes `review/runs/latest/` (ignored by git). The loop copies it to `review/runs/iter-NN/` (committed) after each review. A run folder holds:
  - `report.json`, the machine-readable result, and `report.md`, written for people
  - `prompt.md`, exactly what the generator was sent (loop iterations only)
  - `contract-results.json` (Playwright) and `vitest-results.json` (Vitest)
  - `axe/<state>.json` for `default`, `static` and `selected`: `{state, violations: [{id, impact, nodes}]}`, written by each AC-3.6 test after axe runs and before it asserts, and only once the widget rendered (and, for `selected`, the click worked)
  - `screenshots/page-320.png`, `page-768.png`, `page-1280.png`: the full page at each viewport
  - `screenshots/visual-widget.png`: the widget alone in `?visual=1`, the image the visual signal scores; `screenshots/visual-401.png`: the 401x443 frame, for people
  - `diff.png`, the card diff
  - `judge.json`, the judge's scores and prose, when the judge runs
- The contract tests write into `REVIEW_RUN_DIR` when it is set (the harness passes the absolute path of `runs/latest/`), otherwise into `review/runs/latest/`.
- `review/runs/scoreboard.md`: one row per iteration, showing each signal, the total, the commit SHA and a short summary of the change.
- `review/runs/index.html`: a static page with a score chart and screenshots side by side for each iteration. This is the demo page for the interview.
- One commit per iteration: `loop(iter-03): score 78 -> 86 (+8), a11y 100, contract 18/22`.

## 5. Feedback to the generator

The prompt for iteration n+1 contains:
- spec 02
- the last total
- the top 10 failures from the report, each with its AC ID, file and message
- the failed gates, if any, each with at most five lines of the command's output
- one visual-diagnostics line: the weakest of the five regions, its similarity, and the offset within ±8px at which it matches the reference best. It says where the widget differs, not how to fix it, and is left out when the widget did not render (there are no diagnostics then)

It never contains whole logs, and **never the judge's prose**, so the generator can't learn to please the judge instead of meeting the spec.

## 6. Contract vs. generator-owned tests

- **Contract tests** (`review/contract/`) are written by us from spec 02 **before** the components exist, then locked (G4). They are the acceptance-level red in TDD.
- **Unit and component tests** in `src/` are owned by the generator. It may add tests, but not delete them (G6) or skip them (G5).

## 7. Acceptance criteria

- **AC-L1** `npm run review` runs offline with no AI and writes report.json, report.md and screenshots.
- **AC-L2** The score calculation is a pure function `score(signals, weights)`, unit-tested, including gate failures and the redistribution when the judge is off.
- **AC-L3** Changing any file under the contract lock fails G4.
- **AC-L4** Adding `.skip` to any test in `src/` or `review/contract/` fails G5.
- **AC-L5** The loop stops on each stop condition (tested with a fake generator and a fake review).
- **AC-L6** Each iteration produces a commit, and a row in the scoreboard.
- **AC-L7** Generator adapters can be swapped through `--generator`. The `external` adapter is enough for a full run.
- **AC-L8** The a11y, responsive and visual signals score 0, with a reason, unless every AC-1.1 and AC-1.2 contract test passed (the widget-presence precondition).
- **AC-L9** The a11y signal is the mean of per-state axe scores over the expected states (default, static, selected). A missing or unreadable state scores 0 and is named.
- **AC-L10** The visual signal compares the widget's screenshot with the reference card on foreground pixels only.
- **AC-L11** Unit AC coverage counts only AC IDs cited by passing unit tests, over the unit-testable IDs of spec 02 (AC-1.x, AC-2.x, AC-3.1-3.5, AC-4.1-4.6).

## 8. Known limitations (to discuss)
- The reference is a 401x443 screenshot taken from a PDF, so pixel similarity is approximate. That is one reason its weight is low.
- The AI judge can be lenient or inconsistent. It is capped at 15%, uses the median of 3 samples, and is never a gate.
- Thresholds were tuned by hand.
- Visual calibration (AC-L10): 0.10 -> 0 and 0.90 -> 100 on foreground similarity. Measured on throwaway pages in the Phase 0 planning pass: an empty bordered card and unstyled HTML 0.063, a hand-tuned copy 0.864, Arial instead of Poppins 0.617, the layout 4px lower 0.522. Measured on the reference itself: an all-white widget 0.114 (1.8 points, because the anti-aliased edges of the reference's text are forgiven even where the widget has no text), and the card moved 4px down 0.560. The ceiling comes from **one** hand-tuned copy, so it is to be revisited after Phase 3 iteration 1.
- Unless fonts and rendering are pinned, screenshots can differ between operating systems. Reviews run in the same Chromium build, and baselines are not committed per OS.
