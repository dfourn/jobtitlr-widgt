package dev.jobtitlr;

/** Runs the brief's sample code (B1.5) on the brief's four examples (B1.3). */
public final class Demo {
    private Demo() {
    }

    public static void main(String[] args) {
        for (String jt : new String[] {"Java engineer", "C# engineer", "Accountant", "Chief Accountant"}) {
            Normaliser n = new Normaliser();
            String normalisedTitle = n.normalise(jt);
            System.out.println(jt + " -> " + normalisedTitle);
        }
    }
}
