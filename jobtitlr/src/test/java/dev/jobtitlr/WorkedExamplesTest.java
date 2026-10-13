package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Tests the worked-examples table in spec 01, section 4, against the default
 * configuration.
 */
class WorkedExamplesTest {

    @ParameterizedTest(name = "{0} {1} matches {2} with q = {3}")
    @CsvSource({
            "AC-4.5, Java engineer, Software engineer, 0.50",
            "AC-4.5, C# engineer, Software engineer, 0.50",
            "AC-4.5, Accountant, Accountant, 1.00",
            "AC-4.5, Chief Accountant, Accountant, 0.67",
            "AC-4.5, Acountant, Accountant, 0.90",
            "AC-4.5, Software enginer, Software engineer, 0.94",
            "AC-4.5, Quantity surveyors, Quantity surveyor, 0.94"
    })
    @DisplayName("AC-4.5 spec 01 section 4 worked examples")
    void workedExamplesMatchTheSpec(String id, String input, String expectedTitle, double expectedQuality) {
        MatchResult match = new Normaliser().bestMatch(input).orElseThrow();
        assertEquals(expectedTitle, match.title(), "for \"" + input + "\"");
        assertEquals(expectedQuality, match.quality(), 0.005, "for \"" + input + "\"");
    }

    @Test
    @DisplayName("AC-6.1 spec 01 section 4: \"Chef\" has no match and scores 0.0 against every default title")
    void chefScoresZeroAgainstEveryDefaultTitle() {
        TokenDiceScorer scorer = new TokenDiceScorer();
        for (String title : Normaliser.DEFAULT_TITLES) {
            assertEquals(0.0, scorer.score("Chef", title), "Chef vs \"" + title + "\"");
        }
        assertTrue(new Normaliser().bestMatch("Chef").isEmpty());
    }
}
