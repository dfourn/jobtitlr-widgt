# Spec 02: widgt - product rating summary widget

| | |
|---|---|
| Status | **Accepted** |
| Project | `widgt/` |
| Stack | React 19, TypeScript (strict), Vite, CSS Modules, Vitest, Testing Library, Playwright |
| Brief | Part 2 (`docs/brief/README.md`, B2.1-B2.17) |
| Assumptions | A-W1 to A-W12 (`docs/ASSUMPTIONS.md`) |

## 1. Problem

Reproduce the supplied rating widget (`docs/brief/widget-reference.png`) as a production-quality React component. The brief marks the **approach**: component design, TypeScript modelling, responsiveness, accessibility, testing and maintainability (B2.17). It does not mark pixel perfection.

## 2. Anatomy

```
<ProductRating>                    section, accessible name "Product rating"
 ├─ <RatingLabel>                  "Excellent"  (shown uppercase via CSS)
 ├─ <StarRow value={4.6}>          5 x <Star fill={0..1}>, decorative, aria-hidden
 ├─ <ScoreText>                    "4.6 out of 5"
 ├─ <BrandLine>                    "Product Rating" + feefo logo (img alt="feefo")
 └─ <RatingBreakdown>              <ul>
      └─ <BreakdownRow> x 5        5 -> 1: rating, small star, bar, count
```

## 3. Public API

```ts
export type StarRating = 1 | 2 | 3 | 4 | 5;
export type RatingCounts = Readonly<Record<StarRating, number>>;

export interface ProductRatingProps {
  counts: RatingCounts;                         // the only required input
  heading?: string;                             // default "Product Rating"
  locale?: string;                              // default "en-GB"
  labelFor?: (score: number) => string;         // receives the rounded score; default bands (A-W6)
  selectedRating?: StarRating | null;           // controlled mode (optional)
  onRatingSelect?: (rating: StarRating | null) => void; // rows become toggles when set
}
```

Usage:

```tsx
<ProductRating counts={{ 5: 952, 4: 171, 3: 55, 2: 14, 1: 40 }} onRatingSelect={setFilter} />
```

Errors: the widget validates its counts and throws during render (fail fast, AC-2.3). It does not catch its own error. The host either validates at its data boundary with the exported `validateCounts`, or wraps the widget in an error boundary.

## 4. Domain rules (pure functions in `src/domain/rating.ts`, no React)

| Function | Rule |
|---|---|
| `totalOf(counts)` | Sum of the counts. |
| `averageOf(counts)` | Σ(star × count) / total. Returns `null` when total = 0. |
| `roundScore(avg)` | Rounds to 1 decimal place, half-up (4.608 -> 4.6, 4.65 -> 4.7). |
| `starFills(score)` | Five fractions in [0, 1]. Uses the **rounded** score so the stars and the text always agree: 4.6 -> `[1, 1, 1, 1, 0.6]`. |
| `shareOf(count, total)` | count / total in [0, 1]. Returns 0 when total = 0 (A-W3). |
| `defaultLabelFor(score)` | >= 4.5 Excellent · >= 4.0 Very good · >= 3.0 Good · >= 2.0 Fair · otherwise Poor (A-W6). |
| `validateCounts(counts)` | The keys must be exactly 1-5, and every count a finite integer >= 0. A missing or unknown key, or an invalid count, throws a `RangeError` naming it. A non-object throws a `TypeError`. |

## 5. Acceptance criteria

### AC-1 Renders the design (B2.1, B2.2)
- **AC-1.1** With the reference data, the widget shows the label "Excellent", the text "4.6 out of 5", the heading "Product Rating" and the feefo logo.
- **AC-1.2** The breakdown has exactly 5 rows, ordered 5 down to 1, with counts 952, 171, 55, 14 and 40.
- **AC-1.3** Each bar's fill width equals that rating's share of the total (952 -> 77.3%).
- **AC-1.4** The stars show `[1, 1, 1, 1, 0.6]`, and the fifth star is filled to 60%.
- **AC-1.5** Counts are formatted for the locale (`1232` -> `1,232` for en-GB).

### AC-2 Domain logic (B2.5, B2.6)
- **AC-2.1** The functions in section 4 behave as described there, including the rounding edge cases (x.x5 values, 5.0, 1.0).
- **AC-2.2** With zero reviews, the widget shows "No reviews yet". No stars are filled, it does not divide by zero, and no NaN is rendered.
- **AC-2.3** Invalid counts (negative, NaN, a fraction, Infinity), or a missing or unknown key, throw a `RangeError` (fail fast).
- **AC-2.4** `labelFor` can be overridden. It receives the rounded score, so the label matches the number shown.

### AC-3 Accessibility (B2.7, B2.8)
- **AC-3.1** The widget is a `<section>` named "Product rating" (or named by its visible heading).
- **AC-3.2** The star graphic is hidden from assistive technology. A text alternative "Rated 4.6 out of 5" is exposed (the visible score text may serve).
- **AC-3.3** The breakdown is a list (`<ul>`/`<li>`). Each row has the accessible name "N stars: C reviews (P%)" ("1 star" in the singular).
- **AC-3.4** Visible uppercase text is uppercase through CSS only. The DOM text is sentence case.
- **AC-3.5** The logo is an `<img>` with `alt="feefo"`. The decorative small stars have `alt=""` or `aria-hidden`.
- **AC-3.6** axe-core reports **0 violations** at WCAG 2.2 AA in the default, static and selected states.
- **AC-3.7** Interactive rows have a visible focus indicator (`:focus-visible`) with at least 3:1 contrast.

