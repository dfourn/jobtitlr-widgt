# Assumptions

> **How to read this file.** In a real product team I would raise each of these points with product, design or the stakeholder **before** building. This is an interview assessment, not production, so there is nobody to ask. I picked the most sensible option, wrote it down here, and built it so that it is **cheap to change** if the answer turns out to be different. Each entry says who I would normally ask and what changing it would cost.

Status values: `assumed` (my call, not confirmed) · `confirmed` (by the brief or by the reviewer).

---

## Part 1: jobtitlr

| ID | Assumption | Why | Normally I'd ask | Cost to change |
|---|---|---|---|---|
| A-J1 | When nothing matches, `normalise()` returns the trimmed input unchanged. `bestMatch()` returns `Optional.empty()`. | No data is lost, and the brief's simple sample code never has to handle `null`. Callers who care can still tell that nothing matched. | Product: should an unknown title pass through, be flagged, or be rejected? | Low. The behaviour lives in one method, and spec 01 O-1 lists the alternatives. |
| A-J2 | Seniority words (chief, senior, head of, ...) do not change the category. They are kept as structured data in the extension layer, not thrown away. | The brief's own example is Chief Accountant -> Accountant. UK SOC 2020 coding rules do the same thing. | Product / data: is seniority needed downstream? | Low. It is a lexicon file plus `ParsedTitle.seniority`. |
| A-J3 | When two titles score the same, the one listed first wins. | Results are deterministic and the caller controls priority by ordering the list. | Product | Low. It is one comparator. |
| A-J4 | The title is returned in exactly the form it was configured with, for example `Software engineer`. | The list of ideal titles is the source of truth. | none | none |
| A-J5 | Input is English, and tokenising is locale-independent (`Locale.ROOT`). | The brief only has English examples. `Locale.ROOT` avoids the Turkish-i bug. | Product: which markets? | Medium. Synonyms and seniority words would need a lexicon per language. |
| A-J6 | Creating new categories from data is an **opt-in extension**. `new Normaliser().normalise(...)` behaves exactly as the brief describes. | The brief says "provided with a list", so a list that grows is a fair extension, but the basic contract must not change. | Product: who approves a new category? I'd propose a human-in-the-loop "provisional" state. | Low. It is a separate class that composes the core. |
| A-J7 | A new category is only proposed once at least 3 unmatched titles cluster together, and it stays *provisional* until someone accepts it. | One-off typos and noise should not create categories. | Product / data governance | Low. `minSupport` is a configuration value. |
| A-J8 | Default thresholds: token similarity >= 0.8 and overall quality q >= 0.2. | Chosen from the brief's examples and the worked examples in spec 01 §4 (see spec 01 O-2, O-3). | Data: what is a false match worth compared with a missed match? | Low. Both are configurable. |

## Part 2: widgt (product rating widget)

| ID | Assumption | Why | Normally I'd ask | Cost to change |
|---|---|---|---|---|
| A-W1 | **Interactions.** Each row in the star breakdown is a toggle button. Clicking it, or pressing Enter/Space, selects that star rating (`aria-pressed="true"`) and calls `onRatingSelect(rating)`. Pressing the selected row again clears the selection (`onRatingSelect(null)`). The widget does not filter anything itself; the host page decides what to do. | The brief asks for tests of "user interactions", but the design is static. Filtering reviews by star rating is the most natural interaction on a rating summary and is common practice for review widgets. Leaving the filtering to the host keeps the widget reusable. | **Product and design.** Is it interactive at all? Toggle or link? What does a selected row look like? | Low. The prop is optional, and without it the rows render as plain, non-interactive content. |
| A-W2 | **The feefo logo is a placeholder** cropped from the supplied screenshot (`94x24` PNG). | No official asset was supplied, and I would rather not have a brand mark redrawn by hand or by AI. | Design / brand: the official SVG. | Trivial. Swap one file. |
| A-W3 | **Bar length = that rating's count / total count**, not count / largest count. | Measured from the reference: the 952 bar fills about 77% of the track, and 952/1232 = 77.3%. | Design | Trivial. One pure function. |
| A-W4 | **The stars are partially filled to the exact fraction** of the score (4.6 -> the fifth star is 60% filled), not rounded to half stars. | Measured from the reference (about 60% fill). | Design | Low. One pure function. |
| A-W5 | The score is the mean of the star counts, shown to **1 decimal place** ("4.6 OUT OF 5"). | 5677/1232 = 4.608, which matches the design. | Product: is the score computed by the client or supplied by the API? | Low. The widget also accepts a pre-computed `average`. |
| A-W6 | **Label thresholds** ("EXCELLENT"): >= 4.5 Excellent, >= 4.0 Very good, >= 3.0 Good, >= 2.0 Fair, otherwise Poor. | Only "Excellent at 4.6" is known. The rest are placeholders, and the mapping can be injected. | Product / brand: Feefo's real bands. | Trivial. A config object. |
| A-W7 | Data arrives as **counts per star (1-5)** through props, with no fetching in the component. With zero reviews the widget shows an empty state instead of dividing by zero. | Separating data from presentation makes the widget easy to test. In production a container or hook would fetch the data. | Backend: the shape of the API. | Low. Only an adapter changes. |
| A-W8 | **Responsiveness is driven by the widget's container (CSS container queries), not only by the viewport.** It is fluid between about 260px and 420px wide, and on narrow widths the count column stays visible. | A review widget gets embedded in other people's layouts (sidebars, product pages). The space it is given matters more than the screen size. | Design: the breakpoint behaviour. | Low. It is all CSS. |
| A-W9 | **Poppins is self-hosted** through `@fontsource/poppins`, not loaded from the Google Fonts CDN. | No third-party request (privacy/GDPR), it works offline, and screenshots render the same way every time. | Platform: whether fonts are already loaded by the host. | Trivial. |
| A-W10 | Text is written in sentence case and **displayed in uppercase with CSS** (`text-transform`). | Screen readers then read "Excellent", not "E-X-C-E-L-L-E-N-T". | none | none |
| A-W11 | Numbers are formatted for the `en-GB` locale (`1,232`), and the locale can be passed in. | Feefo is a UK company. | Product: i18n | Low |
| A-W12 | Target browsers are current evergreen browsers (container queries are supported since 2023). | It is an assessment. | Product | Low. A media-query fallback is easy to add. |

## Process

| ID | Assumption | Why |
|---|---|---|
| A-P1 | Both parts live in one repository, in separate folders. | The brief allows "your GitHub repository". One link makes it easier for reviewers. |
| A-P2 | AI assistance is allowed as long as it is disclosed. | The brief does not forbid it, and the hiring team encouraged it. Everything is disclosed in `docs/AI-USAGE.md`. |
| A-P3 | Commit timestamps are real. Nothing is backdated or rewritten to look different from how it happened. | Honesty. The history is meant to show the process. |
