# Master plan: finish the Feefo assessment with GLM

| | |
|---|---|
| Status | **Approved** (2026-10-12): Dan accepted all ten decisions in §1. Waiting for H0 (the relock) |
| Written | 2026-10-12 by Claude Code (Claude Opus), from three read-only research subagents (Java, widget, harness and process) over the repository at `eb24100`, then checked by an independent reviewer subagent (3 blockers, 9 major and 23 minor findings, all applied) |
| Supersedes | The phase order and per-phase steps of `prompts/claude-code-plan.md`. Its **Rules** section still applies, with the changes in §3 |
| Companion guides | [`guide-jobtitlr.md`](guide-jobtitlr.md) (Phases 1 and 2) and [`guide-widgt.md`](guide-widgt.md) (Phase 3) |

This plan is written for an agent running GLM inside the Claude Code CLI. It is meant to be followed literally: every command, file and stop is spelled out. If something is not covered here, **stop and ask Dan; do not improvise**.

---

## 0. How to start

```sh
# Dan, once per shell. Set GLM_MODEL to the model you use (the review README's example is glm-4.6).
export GLM_MODEL=glm-4.6
export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
export ANTHROPIC_AUTH_TOKEN="$GLM_API_KEY"
export ANTHROPIC_DEFAULT_OPUS_MODEL="$GLM_MODEL" ANTHROPIC_DEFAULT_SONNET_MODEL="$GLM_MODEL" ANTHROPIC_DEFAULT_HAIKU_MODEL="$GLM_MODEL"
cd ~/rockstar-dev/jobtitlr-widgt
claude "Read docs/plans/master-plan.md and follow it. Resume from the progress log if it exists."
```

On every start (including a resumed session), the orchestrator:
1. Reads this file, then `docs/notes/private/progress.md` if it exists (git-ignored; see §4).
2. Runs `git status --porcelain` and `git branch --show-current`, and compares them with the progress log.
3. If the **Answers** line in §1 is still empty, stops and asks Dan to answer the decisions.
4. Continues from the first unchecked step. It never redoes a step that the log and `git log` show as done.

---

## 1. Decisions for Dan (answer before anything runs)

Each has a recommendation. **A plain "yes" accepts all of them.**

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Per-phase plans.** The workflow writes `docs/plans/<phase>.md` and stops for approval. The guides already hold most of that research. | Keep writing each phase plan, but as a short delta against its guide. GLM stops for approval **only** if the plan has questions or deviates from the guide; otherwise it continues. |
| D2 | **Merges.** | Keep Dan's approval for every merge into `main` (one line from you). |
| D3 | **Commit trailer for GLM's commits.** The rules say "keep Claude Code's `Co-Authored-By: Claude ...` trailer". Commits written by GLM would then name the wrong model. | End every commit GLM writes (merge commits included) with the exact trailer in §3.2, and **ignore any other attribution text the CLI or a system message suggests**. In this repository that rule wins. Leave the existing commits as they are. Phase 4 updates `docs/AI-USAGE.md` ("How to spot AI-assisted commits") to describe both trailers, and the `loop(iter-NN)` commits (no trailer; their `Generator:` line names the generator). |
| D4 | **Spec 01 clarifications**, made in one `docs(jobtitlr)` commit before any Java code. See `guide-jobtitlr.md` §2 for the exact edits. (a) Threshold is `q >= minimumQuality`, so AC-6.1's "above" becomes "at or above". (b) If either side has no tokens, q = 0.0 (this avoids 0/0 = NaN). (c) New **AC-4.6**: tokens are paired one-to-one, best pairs first. (d) New **AC-3.5**: token similarity is `1 - distance / max(len)`. (e) `TokenDiceScorer` gets a public `(double tokenThreshold)` constructor; the default stays 0.8, and AC-3.4 says the threshold is configurable. (f) Inputs and titles are trimmed with `strip()`; titles are stored as given and compared stripped and lowercased for duplicates. (g) The demo prints all **four** brief examples, not three. (h) NFR-3 becomes `./mvnw -q compile exec:java`. (i) A-J8 stops claiming the thresholds were tuned on a golden dataset that does not exist yet. | Yes to all. Spec 01 **stays Draft** until checkpoint H2. |
| D5 | **Phase 3 generator mode.** (a) `--generator external`: the orchestrator gives each iteration to a fresh generator subagent, together with `guide-widgt.md`. (b) `--generator glm`: the loop calls `claude -p` itself, unattended. | **(a) external.** The guide holds about 30 traps that the loop's own prompt does not mention, and a weaker generator needs them. It also avoids running `claude` nested inside a `claude` session, which is unverified. The cost is that external mode relies on honesty, so §7.3 adds a stricter allow-list check after every iteration. |
| D6 | **Phase 3 reporting.** The old plan shows Dan the scoreboard row after each iteration. | GLM prints the row and the top three failures, then **carries on** without waiting. It stops and asks only on a regression (see §7.4). |
| D7 | **Run artefacts.** The loop copies `runs/latest/` into the committed `runs/iter-NN/`, and `contract-results.json` and `vitest-results.json` hold about 490 absolute home-directory paths. History cannot be rewritten afterwards. | Before the first loop run, add `iter-*/*-results.json` to `widgt/review/runs/.gitignore`. That file is outside the lock. |
| D8 | **Generator scope.** The old plan allows `src/components/**`, `src/App.tsx` and component tests. | Also allow `src/demo/**` (parsing the query string) and `src/styles/**` (tokens; Phase 0 Q6 kept it editable). Still forbidden: `src/domain/**`, `src/main.tsx`, `index.html` and every config (Phase 0 Q6), plus `src/test/**`, `src/assets/**` and `src/vite-env.d.ts`. |
| D9 | **Independent review.** GLM reviewing GLM is less independent than the earlier reviews. | Optional but cheap: at the end of Phases 1 and 3, Dan also runs `/code-review` with Claude on the branch. GLM's reviewer subagent runs either way. |
| D10 | **Phase 2 (optional Java extension).** | Decide after Phase 4. The default is to skip it. |

