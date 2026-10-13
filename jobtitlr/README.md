# jobtitlr

A Java library that matches a free-text job title to the closest title from a configured list of normalised titles.

## 1. What it does

`Normaliser` maps a job title such as `Java engineer` to the closest entry in a list of normalised titles — by default the brief's four: `Architect`, `Software engineer`, `Quantity surveyor` and `Accountant`. The list, the similarity scorer and the minimum quality a match must reach are all configurable through the constructors. `normalise` returns the best-matching normalised title, or the stripped input unchanged when nothing matches well enough; `bestMatch` returns an `Optional<MatchResult>` that also carries the quality score, for callers that need to tell a match from a pass-through. Matching ignores case, punctuation and extra whitespace, tolerates typos and plurals token by token, and is deterministic. The library has no runtime dependencies (spec 01, NFR-1), and a constructed `Normaliser` is immutable and safe to share between threads (NFR-2).

The brief's sample code compiles and runs unchanged:

```java
String jt = "Java engineer";
Normaliser n = new Normaliser();
String normalisedTitle = n.normalise(jt);
```

## 2. How to run

A JDK 21 or newer is required (`maven.compiler.release` is 21). The Maven wrapper downloads everything else; there is no separate Maven installation to set up. Run these commands from this directory (`jobtitlr/`).

Run the tests:

```sh
./mvnw test
```

Run the demo, which prints the brief's four examples using the sample code above:

```sh
./mvnw -q compile exec:java
```

```text
Java engineer -> Software engineer
C# engineer -> Software engineer
Accountant -> Accountant
Chief Accountant -> Accountant
```

On Windows, run `mvnw.cmd` instead of `./mvnw`.

**IntelliJ IDEA**: File → Open → select `jobtitlr/pom.xml` → Open as Project, then set the project SDK to a JDK 21 or newer (File → Project Structure → Project).

**Eclipse**: File → Import → Maven → Existing Maven Projects, and select this directory.

## 3. Design

Six production classes, each with a single responsibility:

| Class | Responsibility |
|---|---|
| `Tokeniser` (package-private) | Splits a title into tokens: lowercases with `Locale.ROOT`, replaces every character that is not a letter, digit, `#` or `+` with a space, and splits on whitespace. |
| `Levenshtein` (package-private) | The Levenshtein edit distance (two-row dynamic programming) and the normalised similarity `1 - distance / max(len(a), len(b))`. |
| `MatchResult` | A record pairing the matched title with its quality. Its compact constructor validates both components. |
| `SimilarityScorer` | The strategy interface: `double score(String input, String candidate)`, returning a value within `[0, 1]`. |
| `TokenDiceScorer` | The default strategy: a Sørensen-Dice score over tokens, weighted by per-token Levenshtein similarity, with a configurable token threshold. |
| `Normaliser` | Holds the configuration (titles, scorer, minimum quality), validates it, scores every title, selects the best and applies the acceptance threshold. |

(`Demo` is the runnable entry point shown in section 2, not part of the library.)

**Why `SimilarityScorer` is a strategy.** `Normaliser` never refers to `TokenDiceScorer` in its logic; it depends only on the `SimilarityScorer` interface, injected through the three-argument constructor. Any implementation — including a lambda, since the interface is a `@FunctionalInterface` — plugs in without changing `Normaliser` (AC-9.1). `Normaliser` guards the value a scorer returns (see the table below), so a scorer that breaks its contract fails fast instead of producing an invalid result.

**Immutability and defensive copies (AC-8.6).** Every `Normaliser` field is `final`. The title list is copied with `List.copyOf` after validation, so changing the caller's list after construction has no effect, and `normalisedTitles()` returns that unmodifiable copy. With no mutable state, one `Normaliser` can be shared between threads (NFR-2).

**Fail-fast validation.** Every public constructor and method checks its arguments before doing any work. The Javadoc on each member states the contract; the cases and messages are:

