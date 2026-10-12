package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
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
}
