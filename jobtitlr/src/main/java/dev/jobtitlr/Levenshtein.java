package dev.jobtitlr;

import java.util.Objects;

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
        Objects.requireNonNull(a, "a must not be null");
        Objects.requireNonNull(b, "b must not be null");
        if (a.equals(b)) {
            return 0;
        }
        int[] previous = new int[b.length() + 1];
        int[] current = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            previous[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                int substitution = previous[j - 1] + cost;
                int insertion = current[j - 1] + 1;
                int deletion = previous[j] + 1;
                current[j] = Math.min(substitution, Math.min(insertion, deletion));
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[b.length()];
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
        Objects.requireNonNull(a, "a must not be null");
        Objects.requireNonNull(b, "b must not be null");
        int max = Math.max(a.length(), b.length());
        if (max == 0) {
            return 1.0;
        }
        return 1.0 - (double) distance(a, b) / max;
    }
}
