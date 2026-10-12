package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Tests for {@link MatchResult} (spec 01, AC-9.2). */
class MatchResultTest {

    @Test
    @DisplayName("AC-9.2 rejects a null title")
    void rejectsNullTitle() {
        NullPointerException exception = assertThrows(NullPointerException.class,
                () -> new MatchResult(null, 0.5));
        assertEquals("title must not be null", exception.getMessage());
    }

    @ParameterizedTest(name = "{0} rejects the blank title ''{1}''")
    @CsvSource({
            "AC-9.2, ''",
            "AC-9.2, '   '"
    })
    @DisplayName("AC-9.2 rejects a blank title")
    void rejectsBlankTitle(String id, String title) {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new MatchResult(title, 0.5));
        assertEquals("title must not be blank", exception.getMessage());
    }

    @ParameterizedTest(name = "{0} rejects the quality {1}")
    @CsvSource({
            "AC-9.2, -0.01",
            "AC-9.2, 1.01",
            "AC-9.2, NaN",
            "AC-9.2, Infinity",
            "AC-9.2, -Infinity"
    })
    @DisplayName("AC-9.2 rejects a quality outside [0, 1] or NaN")
    void rejectsQualityOutsideUnitInterval(String id, double quality) {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> new MatchResult("Accountant", quality));
        assertEquals("quality must be within [0, 1]: " + quality, exception.getMessage());
    }

    @ParameterizedTest(name = "{0} accepts the quality {1}")
    @CsvSource({
            "AC-9.2, 0.0",
            "AC-9.2, 1.0"
    })
    @DisplayName("AC-9.2 accepts 0.0 and 1.0")
    void acceptsBoundaryQualities(String id, double quality) {
        MatchResult result = new MatchResult("Accountant", quality);
        assertEquals("Accountant", result.title());
        assertEquals(quality, result.quality());
    }
}
