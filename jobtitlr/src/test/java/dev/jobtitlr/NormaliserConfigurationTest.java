package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Tests for {@link Normaliser} configuration validation and immutability (spec 01, AC-8). */
class NormaliserConfigurationTest {

    @Test
    @DisplayName("AC-8.1 a null title list or null scorer throws NullPointerException")
    void nullConfigurationThrows() {
        NullPointerException titlesException = assertThrows(NullPointerException.class,
                () -> new Normaliser(null, new TokenDiceScorer(), 0.2));
        assertEquals("titles must not be null", titlesException.getMessage());
        NullPointerException scorerException = assertThrows(NullPointerException.class,
                () -> new Normaliser(List.of("Architect"), null, 0.2));
        assertEquals("scorer must not be null", scorerException.getMessage());
    }

    @Test
    @DisplayName("AC-8.2 an empty title list throws IllegalArgumentException")
    void emptyTitleListThrows() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new Normaliser(List.of(), new TokenDiceScorer(), 0.2));
        assertEquals("titles must not be empty", exception.getMessage());
    }

    @Test
    @DisplayName("AC-8.3 a null title element throws NullPointerException")
    void nullTitleElementThrows() {
        NullPointerException exception = assertThrows(NullPointerException.class,
                () -> new Normaliser(Arrays.asList("Architect", null), new TokenDiceScorer(), 0.2));
        assertEquals("titles[1] must not be null", exception.getMessage());
    }

    @ParameterizedTest(name = "{0} rejects the blank title element ''{1}'' at index 1")
    @CsvSource({
            "AC-8.3, ''",
            "AC-8.3, '   '"
    })
    @DisplayName("AC-8.3 a blank title element throws IllegalArgumentException")
    void blankTitleElementThrows(String id, String title) {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new Normaliser(Arrays.asList("Architect", title), new TokenDiceScorer(), 0.2));
        assertEquals("titles[1] must not be blank", exception.getMessage());
    }

    @Test
    @DisplayName("AC-8.4 duplicate titles, ignoring case and surrounding whitespace, throw IllegalArgumentException")
    void duplicateTitlesThrow() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new Normaliser(Arrays.asList("Architect", " architect "), new TokenDiceScorer(), 0.2));
        assertEquals("duplicate title: \"architect\"", exception.getMessage());
    }

    @ParameterizedTest(name = "{0} rejects the minimum quality {1}")
    @CsvSource({
            "AC-8.5, -0.01",
            "AC-8.5, 1.01",
            "AC-8.5, NaN",
            "AC-8.5, Infinity",
            "AC-8.5, -Infinity"
    })
    @DisplayName("AC-8.5 minimumQuality outside [0, 1] or NaN is rejected")
    void rejectsMinimumQualityOutsideUnitInterval(String id, double minimumQuality) {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new Normaliser(List.of("Architect"), new TokenDiceScorer(), minimumQuality));
        assertEquals("minimumQuality must be within [0, 1]: " + minimumQuality, exception.getMessage());
    }
}
