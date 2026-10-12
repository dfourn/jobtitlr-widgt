package dev.jobtitlr;

import java.util.List;

/**
 * Sørensen-Dice score over tokens, weighted by per-token Levenshtein
 * similarity (spec 01, section 4).
 */
public final class TokenDiceScorer implements SimilarityScorer {

    /**
     * Scores the similarity between an input and a candidate title as twice
     * the number of shared tokens over the total token count.
     *
     * @param input the free-text job title; must not be null
     * @param candidate the configured normalised title; must not be null
     * @return a quality score within [0, 1]
     */
    @Override
    public double score(String input, String candidate) {
        List<String> inputTokens = Tokeniser.tokenise(input);
        List<String> candidateTokens = Tokeniser.tokenise(candidate);
        long matches = inputTokens.stream()
                .filter(candidateTokens::contains)
                .count();
        return 2.0 * matches / (inputTokens.size() + candidateTokens.size());
    }
}
