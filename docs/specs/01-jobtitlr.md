# Spec 01: jobtitlr - job title normaliser

| | |
|---|---|
| Status | **Accepted** |
| Project | `jobtitlr/` |
| Language | Java 21, Maven, JUnit 5 |
| Package | `dev.jobtitlr` |

## 1. Problem

Job titles arrive as free text ("Java engineer", "Chief Accountant", "acountant"). We need to map each one to the closest title from a fixed list of normalised titles, so downstream systems work with a small, consistent vocabulary.

Default normalised titles (from the brief):

- Architect
- Software engineer
- Quantity surveyor
- Accountant

## 2. Scope

**In scope**

- A `Normaliser` class that returns the best-matching normalised title for an input string.
- An internal quality score `q`, where `0.0 <= q <= 1.0`, used to rank candidates.
- Tolerance for case, whitespace, punctuation, small typos and plurals.
- Defensive validation of inputs and configuration.
- A runnable demo reproducing the brief's sample code.

**Out of scope** (see section 8)

- Synonyms and semantic matching ("developer" -> "engineer").
- Seniority extraction ("Chief", "Senior") as structured data.
- Persistence, HTTP APIs, very large title lists.

## 3. Public API

```java
// Defaults: the four titles above, token-based scorer, minimum quality 0.2
Normaliser n = new Normaliser();

// Constants on Normaliser
public static final List<String> DEFAULT_TITLES;      // the four titles above
public static final double DEFAULT_MINIMUM_QUALITY;   // 0.2

// Custom configuration
Normaliser n = new Normaliser(List.of("Architect", "Accountant"));
Normaliser n = new Normaliser(titles, scorer, minimumQuality);

String normalise(String jobTitle);                   // the brief's API
Optional<MatchResult> bestMatch(String jobTitle);    // exposes q, and "no match"
List<String> normalisedTitles();                     // unmodifiable

record MatchResult(String title, double quality) {}

@FunctionalInterface
interface SimilarityScorer {
    double score(String input, String candidate);    // must return 0.0..1.0
}

// The default scorer (section 4): token Dice with per-token Levenshtein
class TokenDiceScorer implements SimilarityScorer {
    public TokenDiceScorer()                         // token threshold 0.8
    public TokenDiceScorer(double tokenThreshold)    // within [0, 1], not NaN, else IllegalArgumentException
}
```

Trimming means `String.strip()`. Configured titles are stored exactly as given; the duplicate check compares them stripped and lowercased (`Locale.ROOT`).

Usage from the brief must compile and work unchanged:

```java
Normaliser n = new Normaliser();
String normalisedTitle = n.normalise("Java engineer"); // "Software engineer"
```

## 4. Matching algorithm

1. **Tokenise** both strings: trim, lowercase (`Locale.ROOT`), replace every character that is not a letter, digit, `#` or `+` with a space, split on whitespace. So `"C# Engineer"` -> `[c#, engineer]` and `"Software-engineer"` -> `[software, engineer]`.
2. **Token similarity** = normalised Levenshtein: `1 - distance(a, b) / max(len(a), len(b))`. Two tokens count as matching only if similarity `>= 0.8`. This tolerates one typo in a typical word (`acountant` vs `accountant` = 0.9) but not in very short tokens (`c#` vs `c+` = 0.5).
3. **Pair tokens one-to-one**: take all matching pairs, sort by similarity (highest first), and assign greedily so that each token is used at most once.
4. **Quality score** (Sørensen-Dice over tokens, weighted by similarity):

   ```
   q = 2 * sum(similarity of matched pairs) / (inputTokenCount + candidateTokenCount)
   ```

   Always within `[0, 1]`. It is symmetric and penalises both missing words and extra words. If either string has no tokens, q = 0.0.
5. **Select**: score every normalised title. The highest `q` wins. On a tie, the title listed first wins (deterministic).
6. **Threshold**: a match is accepted only if `q > 0` and `q >= minimumQuality` (default `0.2`).

### Worked examples (default titles)

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

## 5. Acceptance criteria

### AC-1 Examples from the brief

- **AC-1.1** Given default titles, when normalising `"Java engineer"`, then the result is `"Software engineer"`.
- **AC-1.2** `"C# engineer"` -> `"Software engineer"`.
- **AC-1.3** `"Accountant"` -> `"Accountant"`.
- **AC-1.4** `"Chief Accountant"` -> `"Accountant"`.
- **AC-1.5** The brief's sample code (no-arg constructor, `normalise(String)` returning `String`) compiles and runs unchanged. The `Demo` class prints the four examples of AC-1.1 to AC-1.4.

### AC-2 Input handling

- **AC-2.1** Matching ignores case: `"JAVA ENGINEER"` -> `"Software engineer"`.
- **AC-2.2** Leading, trailing and repeated whitespace is ignored: `"  java   engineer "` -> `"Software engineer"`.
- **AC-2.3** Punctuation separates words: `"Software-engineer"`, `"Accountant (ACCA)"` match as expected.
- **AC-2.4** `#` and `+` are kept inside tokens, so `"C#"` and `"C++"` are single tokens.
- **AC-2.5** The returned title uses the exact form it was configured with (for example `"Software engineer"`, not `"software engineer"`).

