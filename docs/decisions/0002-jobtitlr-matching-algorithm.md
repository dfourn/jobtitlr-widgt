# ADR 0002: Matching algorithm for jobtitlr

- Status: Accepted
- Date: 2026-10-13
- Context: brief B1.4 ("internally, use a quality score q with 0.0 <= q <= 1.0 to find the closest match")

## Context
The `Normaliser` maps a free-text job title to the closest title from a fixed list (B1.1), by default the four titles in B1.2, guided by an internal quality score q within [0, 1] (B1.4). Inputs are free text, so whatever algorithm we pick has to:
1. Get the brief's examples right (B1.3): "Java engineer" and "C# engineer" -> "Software engineer", "Accountant" -> "Accountant", "Chief Accountant" -> "Accountant".
2. Tolerate case, whitespace, punctuation, small typos and plurals (spec 01 §2).
3. Return no match for an unrelated title such as "Chef", rather than force a weak one (spec 01 §4, AC-6.1).
4. Be deterministic (spec 01 AC-5.3) and add no runtime dependencies or network access (spec 01 NFR-1, §8).
5. Be explainable in the interview that follows the assessment; the brief says to "be ready to answer technical questions about the submission".

## Options considered
| Option | For | Against |
|---|---|---|
| Whole-string Levenshtein | Gets the brief's four examples right. | "Chief Accountant" only reaches 0.625, and "Chef" -> "Architect" at 0.333, above the 0.2 floor: a false match. |
| Jaro-Winkler | Ranks "Chief Accountant" correctly: "Accountant" 0.842 against "Architect" 0.67. | "Chef" -> "Architect" at 0.574, above the floor, and the 0.842 against 0.67 margin is thin. It rewards shared prefixes and suits short names, not multi-word titles. |
| TF-IDF | — | With four titles the IDF is degenerate, and without character n-grams it has no typo tolerance. |
| Embeddings | An embedding-based scorer would plug into the same `SimilarityScorer` interface (spec 01 §8). | Need the network and an API key, are not deterministic, and are hard to explain line by line (spec 01 §8). |
| **Token Dice + per-token Levenshtein (chosen)** | "Chef" scores 0.0; word order does not matter; extra and missing words are both penalised; typos are tolerated per token; deterministic; about 60 lines; every number is explainable. | The thresholds come from worked examples rather than data, and synonyms are out of reach without a lexicon. |

## Decision
**Token Dice with per-token Levenshtein: token threshold 0.8, minimum quality 0.2.**

- Both strings are tokenised; two tokens match only when their normalised Levenshtein similarity (`1 - distance / max(length)`) is at least 0.8. Matched pairs are assigned one-to-one, best first, and `q = 2 * sum(matched similarities) / (inputTokenCount + candidateTokenCount)` (spec 01 §4).
- The highest q wins; on a tie the title listed first wins; a match is accepted only when `q > 0` and `q >= minimumQuality` (spec 01 §4).
- Both thresholds are configurable (`new TokenDiceScorer(double)`, `new Normaliser(titles, scorer, minimumQuality)`), and the whole scorer is swappable through `SimilarityScorer` (spec 01 §3).

## Consequences
- The token threshold (0.8) and minimum quality (0.2) were chosen from the brief's examples and the worked examples in spec 01 §4, not from data (A-J8). Both are configurable.
- Synonyms such as "developer" -> "engineer" are not handled (spec 01 §2); a Phase 2 lexicon would add them.
- The scorer is deterministic, needs no dependencies or network access, and every q in spec 01 §4's worked examples can be recomputed by hand.
- Each call scores every configured title, which is fine for a four-title list; spec 01 §8 notes an inverted index as the route to scale.
