# Phase 0 plan: decisions, an honest review signal, and merging the foundations

| | |
|---|---|
| Status | **Approved** (2026-10-11), with the review comments below. Dan delegated the approval to Claude: "approve unless major problems". None found. |
| Branch | `chore/phase-0`, from `main` after `feat/widgt` is merged |
| Inputs | `prompts/claude-code-plan.md` Phase 0; specs 01-03; `docs/ASSUMPTIONS.md`; a read-only review of the decisions and a read-only planning pass (both subagents) |

## Questions for Dan (decisions first)

Each has a recommendation. A plain "yes" accepts all of them.

1. **`?visual=1` wrapper: 401px -> 360px.** The reference card is 360x405 inside a 401x443 frame (measured: card border at x 20-379, y 16-420). AC-5.1 makes the widget fill its container, so a correct widget in a 401px wrapper is 41px too wide and scores **0** on visual today. *Rec: 360px.*
2. **Widget-presence precondition, not a gate.** The a11y, responsive and visual signals score 0 (with a reason) unless every AC-1.1 and AC-1.2 contract test passes. A G gate would zero the whole total, which hides progress. *Rec: precondition.*
3. **Unit AC coverage counts only passing tests, over the unit-testable ACs** (AC-1.x, AC-2.x, AC-3.1-3.5, AC-4.1-4.6: 20 IDs after R1; the planning pass proposed 21). Today a failing test, or one citing AC-5/AC-6 (which jsdom cannot check), still counts. *Rec: yes.*
4. **Visual mapping 0.10 -> 0, 0.90 -> 100** on foreground similarity (below). The ceiling comes from **one** hand-tuned throwaway copy, so it is a calibration to revisit after Phase 3 iteration 1. *Rec: accept, revisit once.*
5. **Region diagnostics** (weakest region and its pixel offset): report **and** one line in the generator prompt, or report only? *Rec: both. The line says where, not how.*
6. **Lock `package-lock.json` too**, and add `index.html` and `src/main.tsx` to the Phase 3 separation check. Leave `src/styles/` editable: the generator may need the design tokens (ADR 0001). *Rec: yes.*
7. **Optional 59th contract test**: the widget's parts appear in the reference's top-to-bottom order. *Rec: no for now. Pixels plus AC-1 cover it; adding it costs a contract change for little signal.*
8. **Spec status.** Specs 02 and 03 become **Accepted** at the end of this phase, with the edits below. Spec 01 stays **Draft** until Dan has checked O-1..O-3 against the worked-example tests in Phase 1. *Rec: yes.*

**Answers**: all eight recommendations accepted, with comment R1 changing Q3's denominator.

## Review comments (Claude, before approval)

Checked against the code: AC-L8..AC-L11 are free (spec 03 has AC-L1..AC-L7); the 21 unit-testable IDs add up (5 + 4 + 5 + 7); `deviceScaleFactor: 1` is already set (`review/playwright.config.ts:39`); `fitToSize` (`review/src/signals/visual.ts:21`) already pads or crops a screenshot of the wrong size. No major problems.

- **R1 (Q3): drop AC-4.7 from the unit-testable set, giving 20.** "Visually distinct, not by colour alone" needs computed CSS, which jsdom does not have with CSS Modules. A unit test could only check a class name, which would be citing the AC for coverage. The contract tests check it.
- **R2 (step 6): pin down how size mismatch counts.** Add a test that a widget shorter or taller than 405px loses foreground similarity in proportion, and that `fitToSize` pads with white, so the padding is neither rewarded nor double-counted.
- **R3 (step 10): keep the stub out of the main checkout.** Build it in a throwaway worktree under the session scratchpad, run it alone (port 4173 is fixed), then remove the worktree. `git status --porcelain` on the main checkout must stay empty.
- **R4 (step 3): the boundary test imports `eslint` from inside `src/`.** It runs under `@vitest-environment node` and does not import React, so the new rule allows it. If `tsconfig.app.json` objects to Node types there, move the test somewhere covered by a Node tsconfig rather than loosening the app tsconfig (which this phase locks).

## Decisions already agreed

| # | Decision | Notes |
|---|---|---|
| 0 | Merge `feat/widgt` into `main` (`--no-ff`) **first**, then branch `chore/phase-0` | Deviates from the plan's order (merge last): the decisions touch `src/domain`, which only exists on `feat/widgt`. `main` is an ancestor, so the merge is clean. |
| 1 | `labelFor` receives the rounded score | Spec-only: the code and `rating.test.ts:232` already do this. |
| 2 | Unknown keys in counts throw `RangeError` | TDD under AC-2.3. Trade-off recorded in A-W7. |
| 3 | ESLint guard on `src/domain/**` | `no-restricted-imports` (react, react-dom, `react/*`) plus `no-restricted-syntax` on `MetaProperty` (`import.meta`). |
| 5 | Extend the G4 lock | Configs, `package.json`, `review/src/**` (and `package-lock.json` if Q6 is yes). |
| 6 | Playwright `expect` timeout stays at 5s | The timeout only costs time while tests are red; green runs never wait. |
| O-1..O-3 | Spec 01 open questions accepted as proposed | Conditional on Dan's review with the example tests in Phase 1. |