**Answers** (2026-10-12): all ten recommendations accepted (Dan: "yes").

---

## 2. Phase order and checkpoints

```
H0 Dan relocks ─► P0 close ─► H1 merge P0 ─► P1 Java core ─► H2 spec 01 + merge
   ─► P3 widget ─► H3 merge ─► P4 docs ─► H4 merge ─► [P2 optional, H5] ─► P5 verify ─► H6 tag + push
```

**Human checkpoints.** GLM stops at each one, says exactly what it needs from Dan, and waits.

| ID | When | What Dan does |
|---|---|---|
| H0 | Now, before GLM starts | In `widgt/`: `npm run review:lock`, then commit `widgt/review/contract.lock` with a reason (Phase 0 plan step 12). GLM **never** runs `review:lock`. |
| H1 | After P0's `verify` passes | Approves the merge of `chore/phase-0` into `main`. |
| H2 | End of Phase 1 | Checks O-1..O-3 against the worked-example tests; if they are fine, GLM marks spec 01 **Accepted**. Approves the merge. |
| H3 | End of Phase 3 | Approves the merge (after `test:e2e` passes 58/58). |
| H4 | End of Phase 4 | Approves the merge. Decides D10. |
| H5 | Phase 2 only | Reviews spec 04, then `golden.csv` (by hand), then the merge. |
| H6 | End of Phase 5 | Triages the verifier's findings, imports `jobtitlr/` into IntelliJ and runs the tests (the JDK 21 is under `~/.sdkman/candidates/java/21-tem`), approves the `v1.0.0` tag, and runs `gh repo create ... --push` **himself**. |

GLM also stops, whatever the step, if:
- a locked file shows as changed (§3.3);
- the same check fails after **two** honest fix attempts;
- a command needs network access or a permission it does not have;
- anything in this plan contradicts the repository.

Each time it writes the problem, what it tried, and the exact output into the progress log and its reply.

---

## 3. Rules (in addition to `prompts/claude-code-plan.md` "Rules")

