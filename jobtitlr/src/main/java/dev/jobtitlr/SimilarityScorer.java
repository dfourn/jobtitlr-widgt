package dev.jobtitlr;

/**
 * Strategy for scoring how similar a free-text job title is to a candidate
 * normalised title (spec 01, section 3).
 */
@FunctionalInterface
public interface SimilarityScorer {

    /**
     * Scores the similarity between an input and a candidate title.
     *
     * @param input the free-text job title; must not be null
     * @param candidate the configured normalised title; must not be null
     * @return a quality score within [0, 1]
     */
    double score(String input, String candidate);
}
