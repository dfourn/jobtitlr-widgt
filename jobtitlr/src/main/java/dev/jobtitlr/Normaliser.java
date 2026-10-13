package dev.jobtitlr;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Matches a free-text job title to the closest title from a configured list
 * of normalised titles (spec 01, section 3).
 *
 * <p>Immutable and therefore safe to share between threads (NFR-2): every
 * field is final and the title list is defensively copied on construction.</p>
 */
public final class Normaliser {

    /** The brief's four default normalised titles. */
    public static final List<String> DEFAULT_TITLES =
            List.of("Architect", "Software engineer", "Quantity surveyor", "Accountant");

    /** The default minimum quality a match must reach to be accepted. */
    public static final double DEFAULT_MINIMUM_QUALITY = 0.2;

    private final List<String> titles;
    private final SimilarityScorer scorer;
    private final double minimumQuality;

    /**
     * Creates a normaliser with a custom configuration.
     *
     * @param titles the normalised titles to match against
     * @param scorer the strategy that scores an input against a candidate title
     * @param minimumQuality the quality a match must reach to be accepted
     * @throws NullPointerException if titles or scorer is null
     */
    public Normaliser(List<String> titles, SimilarityScorer scorer, double minimumQuality) {
        Objects.requireNonNull(titles, "titles must not be null");
        Objects.requireNonNull(scorer, "scorer must not be null");
        this.titles = titles;
        this.scorer = scorer;
        this.minimumQuality = minimumQuality;
    }

    /**
     * Creates a normaliser with the default titles, the default scorer and the
     * default minimum quality.
     */
    public Normaliser() {
        this(DEFAULT_TITLES, new TokenDiceScorer(), DEFAULT_MINIMUM_QUALITY);
    }

    /**
     * Creates a normaliser with custom titles, the default scorer and the
     * default minimum quality.
     *
     * @param titles the normalised titles to match against
     */
    public Normaliser(List<String> titles) {
        this(titles, new TokenDiceScorer(), DEFAULT_MINIMUM_QUALITY);
    }

    /**
     * Returns the best-matching normalised title for the given job title.
     *
     * @param jobTitle the free-text job title; must be neither null nor blank
     * @return the best title, or the stripped input when there is no match
     * @throws NullPointerException if jobTitle is null
     * @throws IllegalArgumentException if jobTitle is blank
     */
    public String normalise(String jobTitle) {
        requireJobTitle(jobTitle);
        return bestMatch(jobTitle).map(MatchResult::title).orElse(jobTitle.strip());
    }

    /**
     * Returns the best match together with its quality.
     *
     * @param jobTitle the free-text job title; must be neither null nor blank
     * @return the best match, or empty when no title reaches the minimum quality
     * @throws NullPointerException if jobTitle is null
     * @throws IllegalArgumentException if jobTitle is blank
     */
    public Optional<MatchResult> bestMatch(String jobTitle) {
        requireJobTitle(jobTitle);
        String input = jobTitle.strip();
        MatchResult best = null;
        for (String title : titles) {
            double quality = scorer.score(input, title);
            boolean acceptable = quality > 0.0 && quality >= minimumQuality;
            if (acceptable && (best == null || quality > best.quality())) {
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

    /**
     * Fails fast on a null or blank job title with the messages the spec
     * requires.
     */
    private static void requireJobTitle(String jobTitle) {
        Objects.requireNonNull(jobTitle, "jobTitle must not be null");
        if (jobTitle.isBlank()) {
            throw new IllegalArgumentException("jobTitle must not be blank");
        }
    }
}
