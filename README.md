# Feefo technical assessment

This repository holds both parts of the Feefo Software Engineering (Full-stack) technical assessment. The two parts are independent: separate folders, builds and test suites, with nothing shared between them.

| Part | Folder | Stack |
|---|---|---|
| 1. Standardising job titles | [`jobtitlr/`](jobtitlr/) | Java 21, Maven, JUnit 5 |
| 2. Product rating widget | [`widgt/`](widgt/) | React 19, TypeScript, Vite, CSS Modules, Vitest, Testing Library, Playwright |

**Part 1, `jobtitlr`.** A small Java library that matches a free-text job title (`Java engineer`, `Chief Accountant`) to the closest entry in a list of normalised titles. Matching ignores case, punctuation and extra whitespace, and tolerates typos and plurals token by token. The title list, similarity scorer and acceptance threshold are all configurable; the library has no runtime dependencies. See [`jobtitlr/README.md`](jobtitlr/README.md) for the design and algorithm.

**Part 2, `widgt`.** A product rating summary widget built to a reference design: star rating with partial fill, score, brand line and a ratings breakdown. It was developed through a self-reviewing loop in which an independent harness holds 58 locked Playwright contract tests and scores every iteration against the brief's criteria; the submitted widget passes all 58 and scores 95.8/100. See [`widgt/README.md`](widgt/README.md) for the components, styling and scripts.

## Quick start

### Part 1: jobtitlr

A JDK 21 or newer is required (`maven.compiler.release` is 21). The Maven wrapper downloads everything else, so there is no separate Maven installation. On Windows, run `mvnw.cmd` instead of `./mvnw`.

```sh
cd jobtitlr
./mvnw verify                 # compiles and runs the 111 JUnit tests
./mvnw -q compile exec:java   # demo: prints the brief's four example mappings
```

### Part 2: widgt

Node 22 or newer is required (`engines` in `widgt/package.json`). Use `npm ci`; the lockfile is committed. The one-time Playwright command installs the Chromium the browser-based checks drive.

```sh
cd widgt
npm ci
npx playwright install chromium  # once, for the review and contract tests
npm run dev                      # Vite dev server with the demo page
npm test                         # 473 unit and component tests across 39 files
npm run verify                   # typecheck, lint, tests and the strict review
npm run test:e2e                 # the 58 locked contract tests
```

Of the 473 tests, 173 cover the widget itself (domain logic and components); the other 300 cover the review harness.

## Documentation

The deliverables are `jobtitlr/` and `widgt/src/`. The folders `docs/plans/`, `docs/research/`, `prompts/` and `widgt/review/` record the process that built them and can be skipped on a first read.

Comments and test names cite IDs from the documents below: `B1.x`/`B2.x` are brief items, `AC-x.y` and `NFR-x` are acceptance criteria and non-functional requirements in the specs, and `A-Jx`/`A-Wx` are assumptions.

- [`docs/brief/`](docs/brief/) — the assessment brief, summarised from Feefo's PDF (not redistributed here) with item IDs (`B1.x`, `B2.x`) so specs and tests can cite it.
- Specs: [`01-jobtitlr.md`](docs/specs/01-jobtitlr.md) (public API, algorithm and acceptance criteria for the normaliser), [`02-widgt.md`](docs/specs/02-widgt.md) (the widget) and [`03-review-loop.md`](docs/specs/03-review-loop.md) (the self-reviewing loop that built it).
- Decisions: [`docs/decisions/`](docs/decisions/) — ADR 0001 (widgt styling approach), ADR 0002 (jobtitlr matching algorithm) and ADR 0004 (the self-reviewing loop). Number 0003 was reserved for the optional job-title standardiser extension, which was not built.
- Plans: [`docs/plans/`](docs/plans/) — the master plan and the per-phase plans and guides the work followed.
- Assumptions: [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) — the recorded decisions behind default behaviour where the brief was silent.
- Verification: [`docs/TESTING.md`](docs/TESTING.md) — a final fresh-clone run of every command, with the brief-to-test traceability.

## How AI was used

The code was written test-first by AI agents — Claude for the early phases, then GLM (Z.ai) via Claude Code — working to the written plans above, with every loop iteration committed alongside its score. The problem framing, specs, decisions and the final review were Dan's; [`docs/AI-USAGE.md`](docs/AI-USAGE.md) holds the full task-by-task table and notes where the human intervened.
