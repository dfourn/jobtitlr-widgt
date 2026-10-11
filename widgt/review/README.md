# review: the self-reviewing UI loop

The harness of [spec 03](../../docs/specs/03-review-loop.md). An AI agent builds the widget (spec 02). This folder scores each attempt with **deterministic checks the agent cannot edit**, and commits every iteration together with its score, so the history shows how the work progressed.

The AI is optional. `npm run review` needs no AI and no API key.

## How it works

```mermaid
flowchart LR
  P["prompt.md: spec 02 + top 10 failures + failed gates"] --> G["generator: claude / glm / external"]
  G -->|"edits src/"| REV
  subgraph REV["npm run review"]
    direction TB
    G13["G1-G3: typecheck, lint, build"] --> G46["G4 contract lock, G5 forbidden patterns, G6 test count"]
    G46 --> V["vitest --reporter=json"]
    V --> E["npm run test:e2e: Playwright contract tests, axe, screenshots"]
    E --> S["signals"] --> SC["score()"]
    J["optional judge, median of 3"] -.-> SC
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
  prompt  = spec 02 + top 10 failures (AC ID, file, message) + failed gates   (never the judge)
  generator edits src/
  review  = gates G1-G6 -> vitest -> playwright contract tests -> signals -> score
  archive runs/latest -> runs/iter-NN, rewrite scoreboard.md and index.html, git commit
  stop if score >= 90 with all gates passing | max-iter | < 1 point gained twice in a row | budget spent
```

### Score (spec 03 §3)

| Signal | Weight | Source |
|---|---:|---|
| Contract tests passing | 25 | `runs/latest/contract-results.json` (Playwright JSON reporter) |
| Unit tests passing + AC coverage (mean of the two) | 15 | Vitest JSON reporter (tests in `src/` only) + AC IDs of spec 02 cited in test titles under `src/` |
| Accessibility: `100 - 25c - 15s - 5m - 1n`, floored at 0 | 20 | `runs/latest/axe.json`; without it, the AC-3.6 contract tests |
| Responsiveness | 15 | contract tests whose title starts with `AC-5` |
| Visual similarity at 401px, 0.80 -> 0 and 0.98 -> 100 | 10 | pixelmatch of `screenshots/visual-401.png` against `reference/widget-reference.png`, written to `diff.png` |
| AI judge rubric, median of 3 samples | 15 | `rubric.json` (6 criteria, 0-3 with anchors) |

- **Any failed gate makes the total 0.** The report still shows the uncapped total.
- **Judge off:** its 15 points are spread over the other signals in proportion.
- **Any other missing signal scores 0** and is listed as missing. Its weight is *not* redistributed, otherwise breaking a check would pay.

### Gates

| Gate | Check |
|---|---|
| G1-G3 | `npm run typecheck`, `npm run lint`, `npm run build` exit with 0 |
| G4 | sha256 of `contract/**`, `reference/**`, `rubric.json` and `playwright.config.ts` matches `contract.lock` |
| G5 | no `.skip(`, `.only(`, `xit(`, `xdescribe(`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` or `eslint-disable` in `src/` or `review/contract/` |
| G6 | the number of tests in `src/` is not lower than in the previous run |

G5 does not scan `review/src/`: that is where the patterns are defined and tested, so it would always match itself. The generator may not edit `review/**` (tool deny list), and G4 locks everything under `review/` that decides what passes.

## Commands (from `widgt/`)

| Command | What it does | Needs AI? |
|---|---|---|
| `npm run review` | Runs every check once and writes `review/runs/latest/` (report.json, report.md, screenshots, diff.png). Prints a summary. | No |
| `npm run review -- --judge claude` | The same, plus the rubric judge (`claude` or `glm`). | Yes |
| `npm run review -- --strict` | Exits with 1 when a gate fails. | No |
| `npm run review:lock` | Rewrites `contract.lock`. **Humans only**, committed together with the contract change. | No |
| `npm run loop -- --generator claude --max-iter 8 --target 90 --max-budget-usd 10` | The full loop with headless Claude Code. | Yes |
| `npm run loop -- --generator glm ...` | The same CLI pointed at GLM. | Yes |
| `npm run loop -- --generator external` | Writes the next prompt, prints instructions and exits with **75**. | No |
| `npm run loop -- --generator external --resume --note "..."` | Reviews and commits the external agent's edits, then writes the next prompt. | No |
| `npm run verify` | typecheck, lint, test, then `review --strict`. | No |

Paths can be overridden: `--contract-results`, `--axe`, `--screenshot`, `--reference`, `--spec` (relative to `widgt/`). `npm run test:e2e` gets `REVIEW_RUN_DIR` (absolute path of `runs/latest/`) in its environment.

### What the contract tests are expected to write

- `review/runs/latest/contract-results.json`: Playwright's JSON reporter.
- `review/runs/latest/screenshots/{visual-401,viewport-320,viewport-768,viewport-1280}.png`.
- Optionally `review/runs/latest/axe.json`, either `{"states": {"default": {...}, "selected": {...}}}` where each state is `{critical, serious, moderate, minor}` or a raw axe result `{violations: [...]}`, or an array of `{state, violations}`.

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
| Skipping or deleting tests | G5 forbidden patterns; G6 test count never goes down. |
| Suppressing type or lint errors | G5 bans `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` and `eslint-disable`; the generator cannot edit the ESLint, TypeScript or Vite configuration. |
| Breaking a check so its weight moves elsewhere | Only the judge's weight is redistributed. Any other missing signal scores 0. |
| Breaking a test file so its failures vanish | A Vitest file that fails to load counts as one failed test. |
| Learning to please the judge | The prompt type has no field for judge output. The judge's prose goes only to `judge.json`, and the generator cannot read `review/runs/**`. |
| Long logs drowning the signal | Only the top 10 failures and at most five lines per failed gate reach the prompt. |
| Rewriting history | One commit per iteration with its score; the loop never amends, rebases or force-pushes. |

Tool-level denies can be bypassed through a shell, which is why the gates check the outcome on disk instead of trusting the deny list.

## Layout

```
review/
  rubric.json        judge criteria (locked by G4)
  contract.lock      sha256 per locked file (npm run review:lock)
  src/               the harness, strict TypeScript, tested with Vitest
    score.ts         pure score(), axe and visual mappings
    gates.ts         G1-G6
    signals/         collectors: contract, unit, coverage, axe, visual
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