### AC-4 Interactions (B2.9, A-W1)
- **AC-4.1** Without `onRatingSelect`, the rows are not interactive: there are no buttons and they are not tab stops.
- **AC-4.2** With `onRatingSelect`, each row is a `<button aria-pressed>`. Clicking an unselected row calls `onRatingSelect(n)` and sets `aria-pressed="true"`.
- **AC-4.3** Clicking the selected row again calls `onRatingSelect(null)` and clears it.
- **AC-4.4** Selecting another row moves the selection. Only one row is ever pressed.
- **AC-4.5** Keyboard: Tab reaches the rows in order 5 -> 1. Enter and Space toggle them.
- **AC-4.6** Controlled mode: when `selectedRating` is given, it decides which row is pressed, and clicking only calls the callback.
- **AC-4.7** A selected row is visually distinct, not by colour alone (for example a border plus weight).

### AC-5 Responsive (B2.3, A-W8)
- **AC-5.1** The widget fills its container between 260px and 420px wide, and is centred with a max width beyond that.
- **AC-5.2** At viewport widths 320, 768 and 1280 there is no horizontal overflow and no clipped or overlapping text.
- **AC-5.3** Layout adapts to the **container** width (container queries). At narrow widths the spacing tightens and the counts stay visible.
- **AC-5.4** Text uses relative units, so the widget stays usable at 200% browser zoom.

### AC-6 Visual fidelity (B2.2, B2.11)
- **AC-6.1** The font is Poppins, self-hosted (A-W9).
- **AC-6.2** Colours come from design tokens matching the measured reference: yellow `#ffcb31`, track `#e2e2e2`, empty star `#d4d4d4`, dark text `#25292f`, muted text `#646c76`.
- **AC-6.3** The widget's own screenshot (in the 360px `?visual=1` wrapper) is compared with the reference card on foreground pixels (spec 03, section 3). The similarity is a soft signal that adds to the score; there is no pass threshold and it is not a gate.

### AC-7 Code quality (B2.4, B2.5, B2.6)
- **AC-7.1** TypeScript `strict`, with no `any` and no non-null `!` assertions in `src/`.
- **AC-7.2** ESLint passes with no warnings.
- **AC-7.3** Domain logic lives in `src/domain/`. Components hold no arithmetic beyond formatting. ESLint keeps React (`react`, `react-dom` and their subpaths) and `import.meta` out of `src/domain/`.
- **AC-7.4** Every component has typed props and lives in its own folder with its CSS Module and tests.

### AC-8 Delivery (B2.13, B2.15)
- **AC-8.1** `npm ci && npm run dev` shows a demo page. `npm test` runs unit and component tests. `npm run test:e2e` runs Playwright. `npm run verify` runs every check.
- **AC-8.2** The README covers setup, scripts, design decisions (linking ADRs), and the assumptions.

## 6. Tests

- **Unit** (Vitest): `src/domain/*.test.ts`. Table-driven and test-first.
- **Component** (Vitest, Testing Library, user-event, jest-dom): `*.test.tsx` next to each component. Queries by role and name, never by class.
- **Contract / E2E** (Playwright): `review/contract/*.spec.ts`. Covers interactions, axe, the three viewports and the screenshot. Written from this spec **before** the components exist (they start red), and locked once written (see spec 03).
- Every test name starts with its AC ID, for example `AC-4.3 clicking the selected row clears it`.

## 7. Out of scope
- Fetching data, and the list of reviews the selection would filter (the host page owns that).
- Theming beyond tokens, dark mode and RTL. These are mentioned as future work.
- Packaging as an npm library or web component. Future work: Shadow DOM for style isolation when embedded in third-party sites.

## 8. Demo page contract (used by the Playwright contract tests)

`npm run dev` and `npm run preview` serve `/`, which renders the widget with the reference data. Query parameters choose the scenario:

| URL | Renders |
|---|---|
| `/` | Interactive mode: `onRatingSelect` is wired to page state. Below the widget, an element with `role="status"` and `data-testid="selection"` shows `Selected: none` or `Selected: N stars` (singular for 1). |
| `/?interactive=0` | Static mode: no `onRatingSelect`. |
| `/?empty=1` | All counts are 0, in interactive mode. |
| `/?visual=1` | Static mode. Only the widget, on a white page with no margin, in a wrapper exactly **360px** wide (the reference card's width). The widget's accessibility tree matches `/?interactive=0`. The whole page shows no images other than the feefo logo (its only `<img>`): no CSS images except SVG masks and clips, and no embedded or SVG images. The widget and its ancestors are fully opaque and visible. Used for screenshot comparison with the card in the 401x443 reference. |

The widget is the only element with `data-testid="product-rating"`. The page has one `<main>` landmark, and its `<h1>` reads "widgt demo" (visually hidden in `?visual=1`).
