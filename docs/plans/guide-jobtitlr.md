# Implementation guide: jobtitlr (Phases 1 and 2)

Companion to [`master-plan.md`](master-plan.md). It assumes Dan answered **yes** to D4. If he changed any part of D4, the master plan's answers section wins over this guide.

Sources: `docs/brief/README.md` (B1.x), `docs/specs/01-jobtitlr.md`, `docs/ASSUMPTIONS.md` (A-J*), `docs/research/title-standardisation.md`, and `prompts/claude-code-plan.md` Phases 1 and 2. Line numbers are as of commit `eb24100`.

**What gets marked (B1.7):** good project structure, evidence of good OOP principles, defensive coding, and unit testing. Optimise for those, and for code Dan can explain line by line. No cleverness.

---

## 1. Toolchain (checked 2026-10-12)

| Tool | State |
|---|---|
| Java | `openjdk 21` (Temurin 21+35) via SDKMAN, `JAVA_HOME=~/.sdkman/candidates/java/current` |
| Maven | 3.9.16 (Homebrew). The wrapper distribution for 3.9.16 is already in `~/.m2/wrapper/dists/` |
| Network | Maven Central was reachable (HTTP 200) |
| Not cached yet | maven-wrapper-plugin, exec-maven-plugin, JUnit 5.14.x |

If a download fails, **stop and ask Dan**. Do not switch to other versions to make it work.

---

## 2. Spec 01 and ASSUMPTIONS edits (WP 1.1, one commit)

Line numbers are for the unedited file: apply the edits from the bottom of the file upwards.

Commit message: `docs(jobtitlr): settle the spec 01 details that the implementation depends on`. The body lists (a)–(i). **Status stays `Draft - awaiting review`.**

| # | File:line | Change |
|---|---|---|
| a | `01-jobtitlr.md:135` (AC-6.1) | "no title scoring above the threshold" → "no title scoring at or above the threshold" |
| b | `01-jobtitlr.md:74-77` (§4 step 4) | Add: "If either string has no tokens, q = 0.0." |
| c | after `01-jobtitlr.md:125` | New line: `- **AC-4.6** Tokens are paired one-to-one, best pairs first: "enginer engineer" vs "engineer" scores 2/3, and "engineer engineer" vs "engineer" scores 2/3, never above 1.` |
| d | after `01-jobtitlr.md:117` | New line: `- **AC-3.5** Token similarity is normalised Levenshtein, 1 - distance / max(length): "kitten" vs "sitting" has distance 3 and similarity 4/7.` |
| e | §3 Public API (`:37-64`) | Add `public TokenDiceScorer()` (token threshold 0.8) and `public TokenDiceScorer(double tokenThreshold)` (must be within [0, 1], not NaN, otherwise IllegalArgumentException). Add `DEFAULT_TITLES` and `DEFAULT_MINIMUM_QUALITY` constants on `Normaliser`. Append to AC-3.4 (`:117`): "The threshold is configurable with `new TokenDiceScorer(double)`; a value outside [0, 1] or NaN throws `IllegalArgumentException`." |
| f | §3, after the API block | Add: "Trimming means `String.strip()`. Configured titles are stored exactly as given; the duplicate check compares them stripped and lowercased (`Locale.ROOT`)." |
| g | `01-jobtitlr.md` AC-1.5 | Add: "The `Demo` class prints the four examples of AC-1.1 to AC-1.4." |
| h | `01-jobtitlr.md:163` (NFR-3) | `./mvnw exec:java` → `./mvnw -q compile exec:java` |
| i | `ASSUMPTIONS.md:20` (A-J8) | "Tuned on the brief's examples and on our golden dataset" → "Chosen from the brief's examples and the worked examples in spec 01 §4". Its "Risk" column: drop "and the golden-dataset test shows what changes when they move". |

Then add the new IDs (AC-3.5, AC-4.6) to the total: there are **38** AC IDs after this edit.

---

