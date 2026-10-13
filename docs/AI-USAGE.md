# AI usage

This project was built with help from Claude (Anthropic), working in Cowork with subagents. This file records what the AI did, what I did, and where I stepped in. It is kept up to date as the work goes on.

## What I own
- The problem framing, specs and acceptance criteria (drafted with AI, reviewed and edited by me)
- The decisions recorded in `docs/decisions/`
- The final review of all code and tests

## What AI did
| Date | Task | Tool | Notes |
|---|---|---|---|
| 2026-10-11 | Research: how real systems standardise job titles (ESCO, O*NET, UK SOC 2020, LinkedIn's approach) and testing techniques | Claude subagent | Summary in `docs/research/title-standardisation.md` |
| 2026-10-11 | Research: designing a self-reviewing AI UI loop | Claude subagent | Summary in `docs/research/self-reviewing-ui-loop.md` |
| 2026-10-11 | Transcribed the brief, measured the reference image (colours, bar proportions), cropped the logo placeholder | Claude (Cowork) | Measurements in `docs/brief/README.md` |
| 2026-10-11 | Drafted the assumptions log from my decisions | Claude (Cowork) | I set the framing and approved A-W1 (interactions) and A-W2 (logo placeholder) |
| 2026-10-11 | Wrote specs 02 (widget) and 03 (review loop), and ADR 0001 (styling) | Claude (Cowork) | I reviewed them. The open questions are tracked in the plan |
| 2026-10-11 | Built the widget's domain logic test-first (`feat/widgt-domain`) | Claude subagent, in its own git worktree | 9 red/green cycles. TDD caught a floating-point bug in the partial star fill |
| 2026-10-11 | Wrote 58 Playwright contract tests from spec 02 before any component existed (`feat/widgt-contract`) | Claude subagent, in its own worktree | Checked against a throwaway implementation and 6 deliberate bugs before they were locked |
| 2026-10-11 | Built the review harness and loop runner from spec 03 (`feat/widgt-review`) | Claude subagent, in its own worktree | One commit marked green still had a failing test, because piping the run through `grep` hid the exit code. The next commit fixes it |
| 2026-10-11 | Wrote the Claude Code plan (`prompts/claude-code-plan.md`). An independent subagent reviewed it, and the review's findings were applied | Claude (Cowork) | I asked for the plan → implement workflow with review checkpoints |
| 2026-10-13 | Built the jobtitlr core test-first on `feat/jobtitlr-core`: the D4 spec edits, the Maven scaffold, TDD cycles C1–C16, ADR 0002 and the README | GLM (Z.ai) via Claude Code subagents | 86 commits, 106 tests. A GLM orchestrator delegated each work package to a fresh implementer subagent and re-checked every claim; an adversarial reviewer subagent (also GLM) found no blockers or majors, and its two confirmed findings were fixed. The branch was cut before the Phase 0 merge per Dan's request for unattended overnight progress; no merge happened without him |
| 2026-10-13 | An independent review of the branch ran (D9) and its four findings were fixed | GLM (Z.ai) via Claude Code subagent | Findings: the randomized symmetry test was 99.8% vacuous, the constructor had a validate-then-copy race, `normalise`'s Javadoc omitted `IllegalStateException`, and `phase-1.md` linked a guide not on this branch. Fixed in three commits; the test count moved from 106 to 108 |

## How to spot AI-assisted commits
Every commit made with AI help ends with a `Co-Authored-By: Claude ...` trailer.

## Where I intervened / what I'd distrust
- (to be filled in as we go)
