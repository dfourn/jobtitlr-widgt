# Claude Code plan: finish the Feefo assessment

> **Superseded:** [`docs/plans/master-plan.md`](../docs/plans/master-plan.md) now supersedes this file's phase steps. The **Rules** section below still applies as written.

> Run from the repository root: `claude "Read prompts/claude-code-plan.md and follow it. Start with Phase 0."`
> This file is committed on purpose so that AI use stays transparent. Earlier AI sessions are summarised in `docs/AI-USAGE.md`.

**Phase order:** 0 → 1 → 3 → 4 → 2 (if there is time) → 5.
The UI (Phase 3) is required by the brief. The Java extension (Phase 2) is a bonus.

---

## How we work: plan, then implement

I (Dan) work with AI in a **plan -> implement** pattern. Every phase follows these steps:

1. **Plan.** Use read-only `Explore` / `Plan` subagents to research. **You (the main agent) write** the plan to `docs/plans/<phase>.md`: steps, files, tests to write first, risks, and questions (questions at the top). Plans are committed (`docs(plans): ...`). Keep anything private out of them.
2. **Checkpoint.** **Stop and show me the plan.** Do not implement anything until I approve or amend it.
3. **Implement** test-first, in small red → green → refactor commits (see the rules below). Use implementer subagents, **one at a time, in the main checkout**. Only parallelise work that cannot collide (for example, docs and code). If you use worktrees, each needs its own `npm ci`, and e2e runs must never run in parallel (port 4173 is fixed).
4. **Review.** A separate **reviewer subagent**, which wrote none of the code, adversarially checks the diff against the spec, its acceptance criteria and these rules. It reports findings with file:line. Fix the confirmed ones.
5. **Verify.** Run the exit checks yourself and show me their real output and exit codes.
6. **Notes.** Update `docs/AI-USAGE.md` (public) and `docs/notes/private/working-notes.md` (git-ignored, **never commit it**). Record what happened, the decisions, any surprises, and where I intervened.
7. **Merge.** After I approve, merge the phase branch into `main` with `git merge --no-ff`. **Every phase branches from the current `main`.**

---

## Context

- **Brief**: `docs/brief/README.md`, with numbered requirements B1.x (Java) and B2.x (UI), plus the PDF and the reference PNG.
- **Specs**: `docs/specs/01-jobtitlr.md`, `02-widgt.md` (the widget) and `03-review-loop.md` (the self-reviewing loop).
- **Assumptions**: `docs/ASSUMPTIONS.md`. *In a real team I'd confirm these with product. For the assessment I made the sensible call, documented it, and kept it cheap to change.*
- **ADRs** are in `docs/decisions/`. **Research** is in `docs/research/`.
- **What gets marked.**
  - Java: structure, OOP, defensive coding, unit testing (B1.7).
  - UI: *how I approached it*, not pixels. Component design, TS modelling, responsiveness, accessibility, tests and maintainability (B2.17).
  - Optimise for these, and for code I can explain line by line.

**Current state at the time of writing.** Branch `feat/widgt` has not been merged into `main` yet. `main` has only docs.
- `widgt/src/domain/` is done: pure rating logic built with TDD, including seeded fast-check properties; `npm test` now runs 472 vitest tests across 39 files over `src/` and `review/src/` together.
- `widgt/review/contract/` holds **58 Playwright contract tests that are red on purpose**: no components exist yet.
  - They are **locked**: gate G4 checks them against checksums in `review/contract.lock`.
  - **Never edit** `review/contract/**`, `review/reference/**`, `review/rubric.json`, `review/playwright.config.ts` or `review/src/**` without my explicit approval.
  - If they must change, I run `npm run review:lock` and commit it with a reason.
- `widgt/review/src/` is the harness: gates G1–G6, the score, the report, the scoreboard, `index.html`, and the claude/glm/external generators. Its tests are part of the 472 above. Read `widgt/review/README.md`.
- `jobtitlr/` is empty.

---

## Rules (every phase)

**Git.** The history is part of the submission.
- Conventional Commits, in the imperative mood.
- Types: `feat`, `fix`, `test`, `refactor`, `docs`, `build`, `chore`, plus `loop(iter-NN)` (loop iterations only) and `merge:`.
- Scopes: `jobtitlr`, `widgt`, `widgt/review`, `docs`. The body says *why* when that isn't obvious.
- TDD rhythm, one behaviour per cycle:
  1. `test(<scope>): AC-x.y <behaviour> (red)`. Run the test and confirm it fails **for the right reason** (an assertion, not a typo).
  2. `feat(<scope>): ...`, once it is green.
  3. Optional `refactor(<scope>): ...`, still green.
