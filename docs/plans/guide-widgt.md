# Build guide: the product rating widget (Phase 3)

Companion to [`master-plan.md`](master-plan.md). It is written for the **generator** (the agent that writes the widget in each loop iteration) and for the people and agents who review it. Paths are relative to `widgt/` unless they start with `docs/`. Line numbers are as of commit `eb24100`.

**What gets marked (B2.17):** *how* it is built: component design, TypeScript modelling, responsiveness, accessibility, tests and maintainability. Pixels matter less. The code must be explainable line by line, so prefer plain, obvious code over clever code.

**You cannot run the contract tests** (Playwright is not on your allow list). This guide tells you what they check. Build to it exactly.

---

## 1. Scope

| You may create or edit | You must not touch |
|---|---|
| `src/components/**` | `src/domain/**` (its export list is pinned by `src/domain/index.test.ts`) |
| `src/demo/**` | `src/main.tsx`, `index.html` |
| `src/styles/**` (keep the three `@fontsource/poppins` imports in `global.css`) | `review/**` (do not even open it) |
| `src/App.tsx`, `src/App.module.css`, `src/App.test.tsx` | `package.json`, `package-lock.json`, `eslint.config.js`, `tsconfig*.json`, `vite.config.ts` |
| `src/css-custom-properties.d.ts` | `src/test/**`, `src/assets/**`, `src/vite-env.d.ts` |
| | Any new root config (`.npmrc`, `vitest.config.*`, `postcss.config.*`, ...) |

Commands you may run: `npm test`, `npx vitest run <file>`, `npm run typecheck`, `npm run lint`, `npm run build`. **No git, no `npm install`, no new dependencies.**

**Text that fails gate G5, even inside a comment or a string:** `.skip(`, `.only(`, `xit(`, `xdescribe(`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`. ESLint also bans `any`, non-null `!`, and lint warnings of any kind (`--max-warnings 0`).

---

## 2. The domain API (use it; do no arithmetic in components)

Import only from `src/domain` (the barrel, `src/domain/index.ts`):

```ts
type StarRating = 1 | 2 | 3 | 4 | 5;
type RatingCounts = Readonly<Record<StarRating, number>>;
const STAR_RATINGS: readonly [5, 4, 3, 2, 1];
type StarFills = readonly [number, number, number, number, number];
type LabelFor = (score: number) => string;
const defaultLabelFor: LabelFor;                        // 4.6 -> "Excellent"
interface RatingRowModel { readonly rating: StarRating; readonly count: number; readonly share: number }
type RatingSummaryModel =
  | { kind: 'rated'; total: number; average: number; score: number; label: string; fills: StarFills; rows: readonly RatingRowModel[] }
  | { kind: 'empty'; total: 0; average: null; score: null; label: null; fills: StarFills; rows: readonly RatingRowModel[] };
function summarise(counts: RatingCounts, labelFor?: LabelFor): RatingSummaryModel; // validates (throws RangeError), rows 5 -> 1
function validateCounts(input: unknown): RatingCounts;
const DEFAULT_LOCALE = 'en-GB';
function formatCount(count: number, locale?: string): string;    // 1232 -> "1,232"
function formatPercent(share: number, locale?: string): string;  // 0.7727 -> "77.3%"
```

Call `summarise(counts, labelFor)` **once** in `ProductRating` and render from its result. The domain has no score formatter and no row-name builder. Both are string formatting, which components may do (AC-7.3):
- score: `new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(score)`, so 5 shows as "5.0" (A-W5)
- row name: §6, `rowName.ts`

---

## 3. The demo page (spec 02 §8)

Reference data: `{ 5: 952, 4: 171, 3: 55, 2: 14, 1: 40 }` (total 1232, average 4.608, shown as 4.6).

| URL | Must render |
|---|---|
| `/` | Interactive: `onRatingSelect` wired to page state. **Below** the widget (outside the `<section>`): `<p role="status" data-testid="selection">` showing `Selected: none`, `Selected: 5 stars`, ... `Selected: 1 star` (exact text, singular for 1). |
| `/?interactive=0` | Static: no `onRatingSelect`, no status element. |
| `/?empty=1` | All counts 0, interactive. |
| `/?visual=1` | Static. Only the widget, inside a wrapper **exactly 360px wide**, on a white page with no margin. The `<h1>` is visually hidden. No status element. |

On every page: exactly one `data-testid="product-rating"` (the widget root), one `<main>`, and an `<h1>` reading `widgt demo`.

**Design** (`main.tsx` is off limits and renders `<App />` with no props, so App reads the URL itself):

```ts
// src/demo/scenario.ts
export interface Scenario { readonly interactive: boolean; readonly empty: boolean; readonly visual: boolean }
export function parseScenario(search: string): Scenario {
  const params = new URLSearchParams(search);
  const visual = params.get('visual') === '1';
  return { visual, empty: params.get('empty') === '1', interactive: !visual && params.get('interactive') !== '0' };
}
// src/demo/data.ts: REFERENCE_COUNTS and EMPTY_COUNTS, typed RatingCounts
// src/demo/selectionText.ts: (rating: StarRating | null) => 'Selected: none' | 'Selected: N stars' | 'Selected: 1 star'
```

```tsx
// src/App.tsx (shape, not final code)
const PAGE_SCENARIO = parseScenario(window.location.search);     // module level: never read globals during render

