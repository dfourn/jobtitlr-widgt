package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Random;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Tests for {@link TokenDiceScorer} (spec 01, section 4). */
class TokenDiceScorerTest {

    private final TokenDiceScorer scorer = new TokenDiceScorer();

    @ParameterizedTest(name = "{0} score of {1} and {2} is {3}")
    @CsvSource({
            "AC-4.2, Software engineer, Software engineer, 1.0",
            "AC-4.2, 'software-ENGINEER ', Software engineer, 1.0"
    })
    @DisplayName("AC-4.2 identical titles after tokenising score 1.0")
    void identicalTitlesScoreOne(String id, String input, String candidate, double expected) {
        assertEquals(expected, scorer.score(input, candidate), 1e-9);
    }

    @Test
    @DisplayName("AC-4.3 titles sharing no matching tokens score 0.0")
    void titlesSharingNoMatchingTokensScoreZero() {
        assertEquals(0.0, scorer.score("Chef", "Architect"), 1e-9);
    }

    @Test
    @DisplayName("AC-3.1 \"Acountant\" vs \"Accountant\" scores 0.9")
    void acountantVsAccountantScoresPointNine() {
        assertEquals(0.9, scorer.score("Acountant", "Accountant"), 1e-9);
    }

    @Test
    @DisplayName("AC-3.2 \"Software enginer\" vs \"Software engineer\" scores 15/16")
    void softwareEnginerScoresFifteenSixteenths() {
        assertEquals(0.9375, scorer.score("Software enginer", "Software engineer"), 1e-9);
    }

    @Test
    @DisplayName("AC-3.3 \"Quantity surveyors\" vs \"Quantity surveyor\" scores 17/18")
    void quantitySurveyorsScoresSeventeenEighteenths() {
        assertEquals(0.9444444444444444, scorer.score("Quantity surveyors", "Quantity surveyor"), 1e-9);
    }

    @ParameterizedTest(name = "{0} score of {1} and {2} is {3}")
    @CsvSource({
            "AC-3.4, abcde, abcdx, 0.8",
            "AC-3.4, c#, c+, 0.0"
    })
    @DisplayName("AC-3.4 a token at exactly the threshold matches: \"abcde\" vs \"abcdx\" scores 0.8; \"c#\" vs \"c+\" scores 0.0")
    void thresholdEdges(String id, String input, String candidate, double expected) {
        assertEquals(expected, scorer.score(input, candidate), 1e-9);
    }

    @Test
    @DisplayName("AC-4.6 each token is paired at most once: \"engineer engineer\" vs \"engineer\" scores 2/3")
    void eachTokenIsPairedAtMostOnce() {
        assertEquals(2.0 / 3.0, scorer.score("engineer engineer", "engineer"), 1e-9);
    }

    @Test
    @DisplayName("AC-4.6 pairs are assigned best first: \"enginer engineer\" vs \"engineer\" scores 2/3")
    void pairsAreAssignedBestFirst() {
        assertEquals(2.0 / 3.0, scorer.score("enginer engineer", "engineer"), 1e-9);
    }

    @Test
    @DisplayName("AC-4.1 punctuation-only strings score 0.0, not NaN")
    void punctuationOnlyStringsScoreZeroNotNaN() {
        assertEquals(0.0, scorer.score("!!!", "Architect"));
        assertEquals(0.0, scorer.score("Architect", "###"));
        assertEquals(0.0, scorer.score("...", "!!!"));
    }

    @Test
    @DisplayName("AC-4.1 q is within [0, 1] for 1000 seeded random pairs")
    void qIsWithinUnitIntervalForRandomPairs() {
        Random random = new Random(20261012L);
        for (int i = 0; i < 1000; i++) {
            String a = randomString(random);
            String b = randomString(random);
            double q = scorer.score(a, b);
            assertTrue(q >= 0.0 && q <= 1.0, "q out of range for \"" + a + "\" and \"" + b + "\": " + q);
        }
    }

    @Test
    @DisplayName("AC-4.4 score(a, b) == score(b, a) for the worked examples and 1000 seeded random pairs")
    void scoreIsSymmetric() {
        String[][] workedExamples = {
                {"Java engineer", "Software engineer"},
                {"C# engineer", "Software engineer"},
                {"Accountant", "Accountant"},
                {"Chief Accountant", "Accountant"},
                {"Acountant", "Accountant"},
                {"Software enginer", "Software engineer"},
                {"Quantity surveyors", "Quantity surveyor"},
                {"Chef", "Architect"},
                {"engineer engineer", "engineer"},
                {"enginer engineer", "engineer"},
                {"abcde", "abcdx"},
                {"c#", "c+"}
        };
        for (String[] example : workedExamples) {
            assertEquals(scorer.score(example[0], example[1]), scorer.score(example[1], example[0]),
                    "not symmetric for \"" + example[0] + "\" and \"" + example[1] + "\"");
        }
        Random random = new Random(20261012L);
        for (int i = 0; i < 1000; i++) {
            String a = randomString(random);
            String b = randomString(random);
            assertEquals(scorer.score(a, b), scorer.score(b, a),
                    "not symmetric for \"" + a + "\" and \"" + b + "\"");
        }
    }

