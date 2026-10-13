package dev.jobtitlr;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Splits a job title into the tokens the matching algorithm works on.
 *
 * <p>Tokenisation lowercases with {@link Locale#ROOT}, replaces every character
 * that is not a letter, digit, {@code #} or {@code +} with a space, strips the
 * result and splits it on whitespace. A string with no tokens yields an empty
 * list.</p>
 */
final class Tokeniser {

    /** Every character that is not a letter, digit, {@code #} or {@code +}. */
    private static final Pattern SEPARATOR = Pattern.compile("[^\\p{L}\\p{N}#+]");

    /** One or more whitespace characters. */
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private Tokeniser() {
    }

    /**
     * Tokenises the given text.
     *
     * @param text the text to tokenise; must not be null
     * @return the tokens in order, empty when the text holds no letters, digits, {@code #} or {@code +}
     */
    static List<String> tokenise(String text) {
        Objects.requireNonNull(text, "text must not be null");
        String cleaned = SEPARATOR.matcher(text.toLowerCase(Locale.ROOT)).replaceAll(" ").strip();
        if (cleaned.isEmpty()) {
            return List.of();
        }
        return List.of(WHITESPACE.split(cleaned));
    }
}
