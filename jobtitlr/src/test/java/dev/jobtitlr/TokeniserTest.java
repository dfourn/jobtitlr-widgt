package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertIterableEquals;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Tests for {@link Tokeniser} (spec 01, section 4 step 1). */
class TokeniserTest {

    @Test
    @DisplayName("AC-2.1 lowercases with Locale.ROOT: \"JAVA ENGINEER\" -> [java, engineer]")
    void lowercasesWithLocaleRoot() {
        assertIterableEquals(List.of("java", "engineer"), Tokeniser.tokenise("JAVA ENGINEER"));
    }
}