export interface AppProps { readonly scenario?: Scenario }        // tests pass a scenario; the page uses the URL
export function App({ scenario = PAGE_SCENARIO }: AppProps) {
  const [selected, setSelected] = useState<StarRating | null>(null);
  const counts = scenario.empty ? EMPTY_COUNTS : REFERENCE_COUNTS;
  if (scenario.visual) {
    return (
      <main className={styles.visualPage}>
        <h1 className={styles.visuallyHidden}>widgt demo</h1>
        <div className={styles.visualWrapper}><ProductRating counts={counts} /></div>
      </main>
    );
  }
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>widgt demo</h1>
      <div className={styles.container}>
        <ProductRating counts={counts} {...(scenario.interactive ? { onRatingSelect: setSelected } : {})} />
      </div>
      {scenario.interactive && <p role="status" data-testid="selection">{selectionText(selected)}</p>}
    </main>
  );
}
```
- `.page` and `.container` are **plain blocks**: no flex, no grid, no `align-items`, no `fit-content`. The widget centres itself with `margin-inline: auto`. (Its `container-type: inline-size` gives it no intrinsic width, so inside a shrink-to-fit parent it collapses to zero.)
- `.container`: `padding: 1rem`. **The widget must be its direct child** (AC-5.1 measures `widget.parentElement`).
- `.visualWrapper`: `width: 360px; background: #fff`. **The widget must be its direct child.**
- `.visualPage`: `background: #fff; min-height: 100vh; margin: 0; padding: 0`.
- `.visuallyHidden`: `position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0`. It must paint nothing.
- `global.css` sets the body to `#f6f6f7`. That is fine, because the visual wrapper and page are white.

---

## 4. What the contract checks (58 tests)

### Hooks (exact)
| Hook | Rule |
|---|---|
| `data-testid="product-rating"` | On the widget root, which is a `<section>`. |
| `data-testid="star-1"` … `star-5` | The **five big stars only**, left to right. Each has an inline style `--fill` holding a unitless number in [0, 1] (`style={{ '--fill': String(fill) }}`). Each is inside an `aria-hidden="true"` element (or is one). The small breakdown stars must not use these ids. |
| `data-testid="bar-track-N"` | The grey track of row N. Computed `background-color` is exactly `rgb(226, 226, 226)`. No padding, no border. |
| `data-testid="bar-fill-N"` | **Inside** its track. Rendered width ÷ track width = count / total (±0.02). Computed `background-color` is exactly `rgb(255, 203, 49)`: a plain colour, not a gradient. |
| `data-testid="selection"` + `role="status"` | On the demo page, outside the widget. |