    @Test
    @DisplayName("AC-4.1 q is within [0, 1] for 1000 seeded realistic pairs, and the run is not vacuous")
    void qIsWithinUnitIntervalForRealisticPairs() {
        Random random = new Random(VOCABULARY_SEED);
        int nonZero = 0;
        for (int i = 0; i < 1000; i++) {
            String[] pair = realisticPair(random);
            double q = scorer.score(pair[0], pair[1]);
            assertFalse(Double.isNaN(q), "q is NaN for \"" + pair[0] + "\" and \"" + pair[1] + "\"");
            assertTrue(q >= 0.0 && q <= 1.0,
                    "q out of range for \"" + pair[0] + "\" and \"" + pair[1] + "\": " + q);
            if (q > 0.0) {
                nonZero++;
            }
        }
        // Vacuity guard: fully random strings almost never cross the 0.8 token
        // threshold, so a randomized run can silently degrade into comparing
        // 0.0 with 0.0. With seed 20261013L the measured count of pairs scoring
        // q > 0 is 676; at least half of that must keep scoring above zero, or
        // this generator has stopped exercising the matching path.
        assertTrue(nonZero >= 338, "only " + nonZero + " of 1000 pairs scored above 0; the run is vacuous");
    }

    @Test
    @DisplayName("AC-4.4 score(a, b) == score(b, a) bit-identically for 1000 seeded realistic pairs")
    void scoreIsSymmetricForRealisticPairs() {
        Random random = new Random(VOCABULARY_SEED);
        for (int i = 0; i < 1000; i++) {
            String[] pair = realisticPair(random);
            assertEquals(scorer.score(pair[0], pair[1]), scorer.score(pair[1], pair[0]), 0.0,
                    "not bit-identically symmetric for \"" + pair[0] + "\" and \"" + pair[1] + "\"");
        }
    }

    @Test
    @DisplayName("AC-3.4 the token threshold can be configured")
    void tokenThresholdCanBeConfigured() {
        TokenDiceScorer strict = new TokenDiceScorer(0.9);
        assertEquals(0.9, strict.score("Acountant", "Accountant"), 1e-9);
        assertEquals(0.0, strict.score("enginer", "engineer"), 1e-9);
    }

    @ParameterizedTest(name = "{0} rejects the token threshold {1}")
    @CsvSource({
            "AC-3.4, -0.01",
            "AC-3.4, 1.01",
            "AC-3.4, NaN",
            "AC-3.4, Infinity",
            "AC-3.4, -Infinity"
    })
    @DisplayName("AC-3.4 a token threshold outside [0, 1] or NaN is rejected")
    void rejectsTokenThresholdOutsideUnitInterval(String id, double tokenThreshold) {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new TokenDiceScorer(tokenThreshold));
        assertEquals("tokenThreshold must be within [0, 1]: " + tokenThreshold, exception.getMessage());
    }

    private static final String ALPHABET =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#+-() ";

    private static String randomString(Random random) {
        int length = 1 + random.nextInt(20);
        StringBuilder text = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            text.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return text.toString();
    }

    /**
     * Realistic base tokens. Pairs are drawn from this vocabulary rather than
     * from fully random strings, whose token similarities almost never reach
     * the 0.8 threshold and leave a randomized run vacuous.
     */
    private static final String[] VOCABULARY = {
            "engineer", "software", "accountant", "architect", "quantity", "surveyor", "chief"
    };

    /** Fixed seed for the vocabulary-based generator (both tests below use it). */
    private static final long VOCABULARY_SEED = 20261013L;

    /**
     * Builds one pair of titles from the same base tokens: each side draws
     * 1-3 vocabulary tokens and applies 0-2 seeded single-character edits
     * (substitute, delete or insert) to each, so token similarities straddle
     * the 0.8 threshold and non-zero scores and ties occur.
     */
    private static String[] realisticPair(Random random) {
        int tokenCount = 1 + random.nextInt(3);
        String[] a = new String[tokenCount];
        String[] b = new String[tokenCount];
        for (int t = 0; t < tokenCount; t++) {
            String base = VOCABULARY[random.nextInt(VOCABULARY.length)];
            a[t] = edited(base, random);
            b[t] = edited(base, random);
        }
        return new String[] {String.join(" ", a), String.join(" ", b)};
    }

    /** Applies 0-2 seeded single-character edits: substitute, delete or insert. */
    private static String edited(String token, Random random) {
        String result = token;
        int edits = random.nextInt(3);
        for (int e = 0; e < edits && !result.isEmpty(); e++) {
            int kind = random.nextInt(3);
            int index = random.nextInt(result.length());
            if (kind == 0) {
                char replacement = (char) ('a' + random.nextInt(26));
                while (replacement == result.charAt(index)) {
                    replacement = (char) ('a' + random.nextInt(26));
                }
                result = result.substring(0, index) + replacement + result.substring(index + 1);
            } else if (kind == 1) {
                result = result.substring(0, index) + result.substring(index + 1);
            } else {
                result = result.substring(0, index) + (char) ('a' + random.nextInt(26)) + result.substring(index);
            }
        }
        return result;
    }
}