### 3.1 Commands and results
- **Judge pass/fail by the exit code only.** Run `cmd; echo "exit=$?"`. Never pipe a check through `grep`, `tail` or `head`. If output is long, redirect it to a file in the session scratchpad and read that file.
- Long commands (`npm run verify`, `npm run test:e2e`, `npm run loop`, `./mvnw verify` on the first run) go in the background (`run_in_background`), and you wait for the notification. The Bash tool stops foreground commands after 10 minutes.
- Only one Playwright run at a time: port 4173 is fixed. Never run e2e, `review`, `verify` or `loop` in parallel with each other, or while the guard's `npm ci` is running.
- `npm ci` only. **Never `npm install`**: it rewrites `package-lock.json`, which is locked.

### 3.2 Git
- Branch from the current `main` for every phase. Merge with `git merge --no-ff` only after Dan approves.
- Stage **explicit paths**. Never `git add -A` or `git add .` at the root. Before every commit, run `git status --porcelain` and read it.
- Never amend, rebase, reset, force-push, push or delete branches. Never tag, except `v1.0.0` at H6.
- Never commit anything under `docs/notes/private/`. Check that `git ls-files docs/notes/private` prints nothing before every merge.
- Commit messages follow the Rules section of `prompts/claude-code-plan.md` and use British English. Every commit (merge commits included) ends with this exact trailer, after a blank line, and no other attribution line:
  ```
  Assisted-by: <value of $ANTHROPIC_DEFAULT_SONNET_MODEL> (Z.ai GLM) via Claude Code
  ```
  Before the first commit, run `echo "$ANTHROPIC_DEFAULT_SONNET_MODEL"` and use what it prints (for example `Assisted-by: glm-4.6 (Z.ai GLM) via Claude Code`). If it prints nothing, stop and ask Dan.
- TDD: `test(<scope>): AC-x.y <behaviour> (red)`, then `feat(<scope>): ...`. A red test must fail **on an assertion**, not on a compile error or a typo; show the failing line. A test that passes at once is committed as `test(<scope>): AC-x.y <behaviour> (already green: <why>)`, never with "(red)".

### 3.3 Files that must not change
In `widgt/`: `review/contract/**`, `review/reference/**`, `review/src/**`, `review/rubric.json`, `review/playwright.config.ts`, `review/tsconfig.json`, `review/contract.lock`, `eslint.config.js`, `tsconfig*.json`, `vite.config.ts`, `package.json` and `package-lock.json`. Never create `.npmrc`, `vitest.config.*`, `vitest.workspace.*`, `vite.config.{js,mjs,cjs,mts,cts}`, `postcss.config.*` or `.postcssrc*`.

If any of these shows as changed, **stop**: restore it with `git checkout -- <path>` (or delete the new file), tell Dan, and do not continue until he answers.