### Test by test
| AC | What must be true |
|---|---|
| 1.1 | Inside the widget, visible, exact text: `Excellent`, `4.6 out of 5`, `Product Rating`; `getByRole('img', { name: 'feefo' })` is visible. |
| 1.2 | `widget.getByRole('list').getByRole('listitem')` has 5 items. Row i contains an element whose exact text is the rating digit (`5` … `1`) and one whose exact text is the count (`952` …). The digit and the count are each **their own element**. |
| 1.3 | For each row: the fill/track width ratio is within 0.02 of count/1232. |
| 1.4 | Exactly 5 `star-N`; their `--fill` values are 1, 1, 1, 1, 0.6 (to 2 dp). |
| 1.5 | Counts shown in en-GB format, rows 5 → 1. |
| 2.2 | On `/?empty=1`: visible exact text `No reviews yet`; no `NaN` or `Infinity` in the widget's text, in any `aria-label`, or in any `style` attribute; every star `--fill` is 0. |
| 3.1 | The root is a `SECTION` whose accessible name matches `/^product rating$/i`. Exactly one such `region` on the page. |
| 3.2 | All 5 stars are inside `aria-hidden="true"`. `widget.getByRole('img')` counts **exactly 1** (the logo). Playwright treats **every `<svg>` as role img**, so every svg must be inside an aria-hidden subtree. `ariaSnapshot()` contains `4.6 out of 5`. |
| 3.3 | Static (`?interactive=0`): exactly one `UL` in the widget, with 5 `LI`. Each `<li>` has the accessible name `5 stars: 952 reviews (77.3%)`, `4 stars: 171 reviews (13.9%)`, `3 stars: 55 reviews (4.5%)`, `2 stars: 14 reviews (1.1%)`, `1 star: 40 reviews (3.2%)`. Playwright does **not** compute a listitem's name from its content, so the static `<li>` needs `aria-label`. Interactive (`/`): the **button** in each row has that name. |
| 3.4 | Both `Excellent` and `4.6 out of 5`: the element whose exact text matches has sentence-case `textContent` **and** computed `text-transform: uppercase`. Do not split either string across elements. |
| 3.5 | The logo is the one `<img alt="feefo">`. Inside the list, `getByRole('img')` counts 0. |
| 3.6 | axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`), whole page, 0 violations, in the default, static and selected states. That includes `color-contrast` (≥ 4.5:1 for all text), `target-size` (≥ 24px), `list`, `listitem`, `nested-interactive`, `aria-hidden-focus` and `scrollable-region-focusable`. |
| 3.7 | Tab into the widget: **the row 5 button is the first tab stop**. Its own `outline` (or `box-shadow`) must be absent at rest and visible on focus, with ≥ 3:1 contrast against the white card. |
| 4.1 | Static: no `button`, no `[aria-pressed]`, nothing with `tabIndex >= 0` in the widget. |
| 4.2 | Interactive: exactly **5** buttons in the widget, each `<button aria-pressed="false">`. The status shows `Selected: none`. Click row 5 → `aria-pressed="true"` and `Selected: 5 stars`. |
| 4.3 | Click row 3 twice → not pressed, `Selected: none`. |
| 4.4 | Click 5, then 2, then 1 → always exactly one pressed; the status follows (`Selected: 1 star`). |
| 4.5 | The Tab order is row 5, 4, 3, 2, 1 with nothing in between. Enter toggles, and Space toggles. |
| 4.7 | With the mouse away and focus removed, a selected row differs from an unselected one in something **other than colour**: border presence or width, font weight, text decoration, outline, box-shadow geometry or size. It must come from `[aria-pressed='true']`, not `:hover` or `:focus`. |
| 5.1 | At 320, 768 and 1280: widget width = min(parent's content width, 420px) within 1px. At 1280 it is centred (equal gaps within 2px). |
| 5.2 | At 320, 768 and 1280: no horizontal page scroll; no text clipped (`scrollWidth > clientWidth + 1`), outside the widget, outside the viewport, or overlapping other text; all 5 rows visible. |
| 5.3 | The root (or a descendant) has `container-type: inline-size`. At 320 every count is fully in the viewport. |
| 5.4 | After `html { font-size: 200% }`, the font sizes of `Excellent`, `4.6 out of 5`, `Product Rating` and `952` are each more than 1.5× what they were. Use **rem** for every font size. |
| 6.1 | `document.fonts.check('16px Poppins')`; a Poppins `FontFace` is loaded; **every element with a direct text node** has a computed `font-family` starting with `Poppins`; all font requests come from the app's own origin. |
| 6.2 | `bar-fill-5` has background `rgb(255, 203, 49)`, and `bar-track-5` has `rgb(226, 226, 226)`. |
| 6.3 | §5 below, then a screenshot of the widget is compared with the reference card. |

---

## 5. AC-6.3 rules for `?visual=1` (anti-cheat; each one fails the capture)

1. **One `<img>` on the whole page**: the logo, `alt="feefo"`, covering at most 4% of the widget's area (the 94×24 placeholder is about 1.5%).
2. No `picture`, `source`, `canvas`, `iframe`, `object`, `embed`, `video`, SVG `image`, `feImage`, `pattern` or `input[type=image]` anywhere. No SVG `<use>` whose `href` does not start with `#`.
3. **No CSS image URLs** on any element or pseudo-element: no `url()`, `image-set()` or `paint()` in backgrounds, border images, list images, `content`, `filter` or `backdrop-filter`. Plain CSS gradients are fine. SVG `fill`/`stroke` may use `url(#id)` only for a same-page gradient. The simplest rule: **use only colours, gradients and inline `<path>`s.**
4. The widget and every ancestor have `opacity: 1`, `visibility: visible` and `mix-blend-mode: normal`.
5. No shadow DOM.
6. With the widget at `opacity: 0`, its box must be **pure white**: the wrapper and page behind it are `#fff`, and nothing else paints over it.
7. Hiding the logo may change pixels **only inside the logo's box**: no shadow, outline, filter or overflow on the logo.
8. The widget's `ariaSnapshot()` on `?visual=1` must **equal** the one on `?interactive=0`. Same props, same content, and nothing shown or hidden by a media or container query.

