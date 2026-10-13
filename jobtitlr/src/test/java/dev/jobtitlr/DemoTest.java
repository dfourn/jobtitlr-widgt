package dev.jobtitlr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Tests for {@link Demo} (spec 01, AC-1.5). */
class DemoTest {

    @Test
    @DisplayName("AC-1.5 Demo prints the brief's four examples using the sample code unchanged")
    void demoPrintsTheBriefsFourExamples() {
        PrintStream originalOut = System.out;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setOut(new PrintStream(captured));
        try {
            Demo.main(new String[0]);
        } finally {
            System.setOut(originalOut);
        }
        String lineSeparator = System.lineSeparator();
        assertEquals("Java engineer -> Software engineer" + lineSeparator
                + "C# engineer -> Software engineer" + lineSeparator
                + "Accountant -> Accountant" + lineSeparator
                + "Chief Accountant -> Accountant" + lineSeparator,
                captured.toString());
    }
}
