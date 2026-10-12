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
}