- Commit only what really happened. Mistakes get fixed in a new commit that says so.
- **Never amend, rebase, force-push or backdate.**
- Keep Claude Code's `Co-Authored-By: Claude ...` trailer. It is part of being open about AI use.
- **Never judge pass/fail through `| grep`, `| tail` or `| head`.** Pipes hide the exit code. Check the exit code itself. (This has already bitten us once.)

**Code.**
- **Java 21**:
  - records for value types; defensive copies; fail fast with clear messages
  - strategy interfaces; composition over inheritance; sealed types for variant results
  - Javadoc on the public API; no runtime dependencies
  - **test dependencies: JUnit 5 only** (spec 01 NFR-1)
- **TypeScript**: strict. No `any`, `!`, `@ts-ignore`, `eslint-disable`, `.skip` or `.only` (gate G5).
- Test names start with the acceptance-criterion ID they *really* check, e.g. `AC-1.4 Chief Accountant -> Accountant`. **Never cite an AC ID only to raise coverage.**
- British English in prose.

---

## Phase 0: Environment and decisions → branch `chore/phase-0`

1. **Toolchain** (no code changes):
   - `java -version` must be 21. If it isn't: `sdk install java 21-tem && sdk use java 21-tem`.
   - `node -v` must be 22 or newer.
   - In `widgt/`: `npm ci`, then `npx playwright install chromium` (Playwright is pinned at 1.56.0).
2. **Baseline** (`git checkout feat/widgt`):
   - `npm run typecheck`, `npm run lint` and `npm test` must all exit 0.
   - `npm run review` should show every gate passing and contract results red.
   - **Show me the summary.**
3. **Decisions.** Bring me these as one list, each with your recommendation:
   1. `labelFor` takes the **rounded** score, so the label always matches the number shown. Update spec 02 §3. *(Rec: yes)*
   2. Unknown keys in the counts input (e.g. `{0: 3}`): ignore them and document it, **or** throw a `RangeError`. *Do not* warn via `import.meta.env`, because that would tie `src/domain` to Vite. *(Rec: throw. Fail fast, consistent with `validateCounts`.)*
   3. An ESLint `no-restricted-imports` rule so `src/domain/**` cannot import React or `react-dom`. *(Rec: yes)*
   4. The contract tests write `review/runs/latest/axe.json`, so the accessibility signal uses real violation counts. *(Rec: yes; needs a relock)*
   5. Extend G4's lock to `eslint.config.js`, `tsconfig*.json` and `vite.config.ts`. *(Rec: yes; needs a relock)*
   6. Set Playwright's `expect` timeout to 2s, so a fully red run doesn't take about 6 minutes. *(Rec: yes; same relock as 4)*
   7. Mark specs 01, 02 and 03 as **Accepted**, with any edits I ask for.
4. **Apply my answers**, using TDD for decisions 2 and 3. For the locked files (4–6), make the edit, then **stop**: I run `npm run review:lock` and commit the lock myself.
5. **Merge** `feat/widgt` into `main` (`--no-ff`). Add `.claude/worktrees/` to `.gitignore`.

**Exit**:
- The decisions are recorded in the private notes.
- `npm run verify` exits 0.
- `main` contains the widget foundations.

---

## Phase 1: jobtitlr core (spec 01) → branch `feat/jobtitlr-core`

**Plan first.** Then:

1. **Scaffold `jobtitlr/`**:
   - Maven, using the **Maven wrapper** (commit `mvnw` with mode 100755 and check it with `git ls-files -s jobtitlr/mvnw`).
   - Java 21, package `dev.jobtitlr`, JUnit 5 only.
   - Surefire, plus `exec-maven-plugin` for a `Demo` class that runs the brief's sample code exactly as written.
   - Commit as `chore(jobtitlr): scaffold ...`.
2. **Implement spec 01 test-first**, one AC group at a time (AC-1 … AC-9), in about 10–15 red/green cycles.
   - **Public**: `Normaliser` (final, immutable), `MatchResult` (a self-validating record), `SimilarityScorer` (a functional interface) and `TokenDiceScorer`.
   - **Package-private**: `Tokeniser` and `Levenshtein`.
   - Each class has a single responsibility.
