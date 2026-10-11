# Research: standardising job titles (2026-10-11, Claude subagent)

## What reviewers will recognise
- **ESCO v1.2.1**: about 3,039 occupations. Each has a preferred label and alternative labels, and maps to one ISCO-08 code. Free to use, including commercially, as long as use is acknowledged. https://esco.ec.europa.eu/en/classification/occupation_main
- **O\*NET**: the Alternate Titles file has about 56k rows, including a "Short Title" column for abbreviations. Licensed CC BY 4.0: credit USDOL/ETA, state the version, and say what was changed. https://onetcenter.org/license_db.html
- **UK SOC 2020** (a good fit, since "quantity surveyor" in the brief suggests a UK context): its coding rules say prefixes such as *apprentice, assistant, chief, deputy, head, principal, senior, trainee* are normally ignored, with listed exceptions. Licensed under OGL v3. https://www.ons.gov.uk/methodology/classificationsandstandards/standardoccupationalclassificationsoc/soc2020/soc2020volume2codingrulesandconventions
- **LinkedIn** (patent US9886498): splits a title into a prefix (seniority), a core (the function) and a suffix (location or company), and drops the prefix and suffix. The canonical name is the highest-frequency n-gram. https://patents.google.com/patent/US9886498
- **Lightcast**: proprietary and API-only. Worth mentioning, but not something to build on.

Verdict: ship a small hand-picked seed taxonomy, for example `taxonomy.tsv` with columns id, code, preferredLabel and altLabels. Record the source and version, and add a NOTICE file.

## Pipeline
1. **Normalise**: NFKD, strip diacritics, lowercase, `&` -> `and`, turn punctuation into spaces, collapse whitespace, and singularise with a short list of exceptions (sales, analysis, business).
2. **Extract modifiers** into `ParsedTitle(core, seniority, specialisms, qualifiers)`. Handle "head of X" first. Keep a protected-phrase list (chief executive, head chef). Never discard information: keep what is stripped as structured data.
3. **Expand synonyms and abbreviations**, longest match first, before fuzzy matching. This is what makes "Java developer" and "Java engineer" end up with the same core.
4. **Score** against each preferred and alternative label, and take the maximum for each category.
5. **Decide**: `Matched` (q >= tau), `Ambiguous` (gap between the top two < delta), or `NoMatch`. Model these as a sealed interface and use a switch with pattern matching.
6. **Cluster** unmatched titles: leader clustering on the core, compared against the medoid rather than a running centroid. The cluster's name is its most frequent core, with ties broken by the medoid and then lexicographically. A cluster is promoted at minSupport.
   - Pitfalls: results depend on input order (sort first, or do a reassignment pass), drift, chaining, specialism-only titles.

## Tests
- **Metamorphic** (stated as properties):
  - Changing case, whitespace or punctuation leaves the result unchanged.
  - Adding or removing seniority keeps the category and changes only the modifier.
  - One typo in a word of 5 or more characters is tolerated.
  - Swapping a synonym for its expansion leaves the result unchanged.
  - Normalisation is idempotent.
  - Permuting the clustering input gives a stable result, or the instability is documented.
- **Golden CSV** (about 150 rows, including negatives): `@ParameterizedTest @CsvFileSource`, plus an aggregate test that gates accuracy and per-class precision/recall and prints a confusion matrix.
- **PIT**: pitest-maven 1.30.0 with pitest-junit5-plugin 1.2.3, using `mutationThreshold`. Check these versions before pinning.
- **ArchUnit** (archunit-junit5 1.5.1): for example, the core must not depend on IO or LLM packages. Nice to have.
- **jqwik**: 1.10.x runs on the JUnit Platform (Jupiter 5.14.x; it does not support JUnit 6). **Since 1.10 it includes an "Anti-AI Usage Clause"**, so either pin 1.9.3 or write our own seeded-random property tests.

## Optional LLM use
- `LlmSimilarityScorer` behind `SimilarityScorer`, opt-in.
- `ClusterNamer` with `FrequencyNamer` as the default and an LLM implementation that only suggests names. Its output goes back through the same pipeline and is recorded with its provenance.
- Embeddings (JobBERT, arXiv 2109.09605) as future work.
- Tests never touch the network.
