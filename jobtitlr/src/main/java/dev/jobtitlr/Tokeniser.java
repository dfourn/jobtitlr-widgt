package dev.jobtitlr;

import java.util.List;
import java.util.Locale;

/**
 * Splits a job title into the tokens the matching algorithm works on.
 *
 * <p>Tokenisation lowercases with {@link Locale#ROOT}, replaces every character
 * that is not a letter, digit, {@code #} or {@code +} with a space, strips the
 * result and splits it on whitespace. A string with no tokens yields an empty
 * list.</p>
 */
final class Tokeniser {

    private Tokeniser() {
    }

    /**
     * Tokenises the given text.
     *
     * @param text the text to tokenise; must not be null
     * @return the tokens in order, empty when the text holds no letters, digits, {@code #} or {@code +}
     */
    static List<String> tokenise(String text) {
        return List.of(text.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]", " ")
                .strip()
                .split("\\s+"));
    }
}
