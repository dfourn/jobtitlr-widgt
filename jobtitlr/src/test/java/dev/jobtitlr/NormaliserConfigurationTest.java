package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
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

    @ParameterizedTest(name = "{0} accepts the minimum quality {1}")
    @CsvSource({
            "AC-8.5, 0.0",
            "AC-8.5, 1.0"
    })
    @DisplayName("AC-8.5 minimumQuality 0.0 and 1.0 are accepted")
    void acceptsBoundaryMinimumQuality(String id, double minimumQuality) {
        Normaliser normaliser = new Normaliser(List.of("Architect"), new TokenDiceScorer(), minimumQuality);
        assertEquals("Architect", normaliser.normalise("Architect"));
    }

    @Test
    @DisplayName("AC-8.5 the documented default minimumQuality is 0.2 (spec 01, open question O-2)")
    void defaultMinimumQualityIsTheDocumentedDefault() {
        assertEquals(0.2, Normaliser.DEFAULT_MINIMUM_QUALITY,
                "changing the default must be a conscious decision, not silent drift");
    }

    @Test
    @DisplayName("AC-8.5 the no-arg Normaliser rejects a weak but non-zero best q (0 < q < 0.2)")
    void defaultMinimumQualityRejectsAWeakButNonZeroMatch() {
        String jobTitle = "Deputy head of the senior engineers team";
        assertTrue(new Normaliser().bestMatch(jobTitle).isEmpty(),
                "the default minimum quality must reject the best q for \"" + jobTitle + "\"");
        // The same input matches once the threshold drops to zero, so its best q is
        // strictly between 0 and the default: only the default stands in the way.
        MatchResult weak = new Normaliser(Normaliser.DEFAULT_TITLES, new TokenDiceScorer(), 0.0)
                .bestMatch(jobTitle)
                .orElseThrow();
        assertEquals("Software engineer", weak.title());
        assertTrue(weak.quality() > 0.0 && weak.quality() < 0.2,
                "best q should sit strictly between 0 and the default but was " + weak.quality());
    }

    @Test
    @DisplayName("AC-8.6 changing the caller's list after construction has no effect")
    void changingCallersListHasNoEffect() {
        List<String> titles = new ArrayList<>(List.of("Architect", "Accountant"));
        Normaliser normaliser = new Normaliser(titles, new TokenDiceScorer(), 0.2);
        titles.set(0, "Baker");
        titles.remove("Accountant");
        assertEquals("Accountant", normaliser.normalise("Acountant"));
        assertEquals(List.of("Architect", "Accountant"), normaliser.normalisedTitles());
    }

    @Test
    @DisplayName("AC-8.6 normalisedTitles() cannot be modified")
    void normalisedTitlesCannotBeModified() {
        Normaliser normaliser = new Normaliser(List.of("Architect", "Accountant"), new TokenDiceScorer(), 0.2);
        assertThrows(UnsupportedOperationException.class, () -> normaliser.normalisedTitles().set(0, "Baker"));
        assertThrows(UnsupportedOperationException.class, () -> normaliser.normalisedTitles().add("Baker"));
    }

    @ParameterizedTest(name = "{0} rejects a scorer returning {1}")
    @CsvSource({
            "AC-8.7, -0.1",
            "AC-8.7, 1.1",
            "AC-8.7, NaN"
    })
    @DisplayName("AC-8.7 a scorer returning a value outside [0, 1] or NaN makes Normaliser throw IllegalStateException")
    void scorerOutsideUnitIntervalThrowsIllegalState(String id, double quality) {
        Normaliser normaliser = new Normaliser(List.of("Architect"), (input, candidate) -> quality, 0.2);
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> normaliser.bestMatch("Java engineer"));
        assertEquals("scorer returned " + quality + " for \"Java engineer\" and \"Architect\""
                + "; expected a value within [0, 1]", exception.getMessage());
    }
}
