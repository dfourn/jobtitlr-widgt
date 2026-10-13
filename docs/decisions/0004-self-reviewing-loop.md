# ADR 0004: Self-reviewing loop for widgt

- Status: Accepted
- Date: 2026-10-13
- Context: spec 03; master plan decision D5 (Phase 3 generator mode)

## Context
Phase 3 built the widget's components through a loop: an AI generator edits `widgt/src/`, a deterministic harness scores the result against spec 02, and every iteration is committed with its score (`widgt/review/runs/scoreboard.md`). Whatever process we pick has to:
1. Never let the builder grade its own work. Anthropic's harness research found that agents grading themselves skew positive (spec 03 §1).
2. Score in the brief's vocabulary: each signal maps to B2.x and AC IDs (spec 03 §1).
3. Keep pixels a minor signal (B2.17: "not simply whether every pixel matches").
4. Produce its verdict without AI: `npm run review` needs no AI and no API key (spec 03 §1, AC-L1).
5. Be honest: the AI cannot edit the checks or the thresholds, and the history is never rewritten (spec 03 §1).

## Options considered
| Option | For | Against |
|---|---|---|
| One agent builds and grades its own work | No harness to build. | The failure this loop exists to prevent: self-assessment skews positive (spec 03 §1). |
| Generator with an AI judge in the feedback loop | Prose feedback; cheap to add. | The judge can be lenient or inconsistent; it is capped at 15% and is never a gate (spec 03 §8), and a generator fed its prose would learn to please the judge rather than meet the spec (spec 03 §5). |
| Human review between iterations | Genuinely independent judgement. | Stops the loop on every iteration, which an unattended run cannot afford, and the feedback is not reproducible. |
| **Separate deterministic harness, blind generator (chosen)** | The score is computed by code the generator cannot edit; re-runs are reproducible and need no AI; one commit per iteration keeps the history honest. | External mode relies on honesty (master plan §11); the visual signal is soft; a Phase 0 of harness work and hardening preceded any widget code. |

## Decision
**A deterministic harness (`widgt/review/`) scores every iteration; a fresh external generator subagent builds blind, and the loop commits each iteration with its score.**

- **Separation.** `npm run review` runs the Playwright contract tests, axe, the screenshots and Vitest, and computes the score in code — no AI, no API key (spec 03 §2, AC-L1); the score is a pure function `score(signals, weights)` (AC-L2). The generator is a **fresh subagent every iteration** (master plan §4). It may not run Playwright and may not open `widgt/review/**`, so it builds from `docs/plans/guide-widgt.md` blind and the loop's review is its only feedback: the next prompt carries spec 02, the last total, the top 10 failures with their AC IDs, the failed gates and one visual-diagnostics line, and never the judge's prose (spec 03 §5; master plan §11).
- **External mode** (D5): `npm run loop -- --generator external` reviews, commits and writes the next prompt, then hands off to the orchestrator's subagent. The harness and commit steps are exactly those of the attended `claude`/`glm` modes (spec 03 §2).
- **Gates.** Any failed gate caps the iteration at 0 (spec 03 §3): G1 typecheck, G2 lint with zero warnings, G3 build, G4 the sha256 contract lock (hashed at the start of a review and again at the end), G5 forbidden patterns (`.skip(`, `.only(`, `@ts-ignore`-style suppression, `eslint-disable`) in `src/` and `review/contract/`, G6 the test count never goes down.
- **Weights** (`widgt/review/src/score.ts:5-12`; they sum to 100):

| Signal | Weight | What it measures |
|---|---:|---|
| Contract tests | 25 | The 58 locked Playwright acceptance tests (B2.1, B2.9) |
| Unit and component tests | 15 | Mean of pass rate and AC coverage in `src/` (B2.9) |
| Accessibility | 20 | axe at WCAG 2.2 AA over the default, static and selected states (B2.7, B2.8) |
| Responsiveness | 15 | Contract tests titled AC-5, at 320, 768 and 1280 (B2.3) |
| Visual similarity | 10 | Foreground pixel similarity against the reference card (B2.2) |
| AI judge | 15 | Rubric, median of 3 samples (B2.4, B2.6) |

