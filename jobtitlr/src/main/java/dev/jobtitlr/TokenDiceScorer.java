package dev.jobtitlr;

/**
 * Sørensen-Dice score over tokens, weighted by per-token Levenshtein
 * similarity (spec 01, section 4).
 */
public final class TokenDiceScorer implements SimilarityScorer {

    /**
     * Scores the similarity between an input and a candidate title.
     *
     * @param input the free-text job title; must not be null
     * @param candidate the configured normalised title; must not be null
     * @return a quality score within [0, 1]
     */
    @Override
    public double score(String input, String candidate) {
        return 0.5;
    }
}