| Case | Exception | Message |
|---|---|---|
| `jobTitle` null (`normalise`, `bestMatch`) | `NullPointerException` | `jobTitle must not be null` |
| `jobTitle` blank | `IllegalArgumentException` | `jobTitle must not be blank` |
| `titles` null | `NullPointerException` | `titles must not be null` |
| `scorer` null | `NullPointerException` | `scorer must not be null` |
| `titles` empty | `IllegalArgumentException` | `titles must not be empty` |
| a `titles` element null | `NullPointerException` | `titles[<i>] must not be null` |
| a `titles` element blank | `IllegalArgumentException` | `titles[<i>] must not be blank` |
| two titles equal after `strip().toLowerCase(Locale.ROOT)` | `IllegalArgumentException` | `duplicate title: "<title>"` |
| `minimumQuality` outside `[0, 1]` or NaN | `IllegalArgumentException` | `minimumQuality must be within [0, 1]: <value>` |
| `tokenThreshold` outside `[0, 1]` or NaN (`TokenDiceScorer`) | `IllegalArgumentException` | `tokenThreshold must be within [0, 1]: <value>` |
| scorer returns a value outside `[0, 1]` or NaN | `IllegalStateException` | `scorer returned <q> for "<input>" and "<title>"; expected a value within [0, 1]` |
| `MatchResult` title null | `NullPointerException` | `title must not be null` |
| `MatchResult` title blank, or quality outside `[0, 1]` or NaN | `IllegalArgumentException` | `title must not be blank` / `quality must be within [0, 1]: <value>` |

## 4. Algorithm

Given an input and a candidate title:

1. **Tokenise** both strings: `text.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}#+]", " ").strip()`. If the result is empty there are no tokens; otherwise split on whitespace. So `"C# Engineer"` becomes `[c#, engineer]` and `"Software-engineer"` becomes `[software, engineer]`.
2. **Token similarity**: normalised Levenshtein, `1 - distance / max(len(a), len(b))` (two empty strings score 1.0). Two tokens count as matching only when their similarity reaches the token threshold (0.8 by default).
3. **Pair tokens one-to-one, best pairs first**: build every pair whose similarity reaches the threshold, stably sort by similarity descending, then assign greedily so each token is used at most once. The similarities of the assigned pairs are added in that sorted order, so `score(a, b)` and `score(b, a)` add the same doubles in the same sequence and are bit-identical.
4. **Quality score**: `q = 2 * sum(similarity of matched pairs) / (inputTokenCount + candidateTokenCount)`. If either side has no tokens, `q` is 0.0. `q` is always within `[0, 1]`, is symmetric, and penalises both missing and extra words.
5. **Select**: score every configured title in order. The highest `q` wins; the best-so-far is replaced only on a strictly greater `q`, so on a tie the title listed first wins.
6. **Threshold**: a match is accepted only if `q > 0` and `q >= minimumQuality` (0.2 by default). When nothing is accepted, `normalise` returns the stripped input and `bestMatch` returns `Optional.empty()`.
7. **Guard**: `Normaliser` checks the scorer's value before building a `MatchResult`; a value outside `[0, 1]` (or NaN) throws `IllegalStateException` rather than producing an invalid result.

Worked examples with the default titles (spec 01, section 4):

| Input | Tokens | Best title | Calculation | q |
|---|---|---|---|---|
| Java engineer | java, engineer | Software engineer | 2 x 1 / (2 + 2) | 0.50 |
| C# engineer | c#, engineer | Software engineer | 2 x 1 / (2 + 2) | 0.50 |
| Accountant | accountant | Accountant | 2 x 1 / (1 + 1) | 1.00 |
| Chief Accountant | chief, accountant | Accountant | 2 x 1 / (2 + 1) | 0.67 |
| Acountant | acountant | Accountant | 2 x 0.9 / (1 + 1) | 0.90 |
| Software enginer | software, enginer | Software engineer | 2 x (1 + 0.875) / 4 | 0.94 |
| Quantity surveyors | quantity, surveyors | Quantity surveyor | 2 x (1 + 0.889) / 4 | 0.94 |
| Chef | chef | (none) | no token >= 0.8 | 0.00 |