## 3. Scaffold (WP 1.2)

### Layout
```
jobtitlr/
  pom.xml
  mvnw                                   git mode 100755
  mvnw.cmd
  .mvn/wrapper/maven-wrapper.properties
  README.md
  src/main/java/dev/jobtitlr/
    Normaliser.java  MatchResult.java  SimilarityScorer.java  TokenDiceScorer.java
    Tokeniser.java   Levenshtein.java  Demo.java
  src/test/java/dev/jobtitlr/
    TokeniserTest.java  LevenshteinTest.java  MatchResultTest.java  TokenDiceScorerTest.java
    NormaliserSelectionTest.java  NormaliserBriefTest.java  NormaliserInputTest.java
    NormaliserConfigurationTest.java  WorkedExamplesTest.java  DemoTest.java
```
Tests live in the same package, so they can see the package-private `Tokeniser` and `Levenshtein`. `.editorconfig` sets a 4-space indent for Java. `.gitignore` already covers `target/`, `.idea/` and `*.iml`.

### `pom.xml` (use exactly these versions)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>dev.jobtitlr</groupId>
  <artifactId>jobtitlr</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>jar</packaging>
  <name>jobtitlr</name>
  <description>Matches free-text job titles to a list of normalised titles.</description>

  <properties>
    <maven.compiler.release>21</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.junit</groupId>
        <artifactId>junit-bom</artifactId>
        <version>5.14.4</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <!-- NFR-1: no runtime dependencies; JUnit 5 is the only test dependency. -->
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
        <configuration>
          <compilerArgs><arg>-Xlint:all</arg></compilerArgs>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.2.5</version>
        <configuration>
          <!-- Use the @DisplayName (which starts with the AC ID) in the XML reports and in the names of failing tests. -->
          <statelessTestsetReporter implementation="org.apache.maven.plugin.surefire.extensions.junit5.JUnit5Xml30StatelessReporter">
            <usePhrasedTestCaseMethodName>true</usePhrasedTestCaseMethodName>
          </statelessTestsetReporter>
          <consoleOutputReporter implementation="org.apache.maven.plugin.surefire.extensions.junit5.JUnit5ConsoleOutputReporter"/>
          <statelessTestsetInfoReporter implementation="org.apache.maven.plugin.surefire.extensions.junit5.JUnit5StatelessTestsetInfoReporter">
            <usePhrasedClassNameInRunning>true</usePhrasedClassNameInRunning>
          </statelessTestsetInfoReporter>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>exec-maven-plugin</artifactId>
        <version>3.6.4</version>
        <configuration>
          <mainClass>dev.jobtitlr.Demo</mainClass>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```
- **Never JUnit 6.** The `junit-bom` "release" tag on Maven Central is 6.x, but the spec says JUnit 5.
- **Never `maven-compiler-plugin` 4.0.0-beta-\***, even though it is the "release" tag.
- Compiler 3.13.0 and Surefire 3.2.5 are already cached.
- The Surefire reporter block only changes how names are printed. If Surefire rejects it, remove the block, note that in `docs/plans/phase-1.md`, and carry on. IntelliJ shows display names either way.

### Wrapper
From `jobtitlr/`, after `pom.xml` exists:
```sh
mvn -N org.apache.maven.plugins:maven-wrapper-plugin:3.3.4:wrapper -Dmaven=3.9.16; echo "exit=$?"
git add mvnw && git ls-files -s mvnw    # must show 100755
# if it shows 100644: git update-index --chmod=+x mvnw
```
`.gitattributes` forces LF on every file, `mvnw.cmd` included. Leave that as it is, and mention it in the README (Windows users run `mvnw.cmd`).

### Check
`./mvnw -q verify; echo "exit=$?"` exits 0 with no sources. Commit as `chore(jobtitlr): scaffold the Maven project with the wrapper, Java 21 and JUnit 5`.

---

## 4. API and algorithm (final, after D4)

### Public
```java
package dev.jobtitlr;

