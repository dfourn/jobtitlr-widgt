# widgt contract tests

Acceptance-level Playwright tests written from [spec 02](../../../docs/specs/02-widgt.md) **before any component existed**. They started red on purpose: they are the outer loop of the TDD cycle, and the components are built until they turn green.

```bash
npm run test:e2e   # builds, serves `vite preview` on :4173, runs the contract
```

Results land in `review/runs/latest/`: `contract-results.json` (JSON reporter) and `screenshots/` (`visual-401.png`, `page-320.png`, `page-768.png`, `page-1280.png`).

## Why it is locked

The widget is built by an AI generator loop ([spec 03](../../../docs/specs/03-review-loop.md)). If the generator could edit the checks, the fastest way to a green score would be to weaken them. So:

- these files, `review/reference/` and `review/rubric.json` are hashed into `review/contract.lock`, and any change fails gate **G4**;
- `.only`, `.skip` and `.fixme` are banned by ESLint here and by gate **G5**;
- tests query by role, accessible name and visible text, so the generator stays free to choose its own markup and CSS. The only hard-wired hooks are the few below, kept to a minimum.

## Files

| File | Covers |
|---|---|
| `rendering.spec.ts` | AC-1.1 to AC-1.5 |
| `empty.spec.ts` | AC-2.2 (`/?empty=1`) |
| `accessibility.spec.ts` | AC-3.1 to AC-3.7, including axe (wcag2a, wcag2aa, wcag21aa, wcag22aa) in the default, static and selected states |
| `interactions.spec.ts` | AC-4.1 to AC-4.5 and AC-4.7, with real clicks and keys. AC-4.6 (controlled mode) is covered by component tests. |
| `responsive.spec.ts` | AC-5.1 to AC-5.4 at 320, 768 and 1280px |
| `visual.spec.ts` | AC-6.1, AC-6.2 (bar colours), AC-6.3 (screenshots only; the harness scores the similarity) |
| `helpers.ts` | Shared fixtures: URLs, reference data, measurement helpers |

## DOM hooks the components must expose

| Hook | Where | Used by |
|---|---|---|
| `data-testid="product-rating"` | The widget root, a `<section>`. Exactly one per page. | Every test |
| `data-testid="selection"`, `role="status"` | The demo page, below the widget. Text: `Selected: none`, `Selected: N stars`, `Selected: 1 star`. | AC-4.x |
| `data-testid="bar-track-N"` (N = 1 to 5) | The grey track of row N. | AC-1.3, AC-6.2 |
| `data-testid="bar-fill-N"` | The yellow fill of row N, **inside** its track. Rendered width ÷ track width = count ÷ total, ±2 percentage points. | AC-1.3, AC-6.2 |
| `data-testid="star-N"` with `--fill` | Each of the five big stars, left to right, with the CSS custom property `--fill` set to a unitless number in [0, 1] (for example `style="--fill: 0.6"`). How the fill is painted is free. Must sit inside an `aria-hidden="true"` subtree. | AC-1.4, AC-2.2, AC-3.2 |

The demo page URLs (`/`, `/?interactive=0`, `/?empty=1`, `/?visual=1`) are defined in spec 02, section 8.

## How a few criteria are measured

- **AC-3.3** Row names match `N stars: C reviews (P%)`. P may be a whole number (`77%`) or have one decimal place (`77.3%`), because the spec does not fix the precision. In static mode the `<li>` carries the name; in interactive mode the `<button>` does.
- **AC-3.7** After a real Tab, the focused row has an outline or box-shadow that it did not have at rest. Its colour has at least 3:1 contrast against the first opaque background behind the row.
- **AC-4.7** The row is compared with itself before and after selection, unhovered and unfocused. Something other than colour must change: font weight or style, text decoration, letter spacing, a drawn border, outline or shadow, generated content, display, or box size.
- **AC-5.1** At each viewport the widget width is `min(container content width, 420px)` within 1px, where the container is the widget's parent. At 1280px it is also centred in the viewport within 2px.
- **AC-5.2** The page does not scroll sideways. No visible text box has `scrollWidth > clientWidth`, no text sits outside the widget or the viewport, and no two text fragments overlap. Screen-reader-only text (boxes of 2px or less) is ignored.
- **AC-5.4** Browser zoom cannot be driven from Playwright, so "usable at 200% zoom" stays a manual check. What is automated: doubling the root font size makes the label, score, heading and counts more than 1.5x larger, which only happens with relative units.
- **AC-6.1** `document.fonts.check('16px Poppins')` is true, at least one Poppins face has loaded, every text element computes to a Poppins-first `font-family`, and every font request goes to the app's own origin.
- **AC-6.3** `visual-401.png` is the top-left 401 x 443 of `/?visual=1` at a 401px viewport, the same frame as `review/reference/widget-reference.png`. Nothing compares the pixels here.
