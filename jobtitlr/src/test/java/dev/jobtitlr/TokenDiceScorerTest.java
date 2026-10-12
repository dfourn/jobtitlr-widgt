package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
}
