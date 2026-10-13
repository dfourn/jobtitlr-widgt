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
| 2026-10-11 | Phase 0: checked the toolchain and baseline, and listed the open decisions with recommendations | Claude Code | The baseline showed a page with only an `<h1>` already scoring 63.5 on visual |
| 2026-10-11 | Phase 0: reviewed those decisions against the specs | Claude subagent (read-only) | I asked for this review before approving. It found gaps in the axe, lock and spec-status decisions |
| 2026-10-11 | Phase 0: planned an honest review signal (`docs/plans/phase-0.md`) | Claude subagent (read-only, planning) | I asked for one plan instead of four separate questions. It measured that a 6-line stub scored 53/100 and a correct widget scored 0 on visual. I delegated the plan's approval to Claude, "unless major problems" |
| 2026-10-11 to 12 | Phase 0: implemented the plan test-first | Claude subagents, one at a time, in the main checkout | The branch has 61 commits, most of them by five implementers. Throwaway stub pages ran in a scratch worktree, and nothing from them was committed |
| 2026-10-12 | Phase 0: adversarial review of the whole diff | Claude subagent (read-only) | 7 findings, all fixed test-first. Two were serious: an overlay outside the widget could fake the visual score, and a unit test could plant result files |
| 2026-10-12 | Phase 0: second review of the whole branch before the relock, and the fixes | Claude Code | I asked for it before rewriting the lock. 5 findings, each checked by running it: a project `.npmrc` can load code into every npm script, a unit test could rewrite locked files after G4 had passed, and three ways to paint the reference into the screenshot got past every check. All fixed test-first, with a workspace guard that runs outside npm |
| 2026-10-13 | Built the jobtitlr core test-first on `feat/jobtitlr-core`: the D4 spec edits, the Maven scaffold, TDD cycles C1–C16, ADR 0002 and the README | GLM (Z.ai) via Claude Code subagents | 86 commits, 106 tests. A GLM orchestrator delegated each work package to a fresh implementer subagent and re-checked every claim; an adversarial reviewer subagent (also GLM) found no blockers or majors, and its two confirmed findings were fixed. The branch was cut before the Phase 0 merge per Dan's request for unattended overnight progress; no merge happened without him |
| 2026-10-13 | Phase 0 close-out: relocked the contract (H0) and verified the gates | GLM orchestrator via Claude Code | I rewrote the lock myself after reviewing its 71-file scope. `npm run verify` then passed: typecheck, lint, 421 unit tests, all six gates, and the contract honestly red at 0/58 because no widget exists yet (review total 12.4/100) |
| 2026-10-13 | An independent review of the branch ran (D9) and its four findings were fixed | GLM (Z.ai) via Claude Code subagent | Findings: the randomized symmetry test was 99.8% vacuous, the constructor had a validate-then-copy race, `normalise`'s Javadoc omitted `IllegalStateException`, and `phase-1.md` linked a guide not on this branch. Fixed in three commits; the test count moved from 106 to 108 |

## How to spot AI-assisted commits
Every commit made with AI help ends with a `Co-Authored-By: Claude ...` trailer.

## Where I intervened / what I'd distrust
- **Decisions get a review too.** Before approving Phase 0's decisions, I asked for an independent check against the specs. It showed that two decisions I had been told were "spec-only" or "edit and relock" were really bigger changes.
- **Ask one question per concern.** Four separate questions turned out to be one design problem: whether the review signal can be trusted. Treating them as one produced measurements instead of opinions.
- **The visual signal measures less than its number suggests.** With pixel similarity, a mostly white page already looks similar to the reference. Even the improved signal can be beaten by redrawing the reference with markup. It is a soft signal, weighted modestly, and the contract tests and accessibility checks carry more weight.
- **Anti-cheat checks need the whole page in scope.** The first guards only inspected the widget, and an overlay painted beside it defeated them. An independent reviewer found this, not the implementers.
- **The lock checks itself.** G4 catches careless edits to the harness. Deliberate ones are caught by the separation check and by people reading the diff.
- **Review before you lock.** The first review fixed what it found, but a second pass over the whole branch, just before the relock, found that the fixes had moved the weak points rather than removed them: checks that run inside the process they protect, and lists of things to refuse that a newer browser can outgrow. Where possible the new checks look at the result (what is painted, what is on disk) instead of listing what is forbidden.
- **I delegated one approval** (the Phase 0 plan) to Claude, on condition that it found no major problems. The plan's status line says so.
