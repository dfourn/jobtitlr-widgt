package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Tests for {@link Levenshtein} (spec 01, section 4 step 2 and AC-3.5). */
class LevenshteinTest {

    @ParameterizedTest(name = "{0} distance({1}, {2}) = {3} and similarity = {4}")
    @CsvSource({
            "AC-3.5, kitten, sitting, 3, 0.5714285714285714",
            "AC-3.5, '', abc, 3, 0.0",
            "AC-3.5, abc, abc, 0, 1.0"
    })
    @DisplayName("AC-3.5 distance and similarity")
    void distanceAndSimilarity(String id, String a, String b, int distance, double similarity) {
        assertEquals(distance, Levenshtein.distance(a, b));
        assertEquals(similarity, Levenshtein.similarity(a, b), 1e-9);
    }

    @ParameterizedTest(name = "{0} similarity({1}, {2}) = {3}")
    @CsvSource({
            "AC-3.5, acountant, accountant, 0.9",
            "AC-3.5, enginer, engineer, 0.875",
            "AC-3.5, surveyors, surveyor, 0.8888888888888888",
            "AC-3.5, c#, c+, 0.5"
    })
    @DisplayName("AC-3.5 acountant vs accountant is 0.9, enginer vs engineer 0.875, surveyors vs surveyor 8/9, c# vs c+ 0.5")
    void workedValues(String id, String a, String b, double similarity) {
        assertEquals(similarity, Levenshtein.similarity(a, b), 1e-9);
    }

    @Test
    @DisplayName("AC-3.5 characters outside the Basic Multilingual Plane count as one character each")
    void supplementaryCharactersCountOnce() {
        // U+1D538 and U+1D539 are each one code point but two UTF-16 chars.
        String a = "𝔸bc";
        String b = "𝔹bc";
        assertEquals(1, Levenshtein.distance(a, b));
        assertEquals(2.0 / 3.0, Levenshtein.similarity(a, b), 1e-9);
        assertEquals(1, Levenshtein.distance("\uD835\uDD38", "x"));
    }

    @ParameterizedTest(name = "{0} distance and similarity of {1} and {2} are symmetric")
    @CsvSource({
            "AC-3.5, kitten, sitting",
            "AC-3.5, acountant, accountant",
            "AC-3.5, surveyors, surveyor",
            "AC-3.5, c#, c+",
            "AC-3.5, '', abc"
    })
    @DisplayName("AC-3.5 distance and similarity are symmetric")
    void distanceAndSimilarityAreSymmetric(String id, String a, String b) {
        assertEquals(Levenshtein.distance(a, b), Levenshtein.distance(b, a));
        assertEquals(Levenshtein.similarity(a, b), Levenshtein.similarity(b, a));
    }
}
