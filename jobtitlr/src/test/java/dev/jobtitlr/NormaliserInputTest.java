package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Tests for {@link Normaliser} input handling (spec 01, AC-2, AC-3 and AC-7). */
class NormaliserInputTest {

    @Test
    @DisplayName("AC-2.1 matching ignores case")
    void matchingIgnoresCase() {
        assertEquals("Software engineer", new Normaliser().normalise("JAVA ENGINEER"));
    }

    @Test
    @DisplayName("AC-2.2 whitespace is ignored")
    void whitespaceIsIgnored() {
        assertEquals("Software engineer", new Normaliser().normalise("  java   engineer "));
    }
}
