# Phase 3 plan: widget components via the loop (`feat/widgt-components`)

| | |
|---|---|
| Status | In effect (D1: a delta against `guide-widgt.md`, which carries the research and the traps; no questions, so no approval stop) |
| Branch | `feat/widgt-components`, from `main` after **H2** (the Phase 1 merge) |
| Guides | [`guide-widgt.md`](guide-widgt.md) is the full build guide; this file records only deviations and the run specifics. Master plan §7 and §3 |

## Setup deltas (master plan §7.1)

1. Confirm `git status --porcelain` prints nothing, then branch.
2. **D7**: append one line to `widgt/review/runs/.gitignore` (it currently holds only `latest/`):
   ```
   iter-*/*-results.json
   ```
   The raw `*-results.json` files embed about 490 absolute home-directory paths, and history cannot be rewritten afterwards. Commit: `chore(widgt/review): keep raw test results with absolute paths out of the archived runs`.
3. In `widgt/`: `node review/src/guard.ts; echo "exit=$?"` must exit 0 (it reinstalls `node_modules`; nothing else may run meanwhile), then `npx playwright install chromium`.
4. Commit this file: `docs(plans): add the Phase 3 delta plan`.

## The run

In `widgt/`, in the background:

```sh
npm run loop -- --generator external --max-iter 8 --target 90; echo "exit=$?"
```

- **Exit 75 is the normal hand-off, not an error.** The loop has reviewed, committed `loop(iter-NN)` and written `review/runs/iter-NN/prompt.md`. Follow master plan §7.3 for every iteration: a **fresh generator subagent** with the brief there (never a reused one), the allow-list check, re-running its four commands yourself, then the guarded resume `node review/src/guard.ts && npm run loop -- --generator external --resume --note "<the generator's one line>"`.
- **Exit 2 is an error.** Stop and show Dan the output.
- **Exit 0** means the loop stopped (target, plateau or max-iter): go to "After the loop".

Budget: **max 8 iterations, target total 90.** A plateau below 90 is acceptable only with its reason explained (§7.5.1).

## What Dan sees each iteration (D6)

The orchestrator prints the new scoreboard row from `widgt/review/runs/scoreboard.md` and the top three failures from `widgt/review/runs/iter-NN/report.md`, then **carries on without waiting**. Stop and ask only per master plan §7.4: the total drops by 5 or more points, a gate fails in two iterations in a row, the allow-list check catches anything, the loop exits 2, or a generator reports the contract impossible.

## After the loop (§7.5)

0. The loop re-saves `widgt/review/runs/loop-state.json` after its last commit; commit it on its own (`chore(widgt/review): record the last loop commit in the loop state`); `git status --porcelain` must then print nothing.
1. `npm run test:e2e` in the background — **58/58 passing is the exit criterion.**
2. Finishing pass: an implementer subagent fixes any contract test still failing, **one failure group at a time** (`test(widgt): AC-x.y ... (red)` + `fix(widgt): ...` where jsdom can check it; otherwise `fix(widgt): AC-x.y ...` naming the contract test), re-running `test:e2e` after each group.
3. Quality pass: a reviewer subagent reads `src/components/**` against spec 02 AC-7, ADR 0001 and guide §6; confirmed fixes land as small `refactor(widgt)`/`test(widgt)` commits (G6: the unit test count must not drop).
4. Exit checks: `npm run verify` exit 0; `npm run test:e2e` exit 0 with 58 passing; `git ls-files 'widgt/review/runs/*results.json'` prints nothing.
5. Reviewer subagent on `main...HEAD`; fix the confirmed findings; update `docs/AI-USAGE.md` and the private notes.
6. **H3 (delegated, green-gated, Dan 2026-10-13):** merge `feat/widgt-components` into `main` (`--no-ff`) once `test:e2e` is 58/58 **and** the reviewer subagent's confirmed findings are fixed. No stop.

## Delta against the guide

None needed. A read-only planner check (master plan §4, 2026-10-13) found no mismatch between `guide-widgt.md` and `widgt/src` or the `package.json` scripts: every file the guide names exists or is explicitly to-create, the five generator commands match the scripts, and `src/components/` does not exist yet, so its one-folder-per-component convention cannot conflict. The guide's §2 API block is the component-facing subset of the `src/domain` barrel (`src/domain/index.ts:5-25` also exports `isStarRating`, `averageOf`, `roundScore`, `shareOf`, `starFills`, `totalOf`), which is by design, not drift.