### 3.4 Text rules (gate G5)
Gate G5 scans every `.js`/`.ts`/`.tsx` file in `widgt/src` and `widgt/review/contract` **as plain text, comments included**. None of these may appear anywhere, even in a comment: `.skip(`, `.only(`, `xit(`, `xdescribe(`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`. ESLint also bans `any` and non-null `!`.

### 3.5 Test names
Every test name starts with the AC ID it **really** checks. Never cite an ID only to raise coverage. Java tests put it in `@DisplayName`; parameterised tests put it in the first CSV column with `name = "{0} ..."`.

---

## 4. How GLM uses subagents

The orchestrator (the main GLM session) keeps its own context small. It plans, delegates, checks results and talks to Dan. **It does not write production code itself.**

| Role | Subagent type | When | Rules |
|---|---|---|---|
| Planner | `Explore` or `Plan` (read-only) | The start of each phase, to confirm the guide still matches the code | Read-only. Returns facts with file:line. |
| Implementer | `general-purpose` | Each work package in §5–§10 | **One at a time, in the main checkout.** Brief = the work package text + the relevant guide section + §3 of this file + the Rules section of `prompts/claude-code-plan.md`. Makes the commits for its package and returns: the commits (`git log --oneline`), the commands it ran, and their exit codes. |
| Generator | `general-purpose`, **fresh for every iteration** | Phase 3 loop iterations | Brief template in §7.3. Never runs git. Never opens `widgt/review/**`. |
| Reviewer | `general-purpose`, fresh, has written none of the code | The end of each phase | Adversarial: checks the diff `main...HEAD` against the spec's ACs, the guide and §3. Reports findings with file:line and a concrete failure scenario. Makes **no** edits. |
| Doc writer | `general-purpose` | Phases 1 and 4 | Doc writers **may run in parallel** when they edit different files. Parallel writers **only edit; they never commit**. The orchestrator then commits each file group in turn. |
| Verifier | `general-purpose`, fresh, has seen none of the work | Phase 5 | Works only in a fresh clone in the session scratchpad. |

After each subagent returns, the orchestrator **checks its claims itself**: `git log --oneline -n <k>`, `git status --porcelain`, and the phase's checks, run again with their exit codes. Then it ticks the step in the progress log.

**Progress log.** `docs/notes/private/progress.md` (git-ignored, never committed). One line per step: `- [x] P1.C5 typo-tolerant tokens: a1b2c3d..e4f5a6b, mvnw verify exit 0`. Also update `docs/notes/private/working-notes.md` at the end of each phase (decisions, surprises, where Dan intervened), as the rules require.

---

## 5. Phase 0 close-out (`chore/phase-0`)

Prerequisite: **H0 is done**. `git log -1 --format=%h -- widgt/review/contract.lock` prints something other than `c276a9e` (the old lock).

1. In `widgt/`, in the background: `npm run verify; echo "exit=$?"`. It must exit 0, with all six gates passing. Contract tests are still red (0/58); that is expected, because `verify` checks gates, not contract results.
2. If it exits non-zero: stop and show Dan the gate lines from `review/runs/latest/report.md`.
3. Commit this plan and the two guides: `docs(plans): add the master plan and the implementation guides for the remaining phases` (if they are not committed yet).
4. Add a Phase 0 close-out row to `docs/AI-USAGE.md` (`docs: ...`).
5. **H1**: ask Dan to approve. On approval: `git checkout main && git merge --no-ff chore/phase-0 -m "merge: Phase 0 (decisions, honest review signal, wider lock)"`.

---

## 6. Phase 1: jobtitlr core (`feat/jobtitlr-core` from `main`, after H1)

Everything an implementer needs is in `guide-jobtitlr.md`. Work packages, in order, **one implementer at a time**:

| WP | Content | Guide |
|---|---|---|
| 1.0 | Write `docs/plans/phase-1.md` (delta against the guide, D1), and commit it | — |
| 1.1 | The spec 01 and ASSUMPTIONS edits from D4, in one `docs(jobtitlr)` commit (spec stays Draft) | §2 |
| 1.2 | Scaffold: `pom.xml`, Maven wrapper, `.mvn/`; check `./mvnw -q verify` exits 0 and `git ls-files -s jobtitlr/mvnw` shows mode `100755` | §3 |
| 1.3 | Cycles C1–C7 (`Tokeniser`, `Levenshtein`, `MatchResult`, `TokenDiceScorer`) | §5 |
| 1.4 | Cycles C8–C14 (`Normaliser`) | §5 |
| 1.5 | Cycles C15–C16 (worked examples, `Demo`), and the NFR-4 ID check | §5, §6 |
| 1.6a | ADR `docs/decisions/0002-jobtitlr-matching-algorithm.md`. A doc writer can do this **in parallel** with WP 1.3–1.5 (edit only; the orchestrator commits it) | §8 |
| 1.6b | `jobtitlr/README.md`, **after** WP 1.5, because it needs the final test count | §7 |

After each WP from 1.2 on, from `jobtitlr/`: `./mvnw -q verify; echo "exit=$?"`.

**Exit**
- In a fresh clone in the scratchpad, `./mvnw -q verify` and `./mvnw -q compile exec:java` both exit 0, and the demo prints the four brief lines.
- The NFR-4 check passes: every AC ID in spec 01 appears in at least one test name.
- A reviewer subagent has checked the diff; the confirmed findings are fixed; D9 if wanted. AI-USAGE and the private notes are updated.
- **H2.**

---

## 7. Phase 3: widget components via the loop (`feat/widgt-components` from `main`, after H2)

### 7.1 Setup
1. Confirm `git status --porcelain` prints nothing.
2. D7: add these lines to `widgt/review/runs/.gitignore`, and commit as `chore(widgt/review): keep raw test results with absolute paths out of the archived runs`:
   ```
   iter-*/*-results.json
   ```
3. In `widgt/`: `node review/src/guard.ts; echo "exit=$?"` (exit 0), then `npx playwright install chromium`.
4. Write `docs/plans/phase-3.md` as a delta against `guide-widgt.md` (D1): the iteration budget (max 8, target 90) and what Dan sees per iteration. Commit it (`docs(plans): ...`). Stop only if D1 requires it.

### 7.2 Start the loop
In `widgt/`, in the background:
```sh
npm run loop -- --generator external --max-iter 8 --target 90; echo "exit=$?"
```
- **Exit 75 is the normal hand-off, not an error.** The loop has reviewed the baseline, committed `loop(iter-00)` and written `review/runs/iter-01/prompt.md`.
- **Exit 2 is an error.** Stop, and show Dan the output.
- **Exit 0** means the loop stopped (target, plateau or max-iter). Go to §7.5.

### 7.3 Each iteration
1. **Read** `widgt/review/runs/iter-NN/prompt.md` (the orchestrator may read it; the generator may not).
2. **Spawn a fresh generator subagent** with exactly this brief, filling in the `<...>` parts:

   > You are the generator for iteration NN of the widget's self-reviewing loop. Paths below are from the repository root. Run every command as `cd widgt && <command>`.
   >
   > **Read first:** `docs/plans/guide-widgt.md` (the whole file; it is the build guide and lists the traps), `docs/specs/02-widgt.md`, `docs/decisions/0001-widgt-styling.md`, and the current files under `widgt/src/`.
   >
   > **The review of the previous iteration says** (only its "Current state", "Failed gates" and "Top failures" sections; its "Rules" section does not apply, because the scope below wins):
   > `<paste those sections of prompt.md here>`
   >
   > **You may create or edit only:** `widgt/src/components/**`, `widgt/src/demo/**`, `widgt/src/styles/**`, `widgt/src/App.tsx`, `widgt/src/App.module.css`, `widgt/src/App.test.tsx`, and `widgt/src/css-custom-properties.d.ts`.
   > **You must not touch:** `widgt/src/domain/**`, `widgt/src/test/**`, `widgt/src/assets/**`, `widgt/src/vite-env.d.ts`, `widgt/src/main.tsx`, `widgt/index.html`, anything under `widgt/review/`, any config or package file, or anything outside `widgt/src/`. Do not open `widgt/review/**`. Do not add dependencies.
   > **You may run only:** `npm test`, `npx vitest run <file>`, `npm run typecheck`, `npm run lint`, `npm run build`. Never run git, `npm install`, `npm run review`, `npm run loop` or Playwright.
   > Component tests use Testing Library and `userEvent.setup()`, query by role and name, and start with the AC ID they really check (guide §7).
   > Before you finish, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` must all exit 0. Report each exit code.
   > Finish with **one line** describing what you changed (it becomes the commit note), and list the files you touched.

3. **Allow-list check.** From the repository root, this must print nothing (replace `NN` with the iteration number):
   ```sh
   git status --porcelain --untracked-files=all -- . \
     ':!widgt/src/components' ':!widgt/src/demo' ':!widgt/src/styles' \
     ':!widgt/src/App.tsx' ':!widgt/src/App.module.css' ':!widgt/src/App.test.tsx' \
     ':!widgt/src/css-custom-properties.d.ts' \
     ':!widgt/review/runs/loop-state.json' ':!widgt/review/runs/iter-NN/prompt.md'
   ```
   Those last two are written by the loop itself after it hands off. Then, from `widgt/`, `node review/src/guard.ts --check-only; echo "exit=$?"` must exit 0.
   If anything prints or the guard fails: revert those paths (`git checkout -- <path>`, delete new files), tell Dan, and stop.
4. **Check the generator's claims yourself:** `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, each with its exit code. If one fails, spawn a **new** generator with the same brief plus the failure output (at most once), then repeat step 3. If the checks fail again, stop and ask Dan.
5. **Resume**, in the background, from `widgt/`:
   ```sh
   node review/src/guard.ts && npm run loop -- --generator external --resume --note "<the generator's one line>"; echo "exit=$?"
   ```
   Remove every `"`, `` ` ``, `$` and `\` from the line before pasting it into the command.
   - Exit 1 means the guard refused: stop and show Dan its output.
   - Then check that no home-directory path reached the commit: `git grep -n -F "$HOME" HEAD -- widgt/review/runs; echo "exit=$?"` must exit 1. If it exits 0, **stop**: history cannot be rewritten, and Dan must decide.
   The guard reinstalls `node_modules`. Nothing else may run while it does.
6. **Report (D6)**: print the new scoreboard row from `widgt/review/runs/scoreboard.md` and the top three failures from `widgt/review/runs/iter-NN/report.md`. Exit 75 → next iteration. Exit 0 → §7.5.

### 7.4 Stop and ask Dan if
- the total drops by 5 or more points, or a gate fails in two iterations in a row;
- the allow-list check catches anything;
- the loop exits 2;
- a generator reports that the contract seems impossible to meet. Never change the contract to suit the code.

### 7.5 After the loop
0. The loop saves `widgt/review/runs/loop-state.json` once more after its last commit. Commit it on its own: `chore(widgt/review): record the last loop commit in the loop state`. `git status --porcelain` must then print nothing.
1. In the background, from `widgt/`: `npm run test:e2e; echo "exit=$?"`. **The exit criterion is 58/58 passing.** A loop that stopped on a plateau below 90 is acceptable only if the reason is explained.
2. **Finishing pass.** Any contract test still failing is fixed by an implementer subagent, **one failure group at a time**, with normal commits:
   - If jsdom can check the behaviour: `test(widgt): AC-x.y ... (red)` then `fix(widgt): ...`.
   - If only the contract can: `fix(widgt): AC-x.y <what>`, with the failing contract test named in the body.
   - Re-run `test:e2e` after each group.
3. **Quality pass.** A reviewer subagent reads `src/components/**` against spec 02 AC-7, ADR 0001 and `guide-widgt.md` §6: small components, typed props, no arithmetic beyond formatting, and one folder per component with its CSS Module and tests. An implementer makes the confirmed fixes as small `refactor(widgt): ...` / `test(widgt): ...` commits. G6 means the unit test count must not drop.
4. **Exit checks** (show their real output and exit codes):
   - `npm run verify` exits 0
   - `npm run test:e2e` exits 0 with 58 passing
   - `git ls-files 'widgt/review/runs/*results.json'` prints nothing
5. Reviewer subagent on `main...HEAD`; fix the confirmed findings; D9 if Dan wants it. Update `docs/AI-USAGE.md` and the private notes.
6. **H3.** Merge after approval.

---

## 8. Phase 4: documentation (`docs/final` from `main`, after H3)

Doc writers can run in parallel, **one per file group**. None of them may touch `widgt/review/contract/README.md`: it is locked.

| WP | Files | Content |
|---|---|---|
| 4.1 | `README.md` (root) | Overview of both parts, quick start for each (the exact commands), links to specs, ADRs and plans, a short "How AI was used" section linking `docs/AI-USAGE.md`. Remove "Work in progress". |
| 4.2 | `widgt/README.md` | Setup and every script in `package.json` (`dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`, `review`, `loop`, `verify`); the component tree; styling (ADR 0001); why Poppins is self-hosted (A-W9); accessibility notes; the interaction assumption (A-W1); the loop (link spec 03 and `review/README.md`); two screenshots copied from the last `review/runs/iter-NN/screenshots/` into `widgt/docs/screenshots/` and linked from the README. Remove "Work in progress". |
| 4.3 | `docs/decisions/0004-self-reviewing-loop.md` | Why the generator and the evaluator are separate; the gates and weights (`review/src/score.ts`: contract 25, unit 15, a11y 20, responsive 15, visual 10, judge 15); the anti-gaming measures and the honour-based limits of external mode; how the history fits TDD (`loop(iter-NN)` commits are acceptance-level TDD against the 58 locked tests); what to distrust. Format: as ADR 0001. |
| 4.4 | `docs/AI-USAGE.md` | Rows for Phases 0 (close-out), 1, 3 and 4, naming **GLM via Claude Code** where GLM did the work; the "How to spot" section per D3. The "where I intervened" bullets come from the private notes: summarise them, never copy private text. The table's blank line is already fixed. |
| 4.5 | Stale facts | `widgt/review/README.md:118` says `acceptEdits`; the code uses `dontAsk`. `prompts/claude-code-plan.md`: the test counts (109/201), the separation-check command, and the resume command without the guard; add a note at its top that this master plan supersedes its phase steps. ADR 0001 if the tokens ended up in a CSS Module rather than `src/styles/tokens.css`. |

**Exit**
- `git ls-files docs/notes/private` prints nothing.
- `git grep -n -F "$HOME"; echo "exit=$?"` exits 1 (no matches).
- A reviewer subagent has read every changed doc against the code. Each command in the READMEs has been run once, with its exit code recorded, **except** `npm run review:lock`, `npm run loop`, `npm run test:watch` and any `gh` or push command. `dev` and `preview` run in the background and are stopped afterwards.
- **H4.**

---

## 9. Phase 2 (optional, only if Dan says yes at H4)

Follow `guide-jobtitlr.md` §9. Write spec 04 first and **stop (H5)**. Write `golden.csv` and **stop (H5)** before committing it. Then TDD, PIT, and ADR 0003. Branch `feat/jobtitlr-standardiser` from `main`. It must not change `new Normaliser().normalise(...)` (A-J6).

---

## 10. Phase 5: final verification (`chore/final-verification` from `main`)

1. Spawn a **verifier subagent** that has seen none of the work. It:
   - runs `git clone` of the local repository into the session scratchpad and follows **only the READMEs**:
     - in `jobtitlr/`: `./mvnw -q verify` and `./mvnw -q compile exec:java`
     - in `widgt/`: `npm ci`, `npx playwright install chromium`, `npm run verify` and `npm run test:e2e`, one at a time
     - `npm run dev` in the background, `curl -s -o /dev/null -w '%{http_code}'` on its URL (200 expected), then stop it
   - writes `docs/TESTING.md`:
     - a traceability table: brief item → spec AC → test(s). Prefix the IDs with their spec (`01/AC-1.1`, `02/AC-1.1`): both specs use the same numbers
     - test counts and sample output **generated in this run**, for both parts
   - checks the history:
     - the red/green pairs exist
     - `git log --all --oneline -- docs/notes/private` prints nothing
     - there are no secrets (`git grep -niE '(api[_-]?key|token|secret)[[:space:]]*[:=]'` and a manual read of the hits)
     - every commit message makes sense
   - reports its findings. **It fixes nothing.**
2. Copy `docs/TESTING.md` from the clone into the main checkout on `chore/final-verification`, then commit it (`docs: ...`). Fix only the findings Dan picks.
3. **H6.** On approval: merge, then `git tag -a v1.0.0 -m "Feefo technical assessment submission"`. Give Dan this command and **do not run it**:
   ```sh
   gh repo create <name> --public --source . --push --tags
   ```

---

## 11. Known risks

- **GLM reviewing GLM.** The reviewer is a fresh context, but the same model. That is why D9 is offered.
- **The generator cannot run Playwright** (it is not on its allow list, and external mode follows the same rule). It builds from `guide-widgt.md` blind, and the loop's review is its only feedback. That is why the guide is so specific.
- **External mode relies on honesty.** The allow-list check, the guard and G4 catch writes outside the scope. Nothing catches the generator *reading* `review/**`, and the contract can be read anyway.
- **Visual numbers are only comparable on this machine** (the same Chromium build and fonts).
- **Network.** Phase 1 downloads Maven plugins, the guard runs `npm ci`, and Z.ai must be reachable. If the sandbox blocks a download, stop and ask; do not change versions to work around it.
- **Context limits.** GLM's context window is smaller than Claude's. Delegate each work package, and keep the progress log current, so a new session can resume.
