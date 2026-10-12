package dev.jobtitlr;

/**
 * A normalised title paired with the quality of its match.
 *
 * @param title the normalised title, in its configured form; neither null nor blank
 * @param quality the similarity score that produced the match, within [0, 1]
 */
public record MatchResult(String title, double quality) {
}
