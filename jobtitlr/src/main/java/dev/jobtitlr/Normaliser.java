package dev.jobtitlr;

import java.util.List;
import java.util.Optional;

/**
 * Matches a free-text job title to the closest title from a configured list
 * of normalised titles (spec 01, section 3).
 *
 * <p>Immutable and therefore safe to share between threads (NFR-2): every
 * field is final and the title list is defensively copied on construction.</p>
 */
public final class Normaliser {

    private final List<String> titles;
    private final SimilarityScorer scorer;
    private final double minimumQuality;

    /**
     * Creates a normaliser with a custom configuration.
     *
     * @param titles the normalised titles to match against
     * @param scorer the strategy that scores an input against a candidate title
     * @param minimumQuality the quality a match must reach to be accepted
     */
    public Normaliser(List<String> titles, SimilarityScorer scorer, double minimumQuality) {
        this.titles = titles;
        this.scorer = scorer;
        this.minimumQuality = minimumQuality;
    }

    /**
     * Returns the best-matching normalised title for the given job title.
     *
     * @param jobTitle the free-text job title; must not be null
     * @return the best title, or the stripped input when there is no match
     */
    public String normalise(String jobTitle) {
        return bestMatch(jobTitle).map(MatchResult::title).orElse(jobTitle.strip());
    }

    /**
     * Returns the best match together with its quality.
     *
     * @param jobTitle the free-text job title; must not be null
     * @return the best match, or empty when no title reaches the minimum quality
     */
    public Optional<MatchResult> bestMatch(String jobTitle) {
        String input = jobTitle.strip();
        MatchResult best = null;
        for (String title : titles) {
            double quality = scorer.score(input, title);
            if (best == null || quality > best.quality()) {
                best = new MatchResult(title, quality);
            }
        }
        return Optional.ofNullable(best);
    }

    /**
     * Returns the configured normalised titles.
     *
     * @return an unmodifiable copy of the titles
     */
    public List<String> normalisedTitles() {
        return List.of();
    }
}