3. **Tests**: `@DisplayName` starting with the AC ID; `@ParameterizedTest` for tables of examples; spec 01 §4's worked-examples table checked exactly, with a tolerance.
4. **`jobtitlr/README.md`** covers:
   - how to run it: `./mvnw test`, `./mvnw -q compile exec:java`, and importing it into IntelliJ or Eclipse as a Maven project
   - the design and the algorithm, with the worked examples
   - **testing evidence** (B1.6): what is tested and why, the test count, and a sample of the output
5. **ADR `docs/decisions/0002-jobtitlr-matching-algorithm.md`**: compares Levenshtein, Jaro-Winkler, TF-IDF, embeddings and token-Dice.
6. **Fix spec 01 NFR-3** to say `./mvnw -q compile exec:java`.

**Exit**:
- From a clean clone, `./mvnw -q verify` and `./mvnw -q compile exec:java` both pass, and the demo prints the brief's three outputs.
- The reviewer's findings are fixed.
- I approve, and the branch is merged.

---

## Phase 3: widget components via the self-reviewing loop → branch `feat/widgt-components`

**Plan first**: the iteration budget, and what I will see after each iteration.

**How loop history fits the TDD story.** During the loop, the unit of history is one `loop(iter-NN): score A -> B` commit per iteration. The red tests at this stage are the 58 locked contract tests, so this is TDD at the acceptance level. The loop commits; **the generator never does**. The normal red/green rhythm comes back in step 4. ADR 0004 (Phase 4) explains all of this.

1. **Start clean.** `git status --porcelain` must print nothing.
2. **Run** `cd widgt && npm run loop -- --generator external --max-iter 8 --target 90`.
   - The first run makes a baseline review, commits `loop(iter-00)`, writes `review/runs/iter-01/prompt.md`, and **exits with code 75**.
   - **Exit 75 means "handoff", and is expected.** Exit 2 means an error.
3. **Each iteration:**
   1. **You** read `prompt.md` and paste its text into the brief for a **fresh generator subagent**. The generator never opens `review/**`.
   2. The brief also contains:
      - these rules
      - the demo-page contract from spec 02 §8
      - its scope: `src/components/**`, `src/App.tsx`, and component tests in `src/**`, using Testing Library and user-event (AC-4.6, controlled mode, is included)
      - the commands it may run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. It must not run `git` or edit any config file.
   3. **Separation check.** After the generator finishes, this must print nothing:
      `git status --porcelain -- review ':!review/runs' package.json package-lock.json eslint.config.js 'tsconfig*.json' vite.config.ts`
      Then `node review/src/guard.ts --check-only` must exit 0. If either fails, revert those changes and tell me.
   4. **Resume** with `node review/src/guard.ts && npm run loop -- --generator external --resume --note "<one line: what changed>"`; never resume without the guard. That runs the review, appends a row to the scoreboard, updates `index.html`, and commits. It then either exits 75 again (next iteration) or 0 (stopped).
   5. **After each iteration, show me the scoreboard row and the top three failures.**
4. **Stop conditions:**
   - the score is ≥ 90 with all gates passing; or
   - a plateau, or the maximum number of iterations is reached. A plateau below 90 is acceptable if it is explained: some ACs, such as layout and visuals, cannot be honestly checked in jsdom, which limits the unit-test signal.
5. **Quality pass, done by people.** A reviewer subagent reads `src/components/**` against spec 02 AC-7 and ADR 0001, then makes small `refactor(widgt): ...` / `test(widgt): ...` commits using the normal TDD rhythm.
   - Components stay small, have typed props, and contain no arithmetic beyond formatting.
6. **Optional, only if I ask:** a comparison run with `--generator claude` (or `glm`, using `GLM_API_KEY` and `GLM_BASE_URL`).
   - Branch it from the commit **before** `loop(iter-00)`. Otherwise the loop refuses to run, because `loop-state.json` already exists.
   - Never merge it.

**Exit**:
- `npm run verify` exits 0.
- **`npm run test:e2e` exits 0 with all 58 passing.** `verify` alone does not fail on red contract tests.
- I approve, and the branch is merged.

---

## Phase 4: documentation → branch `docs/final`

- **Root `README.md`**: an overview of both parts, quick start, links, and a short "How AI was used" section linking `docs/AI-USAGE.md`.
- **`widgt/README.md`**:
  - setup and scripts
  - the component tree
  - styling (ADR 0001)
  - why Poppins is self-hosted from npm rather than loaded from the Google Fonts CDN (A-W9)
  - accessibility notes
  - the interaction assumption (A-W1)
  - the loop (spec 03 and `review/README.md`)
  - screenshots taken from `review/runs/`
