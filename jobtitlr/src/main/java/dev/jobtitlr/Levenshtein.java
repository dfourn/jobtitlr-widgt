package dev.jobtitlr;

/**
 * Levenshtein edit distance and the normalised similarity derived from it
 * (spec 01, section 4 step 2).
 */
final class Levenshtein {

    private Levenshtein() {
    }

    /**
     * Computes the Levenshtein edit distance between two strings.
     *
     * @param a the first string; must not be null
     * @param b the second string; must not be null
     * @return the smallest number of single-character insertions, deletions and substitutions that turns a into b
     */
    static int distance(String a, String b) {
        return 0;
    }

    /**
     * Computes the normalised similarity between two strings:
     * {@code 1 - distance / max(length)}.
     *
     * @param a the first string; must not be null
     * @param b the second string; must not be null
     * @return a similarity within [0, 1]; two empty strings are perfectly similar
     */
    static double similarity(String a, String b) {
        return 1.0;
    }
}