- **The judge was off in this run**, so its 15 points were spread over the other signals in proportion to their own weights (`score.ts:48-60`): contract carried 29.4, unit 17.6, a11y 23.5, responsive 17.6, visual 11.8. Any other missing signal scores 0 and is named; its weight is not redistributed, otherwise breaking a check would pay (spec 03 §3).
- **Anti-gaming measures:**
  - *The hashed lock (G4).* Every file that decides what passes — `review/contract/**`, `review/reference/**`, `rubric.json`, `playwright.config.ts`, `review/src/**`, the ESLint, TypeScript and Vite configs, `package.json`, `package-lock.json` — is sha256-locked in `review/contract.lock`. Only a human relocks, with `npm run review:lock` (spec 03 §3).
  - *The workspace guard.* `node review/src/guard.ts` runs with plain Node, never through npm, before every review: it refuses a `.npmrc`, Vitest/Vite config overrides and a PostCSS config, then reinstalls `node_modules` from the lock (`npm ci --ignore-scripts`), because `node_modules` is git-ignored and a patched copy would not show in `git status` (spec 03 §4, AC-L12).
  - *Scope checked on disk, not on trust.* The attended generators may write only `src/**` and `index.html`, with `review/**` denied (AC-L13). The external generator has no tool-level limits, so the orchestrator re-checks the allow list on disk after every iteration (master plan §7.3); tool rules can be bypassed through a shell anyway, which is why the guard and the gates check outcomes (spec 03 §2, `widgt/review/README.md` "Anti-gaming measures").

## How the history fits TDD
The 58 contract tests were written from spec 02 before any component existed, then locked: they are the acceptance-level red (spec 03 §6). The loop's iterations are the matching green, one commit each, and the loop never amends, rebases or force-pushes (`widgt/review/README.md`).

- **iter-00**, the baseline (`e82625b`): 12.4/100 with every gate passing and the contract honestly red at 0/58 — no widget existed, and the top failures were all `getByTestId('product-rating')` not visible (`widgt/review/runs/loop-state.json`).
- **iter-01** (`3958364`), one external generator iteration later: 95.8/100, contract green at 58/58, unit, a11y and responsive all 100, visual 64.2. The loop then stopped on its target: score >= 90 with all gates passing (`widgt/review/src/loop/stop.ts:38-39`).
- Loop commits are written by the harness, not by GLM: `loop(iter-NN): score X -> Y (+Z), a11y N, contract P/Q`, the generator's one-line summary, and a `Generator:` trailer instead of the usual `Assisted-by:` line (`widgt/review/src/loop/runner.ts:191-204`; master plan D3).

## Consequences
- What external mode enforces: writes outside the generator's scope are caught three ways — the orchestrator's allow-list check, the guard and G4 (master plan §11).
- What it does not: nothing catches the generator *reading* `widgt/review/**`, and the contract can be read anyway (master plan §11). The limits are honour-based: the brief forbids, the disk checks verify what they can, and the diff is meant to be read.
- The lock checks itself — `checkContractLock` lives in the locked `review/src/` — so G4 catches careless edits; deliberate ones rest on the guard, the allow list and people reading the diff (spec 03 §3).
- Anyone with Node and Playwright can reproduce the verdict, with no API key (AC-L1). The visual number is the one signal that does not travel (below).

## What to distrust
- **The visual signal is soft.** During Phase 0 planning, before the precondition and the foreground-only comparison existed, a page with only `<h1>widgt demo</h1>` already scored 63.5/100 on visual, because pixel similarity was measured over a largely shared background (`docs/plans/phase-0.md:51`). That finding led to the AC-L8 precondition (no a11y, responsive or visual points unless the widget's reference content rendered — the loop's iter-00 baseline correctly scored 0, reason named) and the foreground-only comparison (AC-L10). Even so, the final visual of 64.2 rests on a foreground similarity of 61.4% (13193 of 34169 foreground pixels differ; `widgt/review/runs/iter-01/report.json`) — a modest signal, deliberately weighted at 10.
- **Visual numbers are only comparable on the machine that produced them**, the same Chromium build and the same fonts; baselines are not committed per OS, so a review re-run elsewhere may score differently (spec 03 §8; master plan §11).
- **GLM reviewing GLM.** The score is code, but the adversarial reviewer subagents were fresh GLM contexts reading GLM-generated code — the same model family on both sides. That is why master plan D9 offered an independent Claude review as well, and why the human reading of the diff remains the actual backstop (master plan §11).
- **The precondition checks content, not computation.** Hardcoded markup showing the reference counts meets AC-L8; the unit tests are what check that the content comes from the data (spec 03 §8). AC-6.3 stops a pasted reference image reaching the screenshot, but not the reference redrawn from its pixel values in markup — the code would show it, and a person reviewing it would see it (spec 03 §8).