/** Immutable, thread-safe (NFR-2). */
public final class Normaliser {
    public static final List<String> DEFAULT_TITLES =
        List.of("Architect", "Software engineer", "Quantity surveyor", "Accountant");
    public static final double DEFAULT_MINIMUM_QUALITY = 0.2;

    public Normaliser()                                   // DEFAULT_TITLES, new TokenDiceScorer(), 0.2
    public Normaliser(List<String> titles)                // the default scorer and 0.2
    public Normaliser(List<String> titles, SimilarityScorer scorer, double minimumQuality)

    public String normalise(String jobTitle)              // the best title, or jobTitle.strip() when there is no match
    public Optional<MatchResult> bestMatch(String jobTitle)
    public List<String> normalisedTitles()                // unmodifiable copy
}

public record MatchResult(String title, double quality) { /* compact constructor validates */ }

@FunctionalInterface
public interface SimilarityScorer {
    /** @return a quality score within [0, 1] */
    double score(String input, String candidate);
}

public final class TokenDiceScorer implements SimilarityScorer {
    public static final double DEFAULT_TOKEN_THRESHOLD = 0.8;
    public TokenDiceScorer()
    public TokenDiceScorer(double tokenThreshold)
}
```
Package-private: `final class Tokeniser` (`static List<String> tokenise(String)`) and `final class Levenshtein` (`static int distance(String, String)`, `static double similarity(String, String)`), each with a private constructor. Every class has a single responsibility. Javadoc goes on every public type and member.

### Algorithm
1. **Tokenise**: `text.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}#+]", " ").strip()`. If the result is empty, return `List.of()`; otherwise `List.of(s.split("\\s+"))`.
2. **Token similarity**: `max == 0 ? 1.0 : 1.0 - (double) distance / max`. Two-row dynamic programming for the distance.
3. **Pairing**: build every pair `(i, j)` with similarity `>= tokenThreshold`, in `(input index, candidate index)` order. **Stable-sort** by similarity, descending (`List.sort` is stable). Assign greedily using `boolean[] usedInput, usedCandidate`. **Add the similarities up in that sorted order**, so `score(a, b)` and `score(b, a)` add the same doubles in the same order and are bit-identical (AC-4.4 uses `==`).
4. **q** = `2 * sum / (inputTokens + candidateTokens)`. If either side has zero tokens, return `0.0` first.
5. **Select**: loop over the titles in order. Replace the best result only when `q > best` (strictly greater), so the first title wins a tie.
6. **Threshold**: accept only if `q > 0 && q >= minimumQuality`.
7. `Normaliser` calls `scorer.score(jobTitle.strip(), title)`. It **checks the value before building `MatchResult`**: if `!(q >= 0.0 && q <= 1.0)` (this also catches NaN), it throws `IllegalStateException` (AC-8.7). Otherwise the record would throw an IAE first.

### Exceptions and messages (use these texts)
| Case | Exception | Message |
|---|---|---|
| `jobTitle` null | NPE | `jobTitle must not be null` |
| `jobTitle` blank (`isBlank()`) | IAE | `jobTitle must not be blank` |
| `titles` null | NPE | `titles must not be null` |
| `scorer` null | NPE | `scorer must not be null` |
| `titles` empty | IAE | `titles must not be empty` |
| `titles[i]` null | NPE | `titles[<i>] must not be null` (check every element **before** `List.copyOf`, whose own NPE has no message) |
| `titles[i]` blank | IAE | `titles[<i>] must not be blank` |
| duplicate | IAE | `duplicate title: "<title>"` (compare `strip().toLowerCase(Locale.ROOT)`) |
| `minimumQuality` outside [0, 1] or NaN | IAE | `minimumQuality must be within [0, 1]: <value>` |
| `tokenThreshold` outside [0, 1] or NaN | IAE | `tokenThreshold must be within [0, 1]: <value>` |
| scorer returns outside [0, 1] or NaN | ISE | `scorer returned <q> for "<input>" and "<title>"; expected a value within [0, 1]` |
| `MatchResult` title null | NPE | `title must not be null` |
| `MatchResult` title blank, or quality outside [0, 1] or NaN | IAE | `title must not be blank` / `quality must be within [0, 1]: <value>` |