## 5. Testing evidence

`./mvnw test` (run without `-q`, which hides the counts; the exit code is what judges pass or fail) ends with:

```text
Tests run: 110, Failures: 0, Errors: 0, Skipped: 0
```

Each test's `@DisplayName` starts with the acceptance-criterion ID it covers, so a failure names the criterion that broke. What each test class covers, and why it exists:

| Test class | Tests | Covers |
|---|---|---|
| `TokeniserTest` | 9 | AC-2.1 to AC-2.4, AC-7.3. Tokenisation rules: lowercasing with `Locale.ROOT`, whitespace handling, punctuation as separators, `#` and `+` kept inside tokens, and punctuation-only text yielding no tokens. |
| `LevenshteinTest` | 12 | AC-3.5. The distance and similarity values, including the brief's typo examples and symmetry of the two measures. |
| `MatchResultTest` | 10 | AC-9.2. The record's own validation: null and blank titles, quality outside `[0, 1]` or NaN rejected, endpoints 0.0 and 1.0 accepted. |
| `TokenDiceScorerTest` | 21 | AC-3.1 to AC-3.4, AC-4.1 to AC-4.4, AC-4.6. The score itself: the brief's values, identical and disjoint titles, one-to-one pairing, zero-token safety, symmetry and boundedness over seeded random pairs, and the configurable token threshold. |
| `NormaliserSelectionTest` | 10 | AC-4.5, AC-5.1 to AC-5.3, AC-6.1, AC-6.2, AC-9.1. How the best title is chosen: highest `q` wins, first-listed wins a tie, results are repeatable, the no-match rules, and a custom scorer injected without changing `Normaliser`. |
| `NormaliserBriefTest` | 6 | AC-1.1 to AC-1.5, AC-5.2. The brief's four examples and its sample code, compiled and run verbatim. |
| `NormaliserInputTest` | 13 | AC-2.1 to AC-2.3, AC-2.5, AC-3.1 to AC-3.3, AC-7.1 to AC-7.3. Input handling end to end: case, whitespace, punctuation, configured form returned, typo and plural tolerance, and null, blank and punctuation-only inputs. |
| `NormaliserConfigurationTest` | 20 | AC-8.1 to AC-8.7. Configuration validation: null, empty, blank and duplicate title lists, out-of-range `minimumQuality`, defensive copies, and the guard on an out-of-range scorer result. |
| `WorkedExamplesTest` | 8 | AC-4.5, AC-6.1. Every row of spec 01 section 4's worked-examples table, including `Chef` scoring 0.0 against all four default titles. |
| `DemoTest` | 1 | AC-1.5. `Demo` prints exactly the four expected lines. |

Phase 5 of the project plan will collect the final cross-part test numbers in `docs/TESTING.md`.

**What is not tested.** Two known gaps are carried as documentation rather than fixed:

- The Turkish dotted capital I, `İ`: `"İ".toLowerCase(Locale.ROOT)` produces an `i` followed by a combining dot, and the tokeniser treats that combining mark as a separator. This is a known edge case (implementation guide, traps); it is documented here rather than fixed, because the input language is assumed to be English (A-J5).
- The thresholds (token similarity 0.8, overall quality 0.2) were chosen from the brief's examples and spec 01's worked examples, not tuned on a labelled dataset, so their precision and recall are unmeasured (A-J8). Both are configurable.

## 6. Links

- [Spec 01: jobtitlr — job title normaliser](../docs/specs/01-jobtitlr.md) — the public API, algorithm and acceptance criteria.
- [ADR 0002: jobtitlr matching algorithm](../docs/decisions/0002-jobtitlr-matching-algorithm.md) — why token Dice with per-token Levenshtein over the alternatives.
- [Assumptions](../docs/ASSUMPTIONS.md) — the A-J rows record the decisions behind the default behaviour and thresholds.
- [Plans](../docs/plans/) — the process and work packages that produced this code.
