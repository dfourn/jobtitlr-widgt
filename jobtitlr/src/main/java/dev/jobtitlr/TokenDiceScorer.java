package dev.jobtitlr;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

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
     * Creates a scorer with a custom token threshold.
     *
     * @param tokenThreshold the similarity at or above which two tokens match
     */
    public TokenDiceScorer(double tokenThreshold) {
        this.tokenThreshold = DEFAULT_TOKEN_THRESHOLD;
    }

    /**
     * Scores the similarity between an input and a candidate title. Tokens
     * are paired one-to-one, best pairs first, and q is twice the sum of the
     * paired similarities over the total token count; q is 0.0 when either
     * side has no tokens.
     *
     * @param input the free-text job title; must not be null
     * @param candidate the configured normalised title; must not be null
     * @return a quality score within [0, 1]
     */
    @Override
    public double score(String input, String candidate) {
        Objects.requireNonNull(input, "input must not be null");
        Objects.requireNonNull(candidate, "candidate must not be null");
        List<String> inputTokens = Tokeniser.tokenise(input);
        List<String> candidateTokens = Tokeniser.tokenise(candidate);
        if (inputTokens.isEmpty() || candidateTokens.isEmpty()) {
            return 0.0;
        }
        List<TokenPair> pairs = matchingPairs(inputTokens, candidateTokens);
        boolean[] usedInput = new boolean[inputTokens.size()];
        boolean[] usedCandidate = new boolean[candidateTokens.size()];
        double sum = 0.0;
        for (TokenPair pair : pairs) {
            if (!usedInput[pair.inputIndex()] && !usedCandidate[pair.candidateIndex()]) {
                usedInput[pair.inputIndex()] = true;
                usedCandidate[pair.candidateIndex()] = true;
                sum += pair.similarity();
            }
        }
        return 2.0 * sum / (inputTokens.size() + candidateTokens.size());
    }

    /**
     * Builds every pair whose similarity reaches the token threshold, in
     * (input index, candidate index) order, stably sorted by similarity
     * descending. The stable order makes the two argument orders add the
     * same doubles in the same sequence.
     */
    private List<TokenPair> matchingPairs(List<String> inputTokens, List<String> candidateTokens) {
        List<TokenPair> pairs = new ArrayList<>();
        for (int i = 0; i < inputTokens.size(); i++) {
            for (int j = 0; j < candidateTokens.size(); j++) {
                double similarity = Levenshtein.similarity(inputTokens.get(i), candidateTokens.get(j));
                if (similarity >= tokenThreshold) {
                    pairs.add(new TokenPair(i, j, similarity));
                }
            }
        }
        pairs.sort(Comparator.comparingDouble(TokenPair::similarity).reversed());
        return pairs;
    }

    /** A candidate pairing of one input token with one candidate token. */
    private record TokenPair(int inputIndex, int candidateIndex, double similarity) {
    }
}