Superseded from the original list: "write `axe.json`" (replaced by the per-state design below) and "2s expect timeout" (dropped).

## Why: the score has free points

Measured by the planning pass with throwaway scripts (pinned Chromium, DPR 1, the repo's pixelmatch at threshold 0.1). Not committed.

- A page with only `<h1>widgt demo</h1>` scores **18.6**; its visual signal is 63.5 because the page background is within threshold of the reference's light greys.
- A 6-line stub (a named `<section>` and one `<p>`) scores **53.0** today, and **60.8** if `axe.json` were written naively (missing states would not count against it).
- A correct widget filling the 401px wrapper scores **0** visual (similarity 0.777, below the 0.80 floor).

## Design

### 1. Widget input contract
- `counts` is the only input. A-W5's promise of a pre-computed `average` prop is removed.
- The widget fails fast during render and does not catch its own error. Spec 02 §3 says the host validates at its data boundary with the exported `validateCounts`, or wraps the widget in an error boundary.
- No `?invalid=1` demo scenario: it would test the demo page's error handling, not the widget. Domain unit tests cover it now; a component test (with a small boundary inside the test) comes in Phase 3.

### 2. Accessibility signal
- Each AC-3.6 test writes `<runDir>/axe/<state>.json` (`{state, violations: [{id, impact, nodes}]}`) **after** axe runs and **before** its assertion. One file per state, so parallel workers cannot race.
- A state's file only exists once `openScenario` found the widget (and, for `selected`, the click worked).
- The signal is the **mean** of per-state scores over `default`, `static` and `selected`. A missing or unreadable state scores 0 and is named. Averaging stops one violation counting three times.
- The fallback to the AC-3.6 pass rate is removed.
- `playwright.config.ts` and the contract helpers use `process.env.REVIEW_RUN_DIR ?? runs/latest/`. (Today the harness always passes `runs/latest`, so ignoring the variable is a latent bug, not an active one.)

### 3. Visual signal: how close to pixel-perfect
**What is reliable.** The reference is a 401x443, DPR 1 PNG with greyscale anti-aliasing, most likely rendered by Chromium with Poppins: a font-size search matched "EXCELLENT" at 600 / 21.5px / 3.2px letter-spacing with similarity **1.000** when anti-aliasing is forgiven. So matching every pixel that is not anti-aliased is achievable. Identical pixels including anti-aliasing are not (0.69 for the same text, from sub-pixel positions). The same Chromium build gives byte-identical screenshots between runs; other operating systems or Chromium versions will differ.

**What changes.**
- Capture **the widget only** (`widget.screenshot()` -> `visual-widget.png`) and compare it with the reference **cropped to the card** (`REFERENCE_CARD = {x: 20, y: 16, width: 360, height: 405}`). Keep `visual-401.png` for people to look at.
- **Foreground similarity**: count differences only among pixels that are not white in either image (pixelmatch's anti-aliasing detection stays on). This removes the white-page bonus and orders variants sensibly:

  | Variant | Foreground similarity | Visual points (0.10 -> 0, 0.90 -> 100) |
  |---|---|---|
  | empty bordered card | 0.063 | 0 |
  | unstyled HTML | 0.063 | 0 |
  | hand-tuned copy | 0.864 | 95.5 |
  | bars scaled to the largest count | 0.840 | 92.5 |
  | no border | 0.722 | 77.8 |
  | Arial instead of Poppins | 0.617 | 64.6 |
  | plain star glyphs | 0.575 | 59.4 |
  | layout 4px lower | 0.522 | 52.8 |
  | orange instead of yellow | 0.520 | 52.5 |

- Score saturates at 0.90: there is no reward for brute-forcing the last pixels, which the brief does not mark (B2.17).
- **Anti-cheat before capture** (AC-6.3): the widget is visible; it has exactly one `<img>` (alt "feefo"); nothing inside uses a `url()` background, `canvas`, `iframe`, `object`, `embed`, `video` or SVG `<image>`; and its `ariaSnapshot()` matches `?interactive=0`. This stops the generator pasting the reference PNG, which it is allowed to read.
- **Diagnostics, not scored**: the card diff image, and five regions (label, stars, score, brand, rows), each with its best offset within ±8px. A 4px drop is reported as (0, +4) in every region. About 2s per image.

**Considered and rejected**: SSIM (narrow range, still offset-sensitive, new code); per-region text similarity (it cannot tell Arial from Poppins: AC-6.1 checks the font in the DOM instead); masking the logo (3.2% of the card's foreground).

### 4. Score integrity
- Weights in `rubric.json` stay.
- Precondition (Q2), coverage (Q3) and foreground similarity (Q4) together. **Worked out from the formulas, not yet run end to end**: no widget ~12, stub ~22.
- Bug fix: `SCREENSHOT_NAMES` (`review/src/config.ts:34`) expects `viewport-*.png`, but the contract writes `page-*.png`, so `index.html` and the judge never see the viewport screenshots.

## Steps (TDD; 🔒 = locked after the relock)

**Merge**
1. `git merge --no-ff feat/widgt` into `main`; branch `chore/phase-0`; commit this plan (`docs(plans): ...`). Add `.claude/worktrees/` to `.gitignore` (`chore: ...`).

**(a) Domain**
2. `test(widgt): AC-2.3 validateCounts throws a RangeError naming an unknown key (red)` with `"0"`, `"6"`, `"total"`. Green: compare `Object.keys` with "1"-"5"; update the JSDoc.

**(b) ESLint guard**
3. `src/domain/boundaries.test.ts` (`@vitest-environment node`, ESLint Node API `lintText`), tests under AC-7.3: rejects `react`, `react-dom/client`, `react/jsx-runtime`; rejects `import.meta`; accepts plain TypeScript in `src/domain`; allows React outside it. Green: `eslint.config.js` 🔒. The test file must not contain the literal string that G5 bans.

**(c) Harness, `review/src` 🔒**
4. AC-L9 `signals/axe.ts`: averages over the three states; a missing or unreadable state scores 0 and is named; the fallback test is removed (the commit says so).
5. AC-L8 new `signals/presence.ts`, wired into `run-review.ts`: the precondition.
6. AC-L10 `signals/visual.ts`, `score.ts`, `config.ts`: shared background ignored; empty image scores 0; the 0.10/0.90 mapping; crop to `REFERENCE_CARD`; `REFERENCE_CARD` sits on the real PNG's border; a region shifted 3px reports offset (3, 0) at similarity 1; a widget of the wrong height is padded with white and loses similarity in proportion (R2).
7. AC-L11 `signals/coverage.ts`: passing tests only; unit-testable denominator (20 IDs, R1).
8. AC-L1 `SCREENSHOT_NAMES` matches the files the contract writes; snapshots and fixtures updated.

**(d) Contract tests 🔒** (still 58, still red until components exist)
9. `playwright.config.ts`, `helpers.ts` (`RUN_DIR`, `writeAxeState`), `accessibility.spec.ts`, `visual.spec.ts`, as designed above.
10. Check against a throwaway stub (not committed; built in a scratch worktree, R3): `axe/default.json` and `axe/static.json` appear, `selected` does not, and a11y is 0 because of the precondition.

**(e) Lock scope, last**
11. `gates.ts` `DEFAULT_LOCK_SCOPE`: `dirs` add `review/src`; `files` add `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `review/tsconfig.json`, `vite.config.ts`, `package.json` (and `package-lock.json` if Q6). `gates.test.ts`: the "outside the locked scope" test uses only `src/` paths; a table shows each new path fails G4.
12. **STOP.** Dan runs `npm run review:lock` and commits it. From step 9 until then G4 fails, so `verify` is red on those commits; that is expected and said in the commit bodies.

**Then**: reviewer subagent on the diff; exit checks (`npm run verify` exit 0 after the relock); notes; merge `chore/phase-0` into `main` after Dan approves.

## Doc changes
- **Spec 02**: §3 `labelFor?: (score: number) => string`; an "Errors" paragraph; §4 `validateCounts` row (keys exactly 1-5, missing or unknown key named); AC-2.3 (missing or unknown key); AC-2.4 (receives the rounded score); AC-3.6 (default, static and selected); AC-6.3 (widget screenshot vs the reference card, foreground similarity); §8 `?visual=1` (360px wrapper, same accessibility tree as `?interactive=0`, no images except the logo). Status -> Accepted.
- **Spec 03**: G4 scope (also adds the missing `playwright.config.ts`); unit, a11y, responsive and visual rows; new "Precondition" section; outputs (`axe/`, `page-*`, `visual-widget`); AC-L8..AC-L11; limitations and calibration numbers; G5 wording matches the code (`src` and `review/contract`); `runs/<n>/` -> `iter-NN`. Status -> Accepted.
- **ASSUMPTIONS**: A-W5 drops the `average` sentence; A-W7 gets the unknown-key trade-off (an extra API field breaks the widget until the adapter strips it).
- **`widgt/review/README.md`**: `REVIEW_RUN_DIR` now honoured, expected files, anti-gaming rows (precondition, foreground similarity, DOM guard, wider lock).
- **`widgt/review/contract/README.md`** 🔒: lock scope and the new outputs.
- **`docs/brief/README.md`** "Measured": the card box.

## Risks and what I'd still distrust
- **The lock checks itself.** An edited `checkContractLock` can return pass. It catches careless edits; the separation check and the generator's deny list catch deliberate ones.
- **External generator mode relies on honesty.**
- **Rendering differs across operating systems and Chromium versions**, so visual numbers are only comparable on one machine.
- **Pixels cannot see meaning.** Bars scaled to the largest count lose only 3 points; AC-1.3 is the real guard.
- **The ±8px search can lock onto noise** in near-empty regions.
- **Coverage can still be gamed** with trivial tests that pass.
- **The four AC-6.3 capture tests pass without checking behaviour** (about 1.7 points).
- **Unverified**: exactly how React 19 with Testing Library reports errors thrown during render; the Phase 3 component test uses a boundary to be safe.
