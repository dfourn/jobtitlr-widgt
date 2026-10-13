package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    @Test
    @DisplayName("AC-7.1 normalise(null) and bestMatch(null) throw NullPointerException naming jobTitle")
    void nullInputThrowsNamingJobTitle() {
        Normaliser normaliser = new Normaliser();
        NullPointerException fromNormalise = assertThrows(NullPointerException.class,
                () -> normaliser.normalise(null));
        assertEquals("jobTitle must not be null", fromNormalise.getMessage());
        NullPointerException fromBestMatch = assertThrows(NullPointerException.class,
                () -> normaliser.bestMatch(null));
        assertEquals("jobTitle must not be null", fromBestMatch.getMessage());
    }

    @ParameterizedTest(name = "{0} rejects the blank input ''{1}''")
    @CsvSource({
            "AC-7.2, ''",
            "AC-7.2, '   '",
            "AC-7.2, '\t\n'"
    })
    @DisplayName("AC-7.2 a blank input throws IllegalArgumentException from both methods")
    void blankInputThrows(String id, String jobTitle) {
        Normaliser normaliser = new Normaliser();
        IllegalArgumentException fromNormalise = assertThrows(IllegalArgumentException.class,
                () -> normaliser.normalise(jobTitle));
        assertEquals("jobTitle must not be blank", fromNormalise.getMessage());
        IllegalArgumentException fromBestMatch = assertThrows(IllegalArgumentException.class,
                () -> normaliser.bestMatch(jobTitle));
        assertEquals("jobTitle must not be blank", fromBestMatch.getMessage());
    }

    @Test
    @DisplayName("AC-7.3 punctuation-only input is no match, not an exception")
    void punctuationOnlyInputIsNoMatch() {
        Normaliser normaliser = new Normaliser();
        assertTrue(normaliser.bestMatch("!!!").isEmpty());
        assertEquals("!!!", normaliser.normalise("!!!"));
    }
}
