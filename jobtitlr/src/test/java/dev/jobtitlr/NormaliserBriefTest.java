package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Tests for {@link Normaliser} against the brief's examples (spec 01, AC-1). */
class NormaliserBriefTest {

    @ParameterizedTest(name = "{0} normalises {1} to {2}")
    @CsvSource({
            "AC-1.1, Java engineer, Software engineer",
            "AC-1.2, C# engineer, Software engineer",
            "AC-1.3, Accountant, Accountant",
            "AC-1.4, Chief Accountant, Accountant"
    })
    @DisplayName("AC-1.1 to AC-1.4 the brief's examples normalise to the expected titles")
    void briefExamplesNormalise(String id, String input, String expected) {
        assertEquals(expected, new Normaliser().normalise(input), "for \"" + input + "\"");
    }

    @Test
    @DisplayName("AC-1.5 the brief's sample code compiles and runs unchanged")
    void briefSampleCodeRunsUnchanged() {
        String jt = "Java engineer";
        Normaliser n = new Normaliser();
        String normalisedTitle = n.normalise(jt);
        assertEquals("Software engineer", normalisedTitle);
    }
}
