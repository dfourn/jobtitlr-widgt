package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Tests for {@link Normaliser} selection (spec 01, sections 4 and 5). */
class NormaliserSelectionTest {

    @Test
    @DisplayName("AC-9.1 a custom scorer is used without changing Normaliser")
    void customScorerIsUsed() {
        List<String> recorded = new ArrayList<>();
        Normaliser normaliser = new Normaliser(List.of("Architect", "Accountant"),
                (input, candidate) -> {
                    recorded.add(input + "|" + candidate);
                    return 0.5;
                }, 0.2);
        normaliser.bestMatch("Java engineer");
        assertEquals(List.of("Java engineer|Architect", "Java engineer|Accountant"), recorded);
    }

    @Test
    @DisplayName("AC-5.1 the title with the highest q wins")
    void highestQualityWins() {
        Map<String, Double> qualities = Map.of("A", 0.3, "B", 0.9, "C", 0.5);
        Normaliser normaliser = new Normaliser(List.of("A", "B", "C"),
                (input, candidate) -> qualities.get(candidate), 0.2);
        assertEquals("B", normaliser.normalise("anything"));
        assertEquals(Optional.of(new MatchResult("B", 0.9)), normaliser.bestMatch("anything"));
    }

    @Test
    @DisplayName("AC-5.2 on equal q the title listed first wins")
    void equalQualityPicksTheFirstListedTitle() {
        Normaliser normaliser = new Normaliser(List.of("A", "B", "C"), (input, candidate) -> 0.5, 0.2);
        assertEquals("A", normaliser.normalise("anything"));
        assertEquals(Optional.of(new MatchResult("A", 0.5)), normaliser.bestMatch("anything"));
    }

    @Test
    @DisplayName("AC-4.5 bestMatch exposes q through MatchResult.quality()")
    void bestMatchExposesQuality() {
        Normaliser normaliser = new Normaliser(List.of("A", "B"), (input, candidate) -> 0.42, 0.2);
        assertEquals(0.42, normaliser.bestMatch("anything").orElseThrow().quality());
    }

    /** The brief's four inputs (spec 01, section 4). */
    private static final String[] BRIEF_INPUTS = {
            "Java engineer", "C# engineer", "Accountant", "Chief Accountant"
    };

    @Test
    @DisplayName("AC-5.3 the same input and configuration always give the same result")
    void resultsAreDeterministic() {
        List<String> titles = List.of("Architect", "Software engineer", "Quantity surveyor", "Accountant");
        Normaliser first = new Normaliser(titles, new TokenDiceScorer(), 0.2);
        Normaliser second = new Normaliser(titles, new TokenDiceScorer(), 0.2);
        for (int i = 0; i < 100; i++) {
            for (String input : BRIEF_INPUTS) {
                assertEquals(first.normalise(input), second.normalise(input),
                        "normalise differs for \"" + input + "\"");
                assertEquals(first.bestMatch(input), second.bestMatch(input),
                        "bestMatch differs for \"" + input + "\"");
            }
        }
    }
}
