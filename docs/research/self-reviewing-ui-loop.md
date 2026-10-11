# Research: self-reviewing AI UI loop (2026-10-11, Claude subagent)

## Architecture
We own a deterministic outer loop (`loop.ts`, about 150 lines). Claude edits the code; it never grades itself.
Anthropic's harness write-up found that separating generator and evaluator matters most: agents skew positive when grading their own work, and scores plateau after about 5-15 iterations. https://www.anthropic.com/engineering/harness-design-long-running-apps

```
spec/ (read-only): ACCEPTANCE.md (AC-1..n), reference/*.png, rubric.json, tests/
for i in 1..MAX:
  claude -p  <spec + top-N failures from the last report>
  verify.ts  -> runs/<i>/report.json, report.md, screenshots/
  git commit "iter i: score 0.82 (+0.07)"
  stop if score >= 0.90 and all gates pass | i == MAX (about 8) | gain < 0.01 for 2 iterations | budget spent
```
- **Hard gates**: tsc, eslint, unit tests, no serious or critical axe violations, spec checksum unchanged.
- **Weighted score**: E2E pass rate, pixelmatch similarity, accessibility, Lighthouse (median of 3 runs), bundle size, LLM judge (capped at about 20-25%).
- **Scoreboard**: `runs/scoreboard.md` and `runs/index.html`, with side-by-side screenshots and diff images.

## Tools (npm versions checked 2026-10-11)
- Vitest 5.0.3 and @testing-library/react 16.3.3. Vitest browser mode supports `toMatchScreenshot`.
- @playwright/test 1.64.0: `toHaveScreenshot` with `animations: 'disabled'` and masks, at viewports 375, 768 and 1280.
- pixelmatch 8.0.0, for a continuous similarity score.
- axe-core 4.14.0 and @axe-core/playwright 4.13.0, with the tags wcag2a, wcag2aa and wcag22aa.
- Lighthouse 13.5.0 or @lhci/cli 0.15.1.
- TypeScript 7.0.2 (the native port) and ESLint 10.12.0.
- size-limit 14.2.0.
- **LLM judge**: a separate `claude -p --json-schema` call that sees the screenshots, the reference image and a rubric of 5-8 criteria (each tied to an AC and scored 0-3 against anchors). It must return evidence for each score. Take the median of 3 samples, and keep the generator's own claims out of what it sees. Track disagreement between the judge and the tests as a metric.

## Running Claude headlessly (Claude Code 2.1.x; see code.claude.com/docs/en/headless and cli-reference)
- `claude --bare -p "$PROMPT" --output-format json --permission-mode acceptEdits --allowedTools ... --disallowedTools "Edit(spec/**)" "Write(spec/**)" --max-turns 40 --max-budget-usd 3`
- The JSON output includes `total_cost_usd` and `session_id`, so a run can be continued with `--resume`.
- Alternative: a Stop hook that runs the verifier and blocks with exit code 2. Claude Code overrides a hook that blocks 8 times in a row, and passes `stop_hook_active` to it.
- Agent SDK: `@anthropic-ai/claude-agent-sdk` (TypeScript) or `claude-agent-sdk` (Python), with options `maxTurns`, `maxBudgetUsd` and `hooks`.

## Pitfalls
- **Gaming the checks**: deny edits to `spec/**` and make it read-only on disk (Bash can bypass tool-level denies), check a sha256 lock of the spec, fail on `.skip` / `.only`, and run the verifier against a clean copy of the spec.
- **Flaky screenshots**: self-host fonts and wait for `document.fonts.ready`, disable animations and the caret, pin the scale factor, locale and timezone, freeze Date and Math.random, and generate baselines inside the Playwright Docker image.
- **Cost**: a budget per call, a global budget, an iteration cap and a stop on plateau.
- **Context**: feed back only the top-N failures, not whole logs.

## Presenting AI use transparently
- AI-USAGE.md, plus `prompts/` and `runs/` committed to the repo, with one commit per iteration.
- A section titled "what I'd distrust".
- Be ready to rerun one iteration live.