### AC-3 Typo and plural tolerance

- **AC-3.1** `"Acountant"` -> `"Accountant"`.
- **AC-3.2** `"Software enginer"` -> `"Software engineer"`.
- **AC-3.3** `"Quantity surveyors"` -> `"Quantity surveyor"`.
- **AC-3.4** Tokens with similarity below 0.8 do not count as matching (for example `"c#"` vs `"c+"`). The threshold is configurable with `new TokenDiceScorer(double)`; a value outside [0, 1] or NaN throws `IllegalArgumentException`.
- **AC-3.5** Token similarity is normalised Levenshtein, 1 - distance / max(length): "kitten" vs "sitting" has distance 3 and similarity 4/7.

### AC-4 Quality score

- **AC-4.1** For any pair of non-blank strings, the default scorer returns `0.0 <= q <= 1.0`.
- **AC-4.2** Identical titles (after tokenising) score `1.0`.
- **AC-4.3** Titles sharing no matching tokens score `0.0`.
- **AC-4.4** The score is symmetric: `score(a, b) == score(b, a)`.
- **AC-4.5** `bestMatch` exposes `q` through `MatchResult.quality()`.
- **AC-4.6** Tokens are paired one-to-one, best pairs first: "enginer engineer" vs "engineer" scores 2/3, and "engineer engineer" vs "engineer" scores 2/3, never above 1.

### AC-5 Selection

- **AC-5.1** The title with the highest `q` is returned.
- **AC-5.2** On equal `q`, the title listed first wins. Given titles `["Software engineer", "Hardware engineer"]`, `"Engineer"` -> `"Software engineer"`.
- **AC-5.3** Results are deterministic: the same input and configuration always give the same output.

### AC-6 No match *(see open question O-1)*

- **AC-6.1** Given an input with no title scoring at or above the threshold (for example `"Chef"`), `bestMatch` returns `Optional.empty()`.
- **AC-6.2** In the same case, `normalise` returns the trimmed input unchanged (`"Chef"`).

### AC-7 Invalid input

- **AC-7.1** `normalise(null)` and `bestMatch(null)` throw `NullPointerException` with a descriptive message.
- **AC-7.2** A blank input (`""`, `"   "`) throws `IllegalArgumentException`.
- **AC-7.3** An input made only of punctuation (`"!!!"`), which produces no tokens, returns no match rather than throwing.

### AC-8 Configuration validation

- **AC-8.1** A null title list or null scorer throws `NullPointerException`.
- **AC-8.2** An empty title list throws `IllegalArgumentException`.
- **AC-8.3** A null element throws `NullPointerException`. A blank element throws `IllegalArgumentException`.
- **AC-8.4** Duplicate titles (case-insensitive, after trimming) throw `IllegalArgumentException`.
- **AC-8.5** `minimumQuality` outside `[0, 1]`, or NaN, throws `IllegalArgumentException`.
- **AC-8.6** The title list is copied on construction. Changing the caller's list afterwards has no effect, and `normalisedTitles()` cannot be modified.
- **AC-8.7** If a custom scorer returns a value outside `[0, 1]` or NaN, `Normaliser` throws `IllegalStateException` instead of producing a wrong result.

### AC-9 Extensibility

- **AC-9.1** A custom `SimilarityScorer` can be supplied without changing `Normaliser` (verified with a stub scorer in tests).
- **AC-9.2** `MatchResult` rejects a blank title, or a quality outside `[0, 1]`.

## 6. Non-functional requirements

- **NFR-1** No runtime dependencies. Test dependencies: JUnit 5 only.
- **NFR-2** `Normaliser` is immutable and therefore safe to share between threads.
- **NFR-3** Runnable with `./mvnw test` and `./mvnw -q compile exec:java` (Maven wrapper, no global Maven needed).
- **NFR-4** Every acceptance criterion is covered by at least one test that references its ID.

## 7. Open questions

- **O-1 No-match behaviour of `normalise`.** Options:
  - (a) return the trimmed input unchanged (proposed: no data is lost, and `bestMatch` still reports that there was no match);
  - (b) return `null` (rejected: the caller can easily forget to check it);
  - (c) throw a `NoMatchException` (strict, but makes the brief's simple sample code fragile).
- **O-2 Default minimum quality.** `0.2` is proposed. It accepts one matching word in a fairly long input ("Head of the finance accountant team" -> q = 0.29) while rejecting weak matches. It can be configured.
- **O-3 Token-match threshold.** `0.8` is proposed. It allows about one typo per 5 characters.

## 8. Future work (not built)

- **Synonyms:** a configurable map (`developer -> engineer`, `programmer -> engineer`).
- **Semantic scorer:** an embedding-based `SimilarityScorer` that plugs into the same interface. Left out because it adds network access and API keys to a take-home that should run offline.
- **Stop words and seniority:** strip "senior", "chief", "head of" before scoring, or return them as structured data.
- **Scale:** with large title lists, pre-tokenise titles once and use an inverted index, instead of scoring every title (currently O(titles x tokens^2 x token length) per call).
