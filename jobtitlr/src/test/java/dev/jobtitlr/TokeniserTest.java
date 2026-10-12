package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertIterableEquals;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Tests for {@link Tokeniser} (spec 01, section 4 step 1). */
class TokeniserTest {

    @Test
    @DisplayName("AC-2.1 lowercases with Locale.ROOT: \"JAVA ENGINEER\" -> [java, engineer]")
    void lowercasesWithLocaleRoot() {
        assertIterableEquals(List.of("java", "engineer"), Tokeniser.tokenise("JAVA ENGINEER"));
    }

    @Test
    @DisplayName("AC-2.2 ignores leading, trailing and repeated whitespace")
    void ignoresWhitespace() {
        assertIterableEquals(List.of("java", "engineer"), Tokeniser.tokenise("  java   engineer "));
    }

    @ParameterizedTest(name = "{0} {1} -> [{2}]")
    @CsvSource({
            "AC-2.3, 'Software-engineer', software engineer",
            "AC-2.3, 'Accountant (ACCA)', accountant acca"
    })
    @DisplayName("AC-2.3 splits on punctuation")
    void splitsOnPunctuation(String id, String text, String expected) {
        assertIterableEquals(List.of(expected.split(" ")), Tokeniser.tokenise(text));
    }

    @ParameterizedTest(name = "{0} {1} -> [{2}]")
    @CsvSource({
            "AC-2.4, C# Engineer, c# engineer",
            "AC-2.4, C++ developer, c++ developer"
    })
    @DisplayName("AC-2.4 keeps # and + inside tokens: \"C# Engineer\", \"C++ developer\"")
    void keepsHashAndPlus(String id, String text, String expected) {
        assertIterableEquals(List.of(expected.split(" ")), Tokeniser.tokenise(text));
    }

    @ParameterizedTest(name = "{0} {1} -> []")
    @CsvSource({
            "AC-7.3, '!!!'",
            "AC-7.3, ' - '",
            "AC-7.3, '...'"
    })
    @DisplayName("AC-7.3 returns no tokens for punctuation only")
    void returnsNoTokensForPunctuationOnly(String id, String text) {
        assertIterableEquals(List.of(), Tokeniser.tokenise(text));
    }
}