---

## 6. Components

Each component has its own folder with `X.tsx`, `X.module.css` and `X.test.tsx` (AC-7.4). Props are `readonly` interfaces. No component is defined inside another (lint rule `react-hooks/static-components`).

```
ProductRating            section root: tokens, container, selection state
├── RatingLabel          "Excellent" (uppercase through CSS)
├── StarRow              aria-hidden wrapper of the five big stars
│   └── Star             one tile, --fill, StarIcon inside
├── ScoreText            "4.6 out of 5" or "No reviews yet"
├── BrandLine            <h2> heading + logo <img>
└── RatingBreakdown      <ul>
    └── BreakdownRow     <li>, static content or a toggle <button>; rowName.ts
StarIcon                 inline <svg aria-hidden="true" focusable="false"> with one <path fill="currentColor">
```

| Component | Props | Notes |
|---|---|---|
| `ProductRating` | `ProductRatingProps` exactly as in spec 02 §3: `counts`, `heading?` ("Product Rating"), `locale?` ("en-GB"), `labelFor?`, `selectedRating?: StarRating \| null`, `onRatingSelect?: (rating: StarRating \| null) => void` | `<section data-testid="product-rating" aria-labelledby={headingId} className={styles.root}>` with `headingId = useId()`. Rated: RatingLabel, StarRow, ScoreText. Empty: StarRow (fills are all 0) and ScoreText with `score={null}`, and no label. Then BrandLine and RatingBreakdown. Throws during render on invalid counts (spec 02 "Errors"); it does not catch its own error. |
| `RatingLabel` | `{ label: string }` | `<p>`. |
| `StarRow` | `{ fills: StarFills }` | `<div aria-hidden="true">` containing 5 `Star`s: `([1, 2, 3, 4, 5] as const).map((position, i) => <Star key={position} position={position} fill={fills[i] ?? 0} />)` (a map index is a `number`, not a `StarRating`; `?? 0` is needed because `noUncheckedIndexedAccess` is on). |
| `Star` | `{ position: StarRating; fill: number }` | `<span data-testid={`star-${position}`} style={{ '--fill': String(fill) }}>` containing a white `StarIcon`. |
| `ScoreText` | `{ score: number \| null; locale: string }` | `<p>` with `${formatted} out of 5`, or exactly `No reviews yet`. No "Rated" prefix in the same element. |
| `BrandLine` | `{ heading: string; headingId: string }` | `<h2 id={headingId}>{heading}</h2>`, with `<img src={logoUrl} alt="feefo" width={94} height={24} />` as a **sibling** of the h2, never inside it (otherwise the section's name becomes "Product Rating feefo"). `logoUrl` is imported from `../../assets/feefo-logo-placeholder.png`. It is not a link. |
| `RatingBreakdown` | `{ rows: readonly RatingRowModel[]; locale: string; selectedRating: StarRating \| null; onToggle: ((rating: StarRating) => void) \| null }` | `<ul>` with **no `role`** (`role="list"` is a lint error). |
| `BreakdownRow` | `{ row: RatingRowModel; locale: string; selected: boolean; onToggle: ((rating: StarRating) => void) \| null }` | See below. |

**Selection logic** (in `ProductRating`):
```tsx
const [internal, setInternal] = useState<StarRating | null>(null);
const pressed = selectedRating !== undefined ? selectedRating : internal;   // AC-4.6 controlled mode
const onToggle = onRatingSelect === undefined ? null : (rating: StarRating) => {
  const next = pressed === rating ? null : rating;                          // decide in the handler,
  if (selectedRating === undefined) setInternal(next);                      // never inside a setState updater
  onRatingSelect(next);                                                     // (StrictMode runs updaters twice)
};
```

**`BreakdownRow`:**
```tsx
const name = rowName(row, locale);   // "5 stars: 952 reviews (77.3%)"; "1 star"; "1 review"
const content = (
  <>
    <span className={styles.digit}>{row.rating}</span>
    <StarIcon className={styles.smallStar} />
    <span className={styles.track} data-testid={`bar-track-${row.rating}`}>
      <span className={styles.fill} data-testid={`bar-fill-${row.rating}`} style={{ '--fill': String(row.share) }} />
    </span>
    <span className={styles.count}>{formatCount(row.count, locale)}</span>
  </>
);
return onToggle === null
  ? <li aria-label={name}><span className={styles.content}>{content}</span></li>
  : <li><button type="button" className={styles.button} aria-pressed={selected} aria-label={name}
               onClick={() => onToggle(row.rating)}>{content}</button></li>;
```
- **Only `<span>` inside the button** (no `<div>`). **No `onKeyDown`**: a native button already turns Enter and Space into a click, and a handler would toggle twice.
- `rowName.ts` is a pure function with its own test: `${r} ${r === 1 ? 'star' : 'stars'}: ${formatCount(c, locale)} ${c === 1 ? 'review' : 'reviews'} (${formatPercent(share, locale)})`.

**Typing `--fill`.** Add `src/css-custom-properties.d.ts`:
```ts
import 'react';

declare module 'react' {
  interface CSSProperties {
    '--fill'?: string;
  }
}
```
**`exactOptionalPropertyTypes` is on**: `onRatingSelect={cond ? fn : undefined}` does not compile. Use a conditional spread (as in App above), or `null` for internal props.

---

## 7. Unit tests (Vitest + Testing Library + user-event)

- Query by role, name and text; never by class (CSS is not processed in jsdom). Use `const user = userEvent.setup()`.
- Every `it` title starts with the AC ID it really checks; `describe` titles name the unit (as `src/domain` does). Demo-page tests that check spec 02 §8, which has no AC, start with `§8`. **Never invent an AC ID.**
- Unit coverage counts these 20 IDs, and only from passing tests: AC-1.1–1.5, AC-2.1–2.4, AC-3.1–3.5, AC-4.1–4.6. The domain already covers AC-1.2–1.5 and AC-2.1–2.4. **Still uncovered: AC-1.1, AC-3.1–3.5, AC-4.1–4.6.**

| File | Tests |
|---|---|
| `ProductRating.test.tsx` | `AC-1.1 shows the label, the score text, the heading and the logo`; `AC-1.2 lists 5 rows from 5 down to 1 with the reference counts`; `AC-1.3 each bar's --fill is that rating's share of the total` (row 5 ≈ 0.7727); `AC-1.4 the five stars' --fill values are [1, 1, 1, 1, 0.6]`; `AC-1.5 counts are formatted for the locale` (`{5: 1232, 4: 0, 3: 0, 2: 0, 1: 0}` shows `1,232`); `AC-2.2 with zero reviews it says "No reviews yet", fills no star and renders no NaN`; `AC-2.4 labelFor receives the rounded score` (a `vi.fn` returning "Great" is called with 4.6, and "Great" is shown); `AC-3.1 the widget is a section named "Product rating"`; `AC-3.2 the star graphic is hidden and the logo is the only image`; `AC-3.3 static rows are list items named "N stars: C reviews (P%)"` (including `1 star`); `AC-3.4 the label and score text are sentence case in the DOM`; `AC-3.5 the logo is an img with alt "feefo" and the breakdown stars are decorative` |
| `ProductRating.interactions.test.tsx` | `AC-4.1 without onRatingSelect there are no buttons and no tab stops`; `AC-4.2 with onRatingSelect each row is a toggle button, and clicking one reports and presses it`; `AC-4.3 clicking the selected row again reports null and clears it`; `AC-4.4 selecting another row moves the selection`; `AC-4.5 Tab reaches the rows 5 to 1, and Enter and Space toggle them`; `AC-4.6 in controlled mode selectedRating decides the pressed row and clicks only call back` (`selectedRating={3}`; a click on 5 calls back with 5 while 3 stays pressed; `rerender` with 5 moves it) |
| `rowName.test.ts`, `ScoreText.test.tsx`, `Star.test.tsx`, ... | Small tests per component, with the AC they check (for example `AC-3.3 rowName uses the singular for 1 star and 1 review`) |
| `src/demo/*.test.ts`, `App.test.tsx` | `§8 parseScenario ...` (all four URLs); `§8 the status text is "Selected: none", "Selected: 4 stars", "Selected: 1 star"`; `§8 the visual page renders the widget without a status`. Optionally, AC-2.3 with a small error boundary inside the test (React 19 logs render errors; silence `console.error` with `vi.spyOn` for that test only) |

---

## 8. Styling and the reference

**ADR 0001**: CSS Modules, design tokens as custom properties on the widget root, container queries, and data passed in as one custom property per element. No styling libraries.

**Tokens**: `src/styles/tokens.module.css` defines `.tokens { ... }`, and the root does `composes: tokens from '../../styles/tokens.module.css';`. This deviates from ADR 0001 on purpose: the ADR puts them in `src/styles/tokens.css` on `.root`, but a global `.root` cannot match a hashed CSS Module class. Follow this guide; Phase 4 updates the ADR. CSS Module class keys are camelCase only (`.bar-fill` becomes `styles.barFill`).

| Token | Value |
|---|---|
| `--widgt-color-accent` | `#ffcb31` (stars, bar fill) |
| `--widgt-color-track` | `#e2e2e2` (bar track, small breakdown stars) |
| `--widgt-color-star-empty` | `#d4d4d4` (empty part of a star) |
| `--widgt-color-border` | `#d4d4d4` (card border) |
| `--widgt-color-text` | `#25292f` (label) |
| `--widgt-color-muted` | `#646c76` (score, heading, digits, counts; 5.3:1 on white) |
| `--widgt-color-surface` | `#fff` |
| `--widgt-color-focus` | `#25292f`. **Not the yellow**: yellow on white is 1.6:1 and fails AC-3.7 |

**The card** (the widget at 360px) is 360×405 with a 1px `#d4d4d4` border, a radius of about 0.6875rem (11px), and a white background.

Root CSS: `width: 100%; max-width: 26.25rem; margin-inline: auto; container-type: inline-size; font-family: Poppins, system-ui, sans-serif; background: var(--widgt-color-surface); border: 1px solid var(--widgt-color-border)`.

**Measured from the reference, in card pixels** (starting points to tune between iterations):

| Part | Measured | Starting CSS |
|---|---|---|
| Label "EXCELLENT" | cap ink y 46–62, x 110–247 | weight 600, `font-size: 1.34375rem` (21.5px), `letter-spacing: 0.2rem` (3.2px). This setting matched the reference exactly. Colour text. |
| Stars | 5 tiles of 44×44, 4px gaps, x 62–297, y 85–128, radius about 4px; white star glyph about 26px wide; tile 5 is yellow to about 60%, then `#d4d4d4` | tile `2.75rem` square, gap `0.25rem`, `border-radius: 0.25rem`, `background: linear-gradient(to right, var(--widgt-color-accent) calc(var(--fill) * 100%), var(--widgt-color-star-empty) 0)`, `color: #fff`; icon about `1.625rem` |
| Score "4.6 OUT OF 5" | cap ink y 149–159, x 125–232 | about `0.9375rem`, letter-spaced (about `0.1em`), muted, uppercase |
| Brand line | y 182–208; "Product Rating" text x 62–195; logo x 208–298 (about 91×24) | one centred row, gap about `0.8rem`; h2 about `1.25rem`, weight 500, muted, `margin: 0`; logo `height: 1.5rem; width: auto` |
| Rows | 5 rows, 28px pitch; ink y 256–381 | `ul`: `list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem`; button `min-height: 1.5rem` (24px, for `target-size`) |
| Row columns | digit right-aligned, ending at x about 27; small star 14×14 at x 34–47; track x 65–300, **10px tall**, rounded; count left-aligned from x 318 | digit `min-width: 0.5rem; text-align: right`; small star `0.875rem`; track `flex: 1; min-width: 0; height: 0.625rem; border-radius: 999px`; fill `display: block; height: 100%; width: calc(var(--fill) * 100%); border-radius: inherit`; count `flex: none; min-width: 1.5rem`; side padding about `1.375rem` |
| Bottom padding | about 23px | about `1.4375rem` |

Row text is about `0.875rem`, muted.

**Row button**: `display: flex; align-items: center; gap: ...; width: 100%; padding: 0.125rem 0; font: inherit; color: inherit; text-align: left; background: none; border: 1px solid transparent; border-radius: 0.375rem; cursor: pointer`.
- `.button[aria-pressed='true']`: `border-color: var(--widgt-color-text)`, and `font-weight: 600` on the digit and the count. That is a non-colour change for AC-4.7.
- `.button:focus-visible`: `outline: 0.125rem solid var(--widgt-color-focus); outline-offset: 0.125rem`. No outline at rest.
- The static `<li>` content uses the same layout class without the button styles.

**Responsive**: use `@container (max-width: 18rem)` to tighten spacing only (padding, gaps, the digit and count widths). An `@container` rule styles only the container's **descendants**, so put the padding you want to tighten on an inner wrapper, never on `.root` itself. **Never show or hide content in a query** (§5 rule 8).

---

## 9. Traps (each one fails a contract test)

1. **Buttons do not inherit the font.** Set `font: inherit; color: inherit` on the button, or AC-6.1 fails.
2. **Every `<svg>` is an image to Playwright.** Put `aria-hidden="true" focusable="false"` on every svg, and never give a star `role="img"` or an `aria-label`.
3. **The logo inside the `<h2>`** makes the section's name "Product Rating feefo".
4. **A static `<li>` needs `aria-label`.** Its content does not name it.
5. **Both "Excellent" and "4.6 out of 5" need `text-transform: uppercase`**, and each must be one element with exactly that text.
6. **`onKeyDown` on the row button** toggles twice.
7. **A yellow focus ring** fails 3:1. So does an outline on the `<li>` instead of the button.
8. **A pressed state that changes only colour** fails AC-4.7.
9. **Extra tab stops.** The logo is not a link; there are no other controls, and no `tabindex`. Avoid `overflow: auto` or `scroll` anywhere inside the widget, because Chromium makes scrollers focusable.
10. **px font sizes, or `clamp()` with a px or `cqi` cap**, fail AC-5.4.
11. **Fixed widths with `overflow: hidden`, `nowrap` or `ellipsis` on text** count as clipped.
12. **A non-white background behind the widget** in `?visual=1` fails the opacity-0 check.
13. **Any CSS `url()`, even for the stars**, fails AC-6.3. So do a second `<img>` and an external `<use>`.
14. **`exactOptionalPropertyTypes`** rejects `prop={undefined}`.
15. **Adding exports to `src/domain`** breaks its barrel test, and it is outside your scope.
16. **G5 matches text in comments.** Do not write the banned strings, not even to say "don't use ...".
17. **jsdom has no CSS.** Assert roles, text, attributes and inline `style`, never classes or computed styles.
18. **Different content in `?visual=1` and `?interactive=0`** breaks the snapshot equality.
19. **`star-N` on the small breakdown stars** makes the count 10, not 5.
20. **Padding or a border on the track**, or a gradient on the fill, breaks AC-1.3 or AC-6.2.
21. **A widget that is not the direct child** of `.container` or `.visualWrapper` breaks AC-5.1 or AC-6.3.
22. **Text lighter than `#646c76`, or opacity on text**, fails `color-contrast`.
23. **Reading `window` or `document` during render, or mutating them**, fails lint (`react-hooks`). Parse the URL at module level.
24. **A Google Fonts `<link>`** fails AC-6.1: fonts must come from the app's own origin (the `@fontsource` imports already do this).
25. **The empty state.** No label; `No reviews yet`; stars with fill 0; rows named `5 stars: 0 reviews (0%)`; no `NaN` anywhere.
26. **A flex or grid parent** (or `fit-content`) around the widget collapses it to zero width: see §3.

---

## 10. Before you finish an iteration

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all exit 0. Report each exit code.
- The unit test count has not gone down (gate G6).
- You touched only the files in §1.
- One line describes what changed.