### Worked values (for the tests)
acountant/accountant 0.9; enginer/engineer 0.875; surveyors/surveyor 8/9; c#/c+ 0.5; software/hardware 0.5; abcde/abcdx exactly 0.8 (`>=` matches); kitten/sitting distance 3. "Chef" scores 0.0 against all four default titles (its best token similarity is 0.333, with "architect").

---

## 5. TDD cycles (WP 1.3 to 1.5)

**The Java red rule.** A test against a class that does not exist does not compile, and a compile error is not a valid red. Each red commit therefore adds a **compiling stub with a wrong body** (`return 0.0;`, `return List.of();`, `return jobTitle;`, `return Optional.empty();`). Never `throw new UnsupportedOperationException()`.

Every red: run `./mvnw -q test; echo "exit=$?"` (exit 1), and quote the assertion line that failed. Every green: exit 0. Commit after each.

| Cycle | Class (test class) | Tests (`@DisplayName`) | Stub → green |
|---|---|---|---|
| C1 | `Tokeniser` (`TokeniserTest`) | `AC-2.1 lowercases with Locale.ROOT: "JAVA ENGINEER" -> [java, engineer]`; `AC-2.2 ignores leading, trailing and repeated whitespace`; `AC-2.3 splits on punctuation` (CSV: `Software-engineer`→`software engineer`, `Accountant (ACCA)`→`accountant acca`); `AC-2.4 keeps # and + inside tokens: "C# Engineer", "C++ developer"`; `AC-7.3 returns no tokens for punctuation only` (already green on the stub; say so) | stub `return List.of();` → §4 step 1 |
| C2 | `Levenshtein` (`LevenshteinTest`) | `AC-3.5 distance and similarity` (CSV columns `a, b, distance, similarity`, compared with a delta of 1e-9: `kitten, sitting, 3, 0.5714285714285714`; `'', abc, 3, 0.0`; `abc, abc, 0, 1.0`. Write the empty string as `''`: an unquoted empty value is `null`. Never write a fraction such as `4/7` in a CSV, because it fails conversion, which is not an assertion red); `AC-3.5 acountant vs accountant is 0.9, enginer vs engineer 0.875, surveyors vs surveyor 8/9, c# vs c+ 0.5` (one parameterised test); `AC-3.5 distance and similarity are symmetric` | stubs `return 0;` / `return 1.0;` → §4 step 2 |
| C3 | `MatchResult` (`MatchResultTest`) | `AC-9.2 rejects a blank title` (`""`, `"   "`); `AC-9.2 rejects a null title`; `AC-9.2 rejects a quality outside [0, 1] or NaN` (`-0.01, 1.01, NaN, ±Infinity`); `AC-9.2 accepts 0.0 and 1.0` | bare record → compact constructor |
| C4 | `TokenDiceScorer` (`TokenDiceScorerTest`) | `AC-4.2 identical titles after tokenising score 1.0` (`Software engineer`/same, `software-ENGINEER `/`Software engineer`); `AC-4.3 titles sharing no matching tokens score 0.0` (`Chef`/`Architect`) | stub `return 0.5;` plus the interface → Dice on exact token equality |
| C5 | `TokenDiceScorer` | `AC-3.1 "Acountant" vs "Accountant" scores 0.9`; `AC-3.2 ... 15/16`; `AC-3.3 ... 17/18`; `AC-3.4 a token at exactly the threshold matches: "abcde" vs "abcdx" scores 0.8`; `AC-3.4 "c#" vs "c+" scores 0.0` (already green) | best candidate token at or above the threshold (not one-to-one yet) |
| C6 | `TokenDiceScorer` | `AC-4.6 each token is paired at most once: "engineer engineer" vs "engineer" scores 2/3`; `AC-4.6 pairs are assigned best first: "enginer engineer" vs "engineer" scores 2/3` | §4 step 3 |
| C7 | `TokenDiceScorer` | `AC-4.1 punctuation-only strings score 0.0, not NaN`; `AC-4.1 q is within [0, 1] for 1000 seeded random pairs` (`new Random(20261012L)`; alphabet letters, digits, `#+-() ` and space; length 1–20; no jqwik); `AC-4.4 score(a, b) == score(b, a) for the worked examples and 1000 seeded random pairs` (exact `assertEquals`, no delta); `AC-3.4 the token threshold can be configured` (`new TokenDiceScorer(0.9)`: acountant/accountant still 0.9, enginer/engineer 0.0); `AC-3.4 a token threshold outside [0, 1] or NaN is rejected` | zero-token guard, `requireNonNull` on both arguments, the threshold constructor |
| C8 | `Normaliser` (`NormaliserSelectionTest`) | `AC-9.1 a custom scorer is used without changing Normaliser` (a recording lambda; assert the `(input, candidate)` arguments); `AC-5.1 the title with the highest q wins` (map-backed lambda A 0.3, B 0.9, C 0.5 → B); `AC-5.2 on equal q the title listed first wins`; `AC-5.3 the same input and configuration always give the same result` (two Normalisers from the same list, `normalise` and `bestMatch` called 100 times over the brief's inputs, `assertEquals`; commit as "(already green: selection has no state and no randomness)"); `AC-4.5 bestMatch exposes q through MatchResult.quality()` | 3-argument constructor assigning fields, `bestMatch` → `Optional.empty()` → the select loop, **no threshold yet** |
| C9 | `Normaliser` (`NormaliserBriefTest`) | `AC-1.1 to AC-1.4` CSV with the ID in column 0 (`AC-1.1, Java engineer, Software engineer` …); `AC-1.5 the brief's sample code compiles and runs unchanged` (body: `String jt = "Java engineer"; Normaliser n = new Normaliser(); String normalisedTitle = n.normalise(jt);` then assert); `AC-5.2 with the default scorer, "Engineer" picks the first of [Software engineer, Hardware engineer]`, plus the reversed list | stub defaults → `DEFAULT_TITLES`, `TokenDiceScorer`, 0.2; `normalise = bestMatch(...).map(MatchResult::title).orElse(jobTitle.strip())` |
| C10 | `Normaliser` (`NormaliserInputTest`) | `AC-2.1 matching ignores case`; `AC-2.2 whitespace is ignored`; `AC-2.3 punctuation separates words` (`Accountant (ACCA)` → Accountant); `AC-2.5 the title is returned in its configured form` (`"software ENGINEER"` → `"Software engineer"`; `List.of("iOS developer")` with `"IOS DEVELOPER"` → `"iOS developer"`); `AC-3.1 to AC-3.3 typos and plurals` CSV | probably already green: commit as "(already green: ...)" |
| C11 | `Normaliser` | `AC-6.1 "Chef" has no match`; `AC-6.1 a best q below minimumQuality is no match` (stub 0.19, minimum 0.2); `AC-6.1 a best q equal to minimumQuality is a match` (stub 0.2); `AC-6.1 q of 0.0 is never a match, even with minimumQuality 0.0`; `AC-6.2 normalise returns the stripped input when nothing matches: "  Chef  " -> "Chef"` | §4 step 6 |
| C12 | `Normaliser` (`NormaliserInputTest`) | `AC-7.1 normalise(null) throws NullPointerException naming jobTitle`; `AC-7.1 bestMatch(null) ...`; `AC-7.2 a blank input throws IllegalArgumentException` (`""`, `"   "`, `"\t\n"`, both methods); `AC-7.3 punctuation-only input is no match, not an exception` (`bestMatch` empty, `normalise("!!!")` is `"!!!"`) | private `requireJobTitle(String)` |
| C13 | `Normaliser` (`NormaliserConfigurationTest`) | `AC-8.1 a null title list ...`; `AC-8.1 a null scorer ...`; `AC-8.2 an empty title list ...`; `AC-8.3 a null title ...` (`Arrays.asList("Architect", null)`); `AC-8.3 a blank title ...`; `AC-8.4 duplicate titles, ignoring case and surrounding whitespace` (`["Architect", " architect "]`); `AC-8.5 minimumQuality outside [0, 1] or NaN` (`-0.01, 1.01, NaN, ±Infinity`); `AC-8.5 minimumQuality 0.0 and 1.0 are accepted` | validate elements → `List.copyOf` |
| C14 | `Normaliser` | `AC-8.6 changing the caller's list after construction has no effect`; `AC-8.6 normalisedTitles() cannot be modified`; `AC-8.7 a scorer returning a value outside [0, 1] or NaN makes Normaliser throw IllegalStateException` (`-0.1, 1.1, NaN`) | the guard in §4 step 7; all fields `private final` |
| C15 | `WorkedExamplesTest` | `AC-4.5 spec 01 §4 worked examples` (CSV of input, title and 2 dp q; `assertEquals(q, actual, 0.005)`); `AC-6.1 spec 01 §4: "Chef" has no match and scores 0.0 against every default title` | probably already green |
| C16 | `Demo` (`DemoTest`) | `AC-1.5 Demo prints the brief's four examples using the sample code unchanged` (capture `System.out` into a `ByteArrayOutputStream`, restore it in `finally`; expect the lines `Java engineer -> Software engineer`, `C# engineer -> Software engineer`, `Accountant -> Accountant`, `Chief Accountant -> Accountant`) | empty `main` → §6 |

Commit messages: `test(jobtitlr): AC-x.y <behaviour> (red)` and `feat(jobtitlr): <behaviour>`. One behaviour per cycle; split a cycle when it has more than one red.

---

## 6. Demo and the NFR-4 check

```java
package dev.jobtitlr;

/** Runs the brief's sample code (B1.5) on the brief's four examples (B1.3). */
public final class Demo {
    private Demo() {
    }

    public static void main(String[] args) {
        for (String jt : new String[] {"Java engineer", "C# engineer", "Accountant", "Chief Accountant"}) {
            Normaliser n = new Normaliser();
            String normalisedTitle = n.normalise(jt);
            System.out.println(jt + " -> " + normalisedTitle);
        }
    }
}
```

**NFR-4** (every AC ID has a test). From the repository root, this must exit 0:
```sh
diff <(grep -oE '\*\*AC-[0-9]+\.[0-9]+\*\*' docs/specs/01-jobtitlr.md | tr -d '*' | sort -u) \
     <(grep -rhoE 'AC-[0-9]+\.[0-9]+' jobtitlr/src/test | sort -u); echo "exit=$?"
```
There are 38 IDs. A test citing an ID that is not in the spec also shows up as a difference. AC-5.3 is covered in C8.

---

## 7. `jobtitlr/README.md` (WP 1.6)

1. What it does (one paragraph) and the brief's sample code.
2. **How to run**: JDK 21; `./mvnw test`; `./mvnw -q compile exec:java` and its four output lines; on Windows `mvnw.cmd`. **Import into IntelliJ**: File → Open → `jobtitlr/pom.xml` → Open as Project, then set the project SDK to a JDK 21 (or newer). Eclipse: Import → Existing Maven Projects.
3. **Design**: the classes and their single responsibilities; why `SimilarityScorer` is a strategy; immutability and defensive copies; fail-fast validation (the table from §4).
4. **Algorithm**: the steps from §4, with spec 01's worked-examples table.
5. **Testing evidence (B1.6)**: what is tested and why (per test class); the test count and a sample of the output. Get these from `./mvnw test` **without `-q`** (`-q` hides the "Tests run:" lines), but judge pass/fail by the exit code. Say that Phase 5's `docs/TESTING.md` holds the final numbers.
6. Links to spec 01, ADR 0002 and the assumptions A-J*.

---

## 8. ADR `docs/decisions/0002-jobtitlr-matching-algorithm.md` (WP 1.6)

Copy ADR 0001's format: title, `- Status:`, `- Date:`, `- Context:`, then `## Context`, `## Options considered` (a table: Option | For | Against), `## Decision`, `## Consequences`. Cite B1.4 (the q hint).

| Option | Facts to use |
|---|---|
| Whole-string Levenshtein | Gets the four brief examples right, but "Chief Accountant" only reaches 0.625, and **"Chef" → Architect at 0.333**, above the 0.2 floor: a false match. |
| Jaro-Winkler | "Chef" → Architect at 0.574. "Chief Accountant": Accountant 0.842 against Architect 0.65, a thin margin. It rewards shared prefixes and suits short names, not multi-word titles. |
| TF-IDF | With four titles the IDF is degenerate, and without character n-grams it has no typo tolerance. |
| Embeddings | Need the network and an API key, are not deterministic, and are hard to explain line by line (spec 01 §8). |
| **Token Dice + per-token Levenshtein (chosen)** | "Chef" scores 0.0; word order does not matter; extra and missing words are both penalised; typos are tolerated per token; deterministic; about 60 lines; every number is explainable. |

Consequences: the thresholds (0.8, 0.2) were chosen from the examples, not from data (A-J8). Synonyms ("developer" → "engineer") are not handled; Phase 2 adds a lexicon.

---

## 9. Phase 2 (optional; only if Dan says yes at H4)

The scope is in `prompts/claude-code-plan.md` "Phase 2" and `docs/research/title-standardisation.md`. Keep it small, OOP first, and leave `new Normaliser().normalise(...)` unchanged (A-J6).

1. **Spec `docs/specs/04-jobtitlr-standardiser.md` first, then STOP (H5).**
   - `TitleParser` → `ParsedTitle(core, Seniority, Set<String> specialisms)`, with the protected phrases "chief executive" and "head chef".
   - `Lexicon`, loaded from a resource and matched longest-first.
   - `TitleStandardiser` → sealed `StandardisationResult` (`Matched | Ambiguous | NoMatch`).
   - `TitleClusterer` (leader clustering on the core against medoids, input sorted first, `minSupport` 3, `accept()`), with `ClusterNamer` and `FrequencyNamer`.
   - No occupation codes: SOC 2020 and ESCO are cited as the model, not as data.
2. **Tests**:
   - metamorphic properties
   - hand-written seeded property tests. **No jqwik**: since 1.10.x it prints an "Anti-AI Usage Clause", and this project is openly AI-assisted. Check the exact version, and cite it in a comment and in the ADR
   - `golden.csv` of about 40 rows including negatives. **STOP (H5) before committing it**: Dan checks it by hand
3. **PIT** in a `-Pmutation` profile with a `mutationThreshold`. Versions checked on 2026-10-12: `pitest-maven` 1.30.0 and `pitest-junit5-plugin` 1.2.3; check whether the latter needs `junit-platform-launcher`. Spec 04 says it is a build plugin, so NFR-1 still holds.
4. ADR `0003-title-standardisation.md`, and a README section "Beyond the brief".

---

## 10. Traps

- `List.of(...)` rejects null, so use `Arrays.asList("Architect", null)` in the AC-8.3 test.
- The ID must be in `@DisplayName` **and** in a parameterised test's `name`, or Surefire and IntelliJ show bare method names.
- `-q` hides the test counts; the exit code is what matters.
- `"İ".toLowerCase(Locale.ROOT)` adds a combining dot (`\p{M}`), which the tokeniser treats as a separator. This is a known edge case; mention it in the README and do not fix it.
- Do not mark spec 01 **Accepted**: only H2 does that.
