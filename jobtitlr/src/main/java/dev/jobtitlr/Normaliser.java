package dev.jobtitlr;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Matches a free-text job title to the closest title from a configured list
 * of normalised titles (spec 01, section 3).
 *
 * <p>Immutable (NFR-2): every field is final and the title list is
 * defensively copied on construction. An instance is therefore safe to share
 * between threads whenever its scorer is; the default {@link TokenDiceScorer}
 * is stateless, so a {@code new Normaliser()} always is.</p>
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
     * @param scorer the strategy that scores an input against a candidate title;
     *        it must be thread-safe if this normaliser is shared between threads
     * @param minimumQuality the quality a match must reach to be accepted
     * @throws NullPointerException if titles, scorer or a title element is null
     * @throws IllegalArgumentException if titles is empty, a title element is blank,
     *         two titles are equal ignoring case and surrounding whitespace, or
     *         minimumQuality is outside [0, 1] or NaN
     */
    public Normaliser(List<String> titles, SimilarityScorer scorer, double minimumQuality) {
        Objects.requireNonNull(titles, "titles must not be null");
        Objects.requireNonNull(scorer, "scorer must not be null");
        // Snapshot the caller's list once and validate the snapshot, so a
        // concurrent mutation of the caller's list cannot slip an unvalidated
        // title past validation between the two passes.
        List<String> snapshot = new ArrayList<>(titles);
        if (snapshot.isEmpty()) {
            throw new IllegalArgumentException("titles must not be empty");
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < snapshot.size(); i++) {
            String title = snapshot.get(i);
            Objects.requireNonNull(title, "titles[" + i + "] must not be null");
            if (title.isBlank()) {
                throw new IllegalArgumentException("titles[" + i + "] must not be blank");
            }
            String key = title.strip().toLowerCase(Locale.ROOT);
            if (!seen.add(key)) {
                throw new IllegalArgumentException("duplicate title: \"" + key + "\"");
            }
        }
        if (!(minimumQuality >= 0.0 && minimumQuality <= 1.0)) {
            throw new IllegalArgumentException("minimumQuality must be within [0, 1]: " + minimumQuality);
        }
        this.titles = List.copyOf(snapshot);
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
     * @throws IllegalStateException if the scorer returns a value outside [0, 1] or NaN
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
     * @throws IllegalStateException if the scorer returns a value outside [0, 1] or NaN
     */
    public Optional<MatchResult> bestMatch(String jobTitle) {
        requireJobTitle(jobTitle);
        String input = jobTitle.strip();
        MatchResult best = null;
        for (String title : titles) {
            double quality = scorer.score(input, title);
            if (!(quality >= 0.0 && quality <= 1.0)) {
                throw new IllegalStateException("scorer returned " + quality + " for \"" + input + "\" and \""
                        + title + "\"; expected a value within [0, 1]");
            }
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
     * @return the titles, stored exactly as configured, in an unmodifiable list
     */
    public List<String> normalisedTitles() {
        return titles;
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
