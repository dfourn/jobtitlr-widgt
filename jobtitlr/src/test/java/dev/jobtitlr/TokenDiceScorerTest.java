package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
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
}