- **ADR `0004-self-reviewing-loop.md`**:
  - why the generator and the evaluator are separate
  - the gates and the weights
  - the anti-gaming measures, and the honour-based limits of the external mode
  - how the history fits TDD
  - what I'd distrust
- **`docs/AI-USAGE.md`**:
  - complete the table (and fix the blank line that currently splits it)
  - add "where I intervened / what I'd distrust", with concrete examples taken from the private notes
- **Run artefacts**: make sure files archived under `review/runs/iter-*` don't contain absolute home-directory paths. Strip or relativise them, or exclude the raw JSON from git.
- **Check**: `git ls-files docs/notes/private` prints nothing.

**Exit**: I approve, and the branch is merged.

---

## Phase 2 (optional, after Phase 4): jobtitlr standardisation → branch `feat/jobtitlr-standardiser`

Keep this **small, and OOP first**. It must not grow into a pile of heuristics, and it must not change `new Normaliser().normalise(...)` (A-J6).

1. **Write spec `docs/specs/04-jobtitlr-standardiser.md` first, then stop for my review.** It is based on `docs/research/title-standardisation.md`. Scope:
   - **`TitleParser`** returns `ParsedTitle(core, Seniority, Set<String> specialisms)`. "Chief Accountant" becomes Accountant + CHIEF; stripped words are kept, not thrown away. It has a seniority lexicon, "head of X", and a **protected-phrase list** ("chief executive" and "head chef" are titles in their own right).
   - **`Lexicon`**: synonyms and abbreviations, loaded from a resource file and matched longest-first (developer and programmer become engineer, qs becomes quantity surveyor, sr becomes senior).
   - **`TitleStandardiser`** composes a parser, a lexicon and a `Normaliser`. It returns a **sealed** `StandardisationResult`: `Matched | Ambiguous | NoMatch`.
   - **`TitleClusterer`** (new categories from data, which I want):
     - leader clustering on the *core*, comparing against each cluster's medoid
     - input sorted first, so the result doesn't depend on input order
     - a cluster becomes *provisional* at `minSupport` = 3
     - the name is the most frequent core
     - it needs an explicit `accept()`
     - `ClusterNamer` interface, with `FrequencyNamer` as the default
   - **No occupation codes.** Codes generated by an AI could be wrong. Cite SOC 2020 and ESCO in the ADR as the model the approach follows, not as data.
2. **Tests, test-first**:
   - **Metamorphic**: case, whitespace and punctuation don't change the result; adding seniority doesn't change the category **(except protected phrases)**; synonym swaps don't change it; results are idempotent; shuffled input gives the same clustering.
   - **Property tests with a fixed seed, written by hand.** Do **not** use jqwik: version 1.10.1 and later prints an "Anti-AI Usage Clause", and this project is openly AI-assisted. Cite that in a comment and in the ADR.
   - **Golden dataset**: about 40 rows in `golden.csv`, **which I check by hand** before it is committed, including negatives.
   - **PIT** (`pitest-maven` + `pitest-junit5-plugin`; check the latest versions first) in `-Pmutation`, with a `mutationThreshold`. It is a build plugin, not a test dependency, so NFR-1 still holds. Say so in spec 04.
3. **ADR `0003-title-standardisation.md`** (standards, pitfalls, governance) and a README section, "Beyond the brief".

**Exit**:
- All tests and PIT are green.
- The reviewer's findings are fixed.
- I approve, and the branch is merged.

---

## Phase 5: final verification

1. Spawn a **verifier subagent that has seen none of the work**. Its job:
   - `git clone` the repo into a temp folder, then follow **only the READMEs**:
     - `./mvnw -q verify` and `./mvnw -q compile exec:java`
     - `npm ci`, `npx playwright install chromium`, `npm run verify` and `npm run test:e2e`
     - start `npm run dev` **in the background**, `curl` the page, then stop it
   - Write **`docs/TESTING.md`**:
     - a traceability table: brief item → spec AC → test(s)
     - **freshly generated** test counts and sample output for both parts. This is the B1.6 evidence, and it replaces any stale numbers in the READMEs.
   - Check the history:
     - TDD red/green pairs are present
     - `git log --all --oneline -- docs/notes/private` prints nothing
     - there are no secrets
     - every commit message makes sense
   - Report its findings to me. I decide what gets fixed.
2. **Human checkpoint**: I open `jobtitlr/` in IntelliJ myself and run the tests there (B1.6: "imported and tested in an IDE").
3. With my approval:
   - tag `v1.0.0`
   - give me the exact commands: `gh repo create <name> --public --source . --push`
   - **Do not push without my explicit go-ahead.**
