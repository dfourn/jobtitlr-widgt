package dev.jobtitlr;

import java.util.Objects;

/**
 * A normalised title paired with the quality of its match.
 *
 * @param title the normalised title, in its configured form; neither null nor blank
 * @param quality the similarity score that produced the match, within [0, 1]
 */
public record MatchResult(String title, double quality) {

    /**
     * Validates the components: the title is neither null nor blank, and the
     * quality is within [0, 1].
     *
     * @throws NullPointerException if the title is null
     * @throws IllegalArgumentException if the title is blank or the quality is outside [0, 1] or NaN
     */
    public MatchResult {
        Objects.requireNonNull(title, "title must not be null");
        if (title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        if (!(quality >= 0.0 && quality <= 1.0)) {
            throw new IllegalArgumentException("quality must be within [0, 1]: " + quality);
        }
    }
}
