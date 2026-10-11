# Spec 03: self-reviewing UI loop

| | |
|---|---|
| Status | **Draft - awaiting review** |
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
| `npm run review` | Runs every check once and writes `review/runs/latest/` (report.json, report.md, screenshots, diff). | No |
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
- **G4** The contract lock holds: the sha256 of `review/contract/**`, `review/reference/**` and `review/rubric.json` matches `review/contract.lock`.
- **G5** There is no `.skip`, `.only`, `xit` or `@ts-ignore` / `eslint-disable` in `src/` or `review/`.
- **G6** The unit and component test count has not gone down since the last iteration, so tests cannot be deleted to make the suite pass.

### Weighted signals (total 100)
| Signal | Weight | Source | Brief |
|---|---|---|---|
| Contract tests passing (Playwright behaviour and AC checks) | 25 | `review/contract/*.spec.ts` | B2.1, B2.9 |
| Unit and component tests passing, and AC coverage (share of AC-1..7 IDs cited by at least one test in `src/`) | 15 | Vitest JSON reporter, plus a grep | B2.9 |
| Accessibility: axe at WCAG 2.2 AA (`100 - 25·critical - 15·serious - 5·moderate - 1·minor`, floored at 0) in the default and selected states | 20 | @axe-core/playwright | B2.7, B2.8 |
| Responsiveness at 320, 768 and 1280: no horizontal overflow, no clipped text, all 5 rows visible | 15 | Playwright DOM checks | B2.3 |
| Visual similarity at 401px wide vs the reference | 10 | pixelmatch: `1 - diffPixels/totalPixels`, mapped linearly from 0.80 to 0.98 onto 0 to 100 | B2.2 |
| AI judge rubric (component boundaries, readability, fidelity), the median of 3 samples | 15 | `review/rubric.json` | B2.4, B2.6 |

### Stopping
- **Done**: score >= 90 **and** all gates pass.
- **Stop**:
  - `--max-iter` is reached (default 8)
  - the score has improved by less than 1 point for 2 iterations in a row (a plateau)
  - the budget is exhausted (`--max-budget-usd`, when the generator reports its cost)

## 4. Outputs

- `review/runs/<n>/` holds:
  - `report.json`, the machine-readable result
  - `report.md`, written for people
  - `prompt.md`, exactly what the generator was sent
  - screenshots at 3 viewports
  - `diff.png`
- `review/runs/scoreboard.md`: one row per iteration, showing each signal, the total, the commit SHA and a short summary of the change.
- `review/runs/index.html`: a static page with a score chart and screenshots side by side for each iteration. This is the demo page for the interview.
- One commit per iteration: `loop(iter-03): score 78 -> 86 (+8), a11y 100, contract 18/22`.

## 5. Feedback to the generator

The prompt for iteration n+1 contains:
- spec 02
- the top 10 failures from the report, each with its AC ID, file and message
- the failed gate, if any

It never contains whole logs, and **never the judge's prose**, so the generator can't learn to please the judge instead of meeting the spec.

## 6. Contract vs. generator-owned tests

- **Contract tests** (`review/contract/`) are written by us from spec 02 **before** the components exist, then locked (G4). They are the acceptance-level red in TDD.
- **Unit and component tests** in `src/` are owned by the generator. It may add tests, but not delete them (G6) or skip them (G5).

## 7. Acceptance criteria

- **AC-L1** `npm run review` runs offline with no AI and writes report.json, report.md and screenshots.
- **AC-L2** The score calculation is a pure function `score(signals, weights)`, unit-tested, including gate failures and the redistribution when the judge is off.
- **AC-L3** Changing any file under the contract lock fails G4.
- **AC-L4** Adding `.skip` to any test fails G5.
- **AC-L5** The loop stops on each stop condition (tested with a fake generator and a fake review).
- **AC-L6** Each iteration produces a commit, and a row in the scoreboard.
- **AC-L7** Generator adapters can be swapped through `--generator`. The `external` adapter is enough for a full run.

## 8. Known limitations (to discuss)
- The reference is a 401x443 screenshot taken from a PDF, so pixel similarity is approximate. That is one reason its weight is low.
- The AI judge can be lenient or inconsistent. It is capped at 15%, uses the median of 3 samples, and is never a gate.
- Thresholds were tuned by hand.
- Unless fonts and rendering are pinned, screenshots can differ between operating systems. Reviews run in the same Chromium build, and baselines are not committed per OS.
