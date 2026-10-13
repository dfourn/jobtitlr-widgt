# review: the self-reviewing UI loop

The harness of [spec 03](../../docs/specs/03-review-loop.md). An AI agent builds the widget (spec 02). This folder scores each attempt with **deterministic checks the agent cannot edit**, and commits every iteration together with its score, so the history shows how the work progressed.

The AI is optional. `npm run review` needs no AI and no API key.

## How it works

```mermaid
flowchart LR
  P["prompt.md: spec 02 + top 10 failures + failed gates + weakest visual region"] --> G["generator: claude / glm / external"]
  G -->|"edits src/"| GU["node review/src/guard.ts: refuse .npmrc and config overrides, npm ci"]
  GU --> REV
  subgraph REV["npm run review"]
    direction TB
    G45["G4 lock and forbidden files, G5 forbidden patterns"] --> G13["G1-G3: typecheck, lint, build"]
    G13 --> E["npm run test:e2e: Playwright contract tests, axe, screenshots"]
    E --> S["contract, a11y, responsive, visual signals; optional judge"]
    S --> V["vitest --reporter=json, then G4 again and G6 test count"]
    V --> SC["score()"]
  end
  REV --> A["runs/iter-NN: report.json, report.md, screenshots, diff.png"]
  A --> B["scoreboard.md + index.html"]
  B --> C["git commit: loop(iter-03): score 78 -> 86 (+8)"]
  C --> D{"stop? score >= 90 with gates passing, max-iter, plateau, budget"}
  D -->|no| P
```

The same thing in plain text:

```
baseline review -> iter-00 commit
loop:
  prompt  = spec 02 + top 10 failures (AC ID, file, message) + failed gates
            + one line naming the weakest visual region and its best offset   (never the judge)
  generator edits src/ (claude and glm may write only src/** and index.html)
  guard   = node review/src/guard.ts: refuse .npmrc and config overrides, npm ci
  review  = G4 + G5 -> G1-G3 -> playwright contract tests -> their signals + judge
            -> vitest -> G4 again, G6 -> score
  archive runs/latest -> runs/iter-NN, rewrite scoreboard.md and index.html, git commit
  stop if score >= 90 with all gates passing | max-iter | < 1 point gained twice in a row | budget spent
```

### Score (spec 03 §3)

| Signal | Weight | Source |
|---|---:|---|
| Contract tests passing | 25 | `runs/latest/contract-results.json` (Playwright JSON reporter) |
| Unit tests passing + AC coverage (mean of the two) | 15 | Vitest JSON reporter, tests in `src/` only. Coverage: the share of spec 02's 20 unit-testable AC IDs (AC-1.x, AC-2.x, AC-3.1-3.5, AC-4.1-4.6) cited by at least one **passing** test; a test cites the one AC ID its own title starts with, and the one each describe title around it starts with (a title listing more IDs cites only the first) |
| Accessibility: mean over `default`, `static`, `selected` of `100 - 25c - 15s - 5m - 1n` (floored at 0) | 20 | `runs/latest/axe/<state>.json`. A missing or unreadable state scores 0 and is named; there is no fallback to the AC-3.6 pass rate |
| Responsiveness | 15 | contract tests whose title starts with `AC-5` |
| Visual similarity of the widget to the reference card, foreground pixels only, 0.10 -> 0 and 0.90 -> 100 | 10 | pixelmatch of `screenshots/visual-widget.png` against `reference/widget-reference.png` cropped to the card (360x405 at 20, 16), written to `diff.png`; per-region similarity and best offset (±8px) as diagnostics. Scored only when the AC-6.3 widget-capture contract test passed in the same run |
| AI judge rubric, median of 3 samples | 15 | `rubric.json` (6 criteria, 0-3 with anchors) |

- **Any failed gate makes the total 0.** The report still shows the uncapped total.
- **No reference content, no a11y, responsive or visual points** (precondition, AC-L8): those three score 0 with a reason unless every AC-1.1 and AC-1.2 contract test ran and passed, that is, unless the widget's reference content rendered. Those tests check what is on the page, not how it got there, so hardcoded markup showing the reference data meets the precondition too (spec 03 §8).
- **No passing widget capture, no visual points** (AC-L10): `visual-widget.png` is scored only when the AC-6.3 contract test that checks the page and then writes it passed in the same run.
- **Judge off:** its 15 points are spread over the other signals in proportion.
- **Any other missing signal scores 0** and is listed as missing. Its weight is *not* redistributed, otherwise breaking a check would pay.

