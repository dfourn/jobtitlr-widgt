package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

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

    @ParameterizedTest(name = "{0} normalises {1} to {2}")
    @CsvSource({
            "AC-2.3, Software-engineer, Software engineer",
            "AC-2.3, 'Accountant (ACCA)', Accountant"
    })
    @DisplayName("AC-2.3 punctuation separates words")
    void punctuationSeparatesWords(String id, String input, String expected) {
        assertEquals(expected, new Normaliser().normalise(input), "for \"" + input + "\"");
    }

    @Test
    @DisplayName("AC-2.5 the title is returned in its configured form")
    void titleIsReturnedInItsConfiguredForm() {
        assertEquals("Software engineer", new Normaliser().normalise("software ENGINEER"));
        assertEquals("iOS developer", new Normaliser(List.of("iOS developer")).normalise("IOS DEVELOPER"));
    }

    @ParameterizedTest(name = "{0} normalises {1} to {2}")
    @CsvSource({
            "AC-3.1, Acountant, Accountant",
            "AC-3.2, Software enginer, Software engineer",
            "AC-3.3, Quantity surveyors, Quantity surveyor"
    })
    @DisplayName("AC-3.1 to AC-3.3 typos and plurals are tolerated")
    void typosAndPluralsAreTolerated(String id, String input, String expected) {
        assertEquals(expected, new Normaliser().normalise(input), "for \"" + input + "\"");
    }
}
