package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Tests for {@link MatchResult} (spec 01, AC-9.2). */
class MatchResultTest {

    @Test
    @DisplayName("AC-9.2 rejects a null title")
    void rejectsNullTitle() {
        NullPointerException exception = assertThrows(NullPointerException.class,
                () -> new MatchResult(null, 0.5));
        assertEquals("title must not be null", exception.getMessage());
    }
}