### Gates

| Gate | Check |
|---|---|
| G1-G3 | `npm run typecheck`, `npm run lint`, `npm run build` exit with 0 |
| G4 | sha256 of every file in `DEFAULT_LOCK_SCOPE` (`src/gates.ts`) matches `contract.lock`: `contract/**`, `reference/**`, `rubric.json`, `playwright.config.ts`, `src/**` (the harness), `review/tsconfig.json`, and in `widgt/` `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `package.json` and `package-lock.json`. `.DS_Store` and `Thumbs.db` inside the locked folders are ignored, and the root `.gitattributes` keeps text LF, so neither the OS nor `core.autocrlf` changes a hash. Hashed again at the end of the review and compared in memory with the start, so a file changed while the review ran fails too. Also fails, and no command runs, while `widgt/` holds a `.npmrc`, `vitest.config.*`, `vitest.workspace.*`, `vite.config.*` other than `.ts`, or a PostCSS config (AC-L12) |
| G5 | no `.skip(`, `.only(`, `xit(`, `xdescribe(`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` or `eslint-disable` in `src/` or `review/contract/` |
| G6 | the number of tests in `src/` is not lower than in the previous run |

G5 does not scan `review/src/`: that is where the patterns are defined and tested, so it would always match itself. The generator may not edit `review/**` (tool deny list), and G4 locks `review/src/` together with everything else that decides what passes.

G4 checks itself: `checkContractLock` lives in the locked `review/src/`, so a deliberate edit could make it pass anything. It catches careless edits; deliberate ones are caught by the workspace guard, the generator's allow list, and people reading the diff.

### The workspace guard (AC-L12)

`node review/src/guard.ts` runs with **plain Node**: not through npm, which reads a project `.npmrc` before any script (its `node-options` can load code into every Node process, this harness included), and not through tsx, which lives in `node_modules`. It imports only `node:` built-ins, and Node 22 runs the TypeScript directly. It refuses the files G4 refuses (exit 1, each named with its reason); on a clean workspace it runs `npm ci --ignore-scripts` without inherited `NODE_OPTIONS` or `npm_config_*` settings, because `node_modules` is git-ignored and a patched copy would not show in `git status`. `--check-only` skips the reinstall; `--root <dir>` checks another folder.

The loop runs it before every review. After any generator run outside the loop, run it yourself before `npm run review`.

## Commands (from `widgt/`)

| Command | What it does | Needs AI? |
|---|---|---|
| `npm run review` | Runs every check once and writes `review/runs/latest/` (report.json, report.md, screenshots, diff.png). Prints a summary. | No |
| `npm run review -- --judge claude` | The same, plus the rubric judge (`claude` or `glm`). | Yes |
| `npm run review -- --strict` | Exits with 1 when a gate fails. | No |
| `npm run review:lock` | Rewrites `contract.lock`. **Humans only**, committed together with the contract change. | No |
| `node review/src/guard.ts` | The workspace guard: refuses `.npmrc` and config overrides, then reinstalls `node_modules`. Run it before `npm run review` after a generator run. | No |
| `npm run loop -- --generator claude --max-iter 8 --target 90 --max-budget-usd 10` | The full loop with headless Claude Code. | Yes |
| `npm run loop -- --generator glm ...` | The same CLI pointed at GLM. | Yes |
| `npm run loop -- --generator external` | Writes the next prompt, prints instructions and exits with **75**. | No |
| `node review/src/guard.ts && npm run loop -- --generator external --resume --note "..."` | Guards the workspace, then reviews and commits the external agent's edits and writes the next prompt. | No |
| `npm run verify` | typecheck, lint, test, then `review --strict`. | No |

Paths can be overridden: `--contract-results`, `--axe` (the folder of `<state>.json` files), `--screenshot` (the widget screenshot), `--reference`, `--spec` (relative to `widgt/`). `npm run test:e2e` gets `REVIEW_RUN_DIR` (absolute path of `runs/latest/`) in its environment, and the Playwright config and contract helpers write every output under it (`review/runs/latest/` when it is not set).

### What the contract tests are expected to write

- `contract-results.json`: Playwright's JSON reporter.
- `axe/default.json`, `axe/static.json`, `axe/selected.json`: `{"state", "violations": [{"id", "impact", "nodes"}]}`, one per AC-3.6 state, written only once the widget rendered (and, for `selected`, the click worked). Rules are counted by impact; a raw axe result with a `violations` array is accepted too.
- `screenshots/visual-widget.png` (the widget alone in `?visual=1`, scored), `screenshots/visual-401.png` (the 401x443 frame, for people) and `screenshots/page-{320,768,1280}.png`.

All under `REVIEW_RUN_DIR`, which the harness sets to `review/runs/latest/` and empties at the start of each review. The harness reads them, and runs the judge, before Vitest runs any unit test, so only what this run's contract tests wrote is scored. Paths given with `--axe` or `--contract-results` are read, never deleted.

Anything missing is reported as a missing signal, never a crash.

## Running with a Claude subscription

Log in once with `claude` (Claude Code 2.1.x). No API key is needed:

```bash
claude            # log in interactively, then exit
npm run loop -- --generator claude --max-iter 8 --max-budget-usd 10
```

The generator runs `claude -p` with the prompt on stdin and:

- `--output-format json`, to read `total_cost_usd` (also reported on a subscription, where it is notional) and the final message for the scoreboard;
- `--permission-mode acceptEdits --permission-prompts none`, so edits are accepted and anything outside the allow list is denied instead of hanging;
- `--allowedTools` Read, Glob, Grep, Edit, Write and the project's own `npm test` / `typecheck` / `lint` / `build`;
- `--disallowedTools` `Edit(review/**)`, `Write(review/**)`, `Read(review/runs/**)`, the package and tool configs, and `Bash(git *)`;
- `--max-budget-usd` set to what is left of the loop's budget.

`--bare` is deliberately not used: it ignores the subscription login and only accepts `ANTHROPIC_API_KEY`.

## Running with GLM

The same CLI, pointed at Z.ai's Anthropic-compatible endpoint:

```bash
export GLM_API_KEY=...                                   # required
export GLM_BASE_URL=https://api.z.ai/api/anthropic       # optional, this is the default
export GLM_MODEL=glm-4.6                                 # optional, passed as --model
npm run loop -- --generator glm --judge glm
```

The harness maps them onto `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` for the child process only.

## Anti-gaming measures

| Risk | Measure |
|---|---|
| The generator grades itself | Generator and evaluator are separate. The score is computed by code; the judge is optional, capped at 15% and never a gate. |
| Weakening the contract, the reference or the thresholds | G4 sha256 lock over `contract/`, `reference/`, `rubric.json` and `playwright.config.ts`; the generator's tools deny `review/**`. |
| Editing the harness, a config or the packages to change what is measured | G4 also locks `review/src/**`, the ESLint, TypeScript and Vite configs, `package.json` and `package-lock.json`. The lock checks itself, so the workspace guard and the generator's allow list back it up. |
| Changing how the tools run without touching a locked file: a `.npmrc` (`node-options` loads code into every npm script), a Vitest or Vite config that wins over the locked one, a PostCSS config, a patched `node_modules` | The workspace guard (AC-L12), run with plain Node before every loop review, refuses those files and reinstalls `node_modules`; G4 refuses the files too and then runs no command. The `claude` and `glm` generators may write only `src/**` and `index.html` (AC-L13). |
| Scoring a11y, responsive or visual points without a widget | Precondition (AC-L8): those signals score 0 unless every AC-1.1 and AC-1.2 contract test passed, that is, the widget's reference content rendered. axe on an empty page, an empty page that never overflows and a near-white screenshot earn nothing. Residual: hardcoded markup showing the reference data passes the precondition; the unit tests and the judge check the content comes from the data. |
| A white page or an empty card looking like the reference | Foreground similarity (AC-L10): only pixels that are ink in either image count, compared with the reference cropped to the card. An empty bordered card scores 0.063 (0 points). |
| Pasting the reference PNG, or painting it over, behind or through the widget | AC-6.3 checks the **whole** `?visual=1` page before capturing, because `widget.screenshot()` holds everything painted in the widget's box: exactly one `<img>` on the page, the widget's logo (alt "feefo", at most 4% of the widget's area); no `picture`, `source`, `canvas`, `iframe`, `object`, `embed`, `video`, SVG `<image>`, `feImage`, `pattern` or image input, and no SVG `<use>` outside the page; no CSS `url()`, `image-set()` or `paint()` on any element or its pseudo-elements, except SVG-shape masks and clips (alpha only) and a `fill` or `stroke` referencing a gradient in the page; no shadow DOM (found through the DevTools Protocol, which also sees closed roots); the widget and its ancestors fully opaque, visible and not blended; with the widget hidden (opacity 0) its box plain white, so nothing from outside it paints there; the logo painting only inside its own box; and the same `ariaSnapshot()` as `?interactive=0`. Residual: redrawing the reference pixel by pixel with markup or gradients is not detected (spec 03 §8). |
| Counting one axe violation three times, or skipping a state | The a11y signal is the mean of per-state scores; a missing state scores 0 and is named. |
| Citing AC IDs only for coverage | Coverage counts only passing tests, over the IDs unit tests can check (AC-1.x, AC-2.x, AC-3.1-3.5, AC-4.1-4.6; not AC-3.6, AC-3.7, AC-4.7 or AC-5 to AC-7, which need a browser). A title cites only the first AC ID it starts with, so listing many IDs in one test earns one. |
| Skipping or deleting tests | G5 forbidden patterns; G6 test count never goes down. |
| Suppressing type or lint errors | G5 bans `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` and `eslint-disable`; the ESLint, TypeScript and Vite configs are outside the generator's allow list and locked by G4. |
| Breaking a check so its weight moves elsewhere | Only the judge's weight is redistributed. Any other missing signal scores 0. |
| Breaking a test file so its failures vanish | A Vitest file that fails to load counts as one failed test. |
| A unit test (generator code, in Node, with file access) forging the contract's outputs or changing its inputs | Vitest runs last: the contract tests, their signals and the judge are done before any unit test runs, and G4 is checked again at the end against the hashes taken at the start. The widget screenshot counts only if its AC-6.3 capture test passed in this run. Residual: a process a unit test starts and detaches could write after the review, into the archived run folder or into `node_modules` or a locked file for the next review; the guard's `npm ci` and G4 catch the last two (spec 03 §8). |
| Learning to please the judge | The prompt type has no field for judge output. The judge's prose goes only to `judge.json`, and the generator cannot read `review/runs/**`. |
| Long logs drowning the signal | Only the top 10 failures and at most five lines per failed gate reach the prompt. |
| Rewriting history | One commit per iteration with its score; the loop never amends, rebases or force-pushes. |

Tool-level rules can be bypassed through a shell, and the `external` generator has none, which is why the guard and the gates check the outcome on disk instead of trusting the allow list.

## Layout

```
review/
  rubric.json        judge criteria (locked by G4, like contract/, reference/ and src/)
  contract.lock      sha256 per locked file (npm run review:lock)
  src/               the harness, strict TypeScript, tested with Vitest
    score.ts         pure score(), axe and visual mappings
    gates.ts         G1-G6
    guard.ts         the workspace guard (plain Node: node review/src/guard.ts)
    signals/         collectors: contract, unit, coverage, axe, visual, presence
    judge/           NoJudge, CliJudge (claude, glm), rubric schema
    report.ts        report.md and scoreboard.md
    html.ts          runs/index.html (inline SVG, no external assets)
    loop/            stop rules, prompt builder, generators, loop runner
    review.ts        npm run review
    loop.ts          npm run loop
    lock.ts          npm run review:lock
  runs/
    latest/          the last review (ignored by git)
    iter-NN/         one folder per loop iteration (committed)
    scoreboard.md, index.html, loop-state.json
```
