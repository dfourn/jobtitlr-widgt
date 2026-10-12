package dev.jobtitlr;

import java.util.List;

/**
 * Sørensen-Dice score over tokens, weighted by per-token Levenshtein
 * similarity (spec 01, section 4).
 */
public final class TokenDiceScorer implements SimilarityScorer {

    /** The token similarity at or above which two tokens count as matching. */
    public static final double DEFAULT_TOKEN_THRESHOLD = 0.8;

    private final double tokenThreshold;

    /** Creates a scorer whose tokens must reach the default similarity of 0.8 to match. */
    public TokenDiceScorer() {
        this.tokenThreshold = DEFAULT_TOKEN_THRESHOLD;
    }

    /**
     * Scores the similarity between an input and a candidate title: each
     * input token contributes the similarity of its best matching candidate
     * token, and q is twice that sum over the total token count.
     *
     * @param input the free-text job title; must not be null
     * @param candidate the configured normalised title; must not be null
     * @return a quality score within [0, 1]
     */
    @Override
    public double score(String input, String candidate) {
        List<String> inputTokens = Tokeniser.tokenise(input);
        List<String> candidateTokens = Tokeniser.tokenise(candidate);
        double sum = 0.0;
        for (String inputToken : inputTokens) {
            double best = 0.0;
            for (String candidateToken : candidateTokens) {
                best = Math.max(best, Levenshtein.similarity(inputToken, candidateToken));
            }
            if (best >= tokenThreshold) {
                sum += best;
            }
        }
        return 2.0 * sum / (inputTokens.size() + candidateTokens.size());
    }
}
