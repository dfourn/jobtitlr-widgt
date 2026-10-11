# ADR 0001: Styling approach for widgt

- Status: Accepted
- Date: 2026-10-11
- Context: brief B2.12 ("we are interested in the reasoning behind your choice rather than a specific library")

## Context
The deliverable is a **widget**: a small, self-contained component that will be embedded in pages we don't control, such as product pages and sidebars. Whatever styling approach we pick has to:
1. Keep its styles from leaking into the host page, and keep the host's styles from leaking in.
2. Add no runtime cost.
3. Respond to the space the widget is given, not only to the viewport (B2.3).
4. Make the design values (colours, radii, spacing) visible and easy to change in one place.
5. Be easy for any React developer to read.

## Options considered
| Option | For | Against |
|---|---|---|
| **CSS Modules + CSS custom properties** | Built into Vite with zero dependencies. Class names are scoped. No runtime cost. Plain CSS gives container queries, `:focus-visible` and `prefers-reduced-motion` directly. Custom properties work as design tokens and can be themed by the host. | Styles live in a separate file from the component. No type safety for class names (a typed-CSS-modules plugin would add it). |
| Tailwind CSS | Fast to iterate. Consistent spacing scale. | In an embedded widget, its reset and utility classes can collide with a host page that also uses Tailwind. Markup gets noisy. Adds a build dependency. Tokens end up in config rather than in the CSS. |
| CSS-in-JS (styled-components, Emotion) | Styles sit next to the component. Dynamic props. | Runtime cost. Server-rendering and streaming are more complex. Both libraries have stepped back from runtime CSS-in-JS. |
| Zero-runtime CSS-in-TS (vanilla-extract) | Type-safe tokens and no runtime cost. | One more tool to learn and configure for a widget this small. |
| Shadow DOM / web component | Strongest isolation for third-party embedding. | Extra packaging work, and React inside Shadow DOM has edge cases. More than this brief needs. |

## Decision
**CSS Modules, with design tokens as CSS custom properties on the widget root, plus container queries for responsiveness.**

- Tokens live in `src/styles/tokens.css` and are scoped to `.root`. A host can theme the widget by overriding variables such as `--widgt-color-accent`.
- The widget root sets `container-type: inline-size`, and the layout adapts with `@container` rules.
- Values that come from data, such as bar widths and star fill, are passed in as a single custom property per element (`style={{'--fill': '0.6'}}`), so there are no inline style objects scattered through the components.

## Consequences
- No styling dependencies are added.
- If this became a widget distributed to third-party sites, the next step would be a Shadow DOM wrapper. The CSS would move across almost unchanged.
- Class names are untyped strings. This is acceptable at this size, and tests query by role and accessible name rather than by class.
