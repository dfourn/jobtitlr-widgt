/**
 * Shared fixtures for the widgt contract tests (spec 02, section 8).
 *
 * Everything here is derived from the spec, never from an implementation.
 * The DOM hooks the components must expose are listed in `README.md`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The folder this run writes into, absolute and ending in a path separator: `REVIEW_RUN_DIR`
 * when it is set (the review harness passes it, spec 03 section 4), else `review/runs/latest/`.
 * The JSON report, Playwright's output, the screenshots and the axe results all go under it.
 */
export const RUN_DIR = runDirFrom(process.env.REVIEW_RUN_DIR);

function runDirFrom(fromEnv: string | undefined): string {
  const dir =
    fromEnv === undefined || fromEnv.trim() === ''
      ? fileURLToPath(new URL('../runs/latest/', import.meta.url))
      : resolve(fromEnv);
  return dir.endsWith(sep) ? dir : `${dir}${sep}`;
}

/** The states the AC-3.6 tests run axe in; each writes `<RUN_DIR>/axe/<state>.json`. */
export type AxeState = 'default' | 'static' | 'selected';

/** The parts of an axe-core violation the harness reads (spec 03, accessibility signal). */
export interface AxeViolationLike {
  readonly id: string;
  readonly impact?: string | null | undefined;
  readonly nodes: readonly unknown[];
}

/**
 * Writes one state's axe result to `<RUN_DIR>/axe/<state>.json` as
 * `{ state, violations: [{ id, impact, nodes }] }`, where `nodes` is the number of failing nodes.
 * One file per state, so parallel workers never write the same file. Called after axe runs and
 * before the test asserts, so a state that rendered always leaves a result, pass or fail.
 */
export function writeAxeState(state: AxeState, violations: readonly AxeViolationLike[]): void {
  const dir = `${RUN_DIR}axe`;
  mkdirSync(dir, { recursive: true });
  const result = {
    state,
    violations: violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      nodes: violation.nodes.length,
    })),
  };
  writeFileSync(`${dir}${sep}${state}.json`, `${JSON.stringify(result, null, 2)}\n`);
}

/** Demo page scenarios (spec 02, section 8). */
export const URLS = {
  interactive: '/',
  static: '/?interactive=0',
  empty: '/?empty=1',
  visual: '/?visual=1',
} as const;

export type Star = 1 | 2 | 3 | 4 | 5;

/** Breakdown order, top to bottom (AC-1.2). */
export const STARS_DESC: readonly Star[] = [5, 4, 3, 2, 1];

/** Reference data from the brief (B2.1). */
export const REFERENCE_COUNTS: Readonly<Record<Star, number>> = {
  5: 952,
  4: 171,
  3: 55,
  2: 14,
  1: 40,
};

export const REFERENCE_TOTAL = STARS_DESC.reduce((sum, star) => sum + REFERENCE_COUNTS[star], 0);

/** Viewport widths named by AC-5.2. */
export const VIEWPORT_WIDTHS = [320, 768, 1280] as const;

/** Tolerance for geometric ratios (bar fills), as an absolute fraction: 0.02 = 2 percentage points. */
export const RATIO_TOLERANCE = 0.02;

/** The widget root. Spec 02 section 8: the only element with this test id. */
export function widgetOf(page: Page): Locator {
  return page.getByTestId('product-rating');
}

/** The selection status element on the interactive demo page. */
export function statusOf(page: Page): Locator {
  return page.getByTestId('selection');
}

/** Share of the reference total for one star rating, in [0, 1]. */
export function shareOf(star: Star): number {
  return REFERENCE_COUNTS[star] / REFERENCE_TOTAL;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Accessible name of a breakdown row (AC-3.3): "N stars: C reviews (P%)", "1 star" in the singular.
 * P may be a whole percentage (77%) or one decimal place (77.3%); the spec does not fix the precision.
 */
export function rowNamePattern(star: Star): RegExp {
  const count = REFERENCE_COUNTS[star];
  const noun = star === 1 ? 'star' : 'stars';
  const reviews = count === 1 ? 'review' : 'reviews';
  const percent = shareOf(star) * 100;
  const whole = String(Math.round(percent));
  const oneDecimal = percent.toFixed(1);
  const formattedCount = new Intl.NumberFormat('en-GB').format(count);
  return new RegExp(
    `^${star} ${noun}: ${escapeRegExp(formattedCount)} ${reviews} \\((${whole}|${escapeRegExp(oneDecimal)})%\\)$`,
  );
}

/** A breakdown row button in interactive mode, found by its accessible name. */
export function rowButton(page: Page, star: Star): Locator {
  return widgetOf(page).getByRole('button', { name: rowNamePattern(star) });
}

/** The status text the demo page shows for a selection (spec 02, section 8). */
export function selectionText(star: Star | null): string {
  if (star === null) {
    return 'Selected: none';
  }
  return `Selected: ${star} ${star === 1 ? 'star' : 'stars'}`;
}

/** Opens a demo scenario and waits until the widget is attached. */
export async function openScenario(page: Page, url: string): Promise<Locator> {
  await page.goto(url);
  const widget = widgetOf(page);
  await expect(widget).toBeVisible();
  return widget;
}

/**
 * Width of `fill` as a fraction of the width of `track`, measured from layout boxes.
 * Returns NaN when either box is missing or the track has no width.
 */
export async function widthRatio(fill: Locator, track: Locator): Promise<number> {
  const [fillBox, trackBox] = await Promise.all([fill.boundingBox(), track.boundingBox()]);
  if (fillBox === null || trackBox === null || trackBox.width === 0) {
    return Number.NaN;
  }
  return fillBox.width / trackBox.width;
}

/**
 * Reads the `--fill` custom property (a unitless number in [0, 1]) from the five big stars,
 * `data-testid="star-1"` to `data-testid="star-5"`, left to right.
 * Missing stars are skipped, so the result can be shorter than 5.
 */
export async function readStarFills(widget: Locator): Promise<number[]> {
  return widget.evaluate((root) => {
    const fills: number[] = [];
    for (let i = 1; i <= 5; i += 1) {
      const star = root.querySelector(`[data-testid="star-${i}"]`);
      if (star !== null) {
        fills.push(Number.parseFloat(getComputedStyle(star).getPropertyValue('--fill').trim()));
      }
    }
    return fills;
  });
}

/** Presses Tab until focus lands inside the widget. Returns false when it never does. */
export async function tabIntoWidget(page: Page, maxPresses = 10): Promise<boolean> {
  for (let i = 0; i < maxPresses; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      () => document.activeElement?.closest('[data-testid="product-rating"]') != null,
    );
    if (inside) {
      return true;
    }
  }
  return false;
}

/**
 * Describes the focus indicator of an element: whether an outline or box-shadow is drawn,
 * its colour, and the contrast ratio of that colour against the first opaque background behind it.
 */
export interface FocusIndicator {
  outline: string;
  boxShadow: string;
  visible: boolean;
  contrast: number;
}

/** Reads the current focus indicator of the element (see {@link FocusIndicator}). */
export async function readFocusIndicator(target: Locator): Promise<FocusIndicator> {
  return target.evaluate((el) => {
    type Rgba = [number, number, number, number];

    const parseColour = (text: string): Rgba | null => {
      const match = /rgba?\(([^)]+)\)/.exec(text);
      if (match === null || match[1] === undefined) {
        return null;
      }
      const parts = match[1].split(/[\s,/]+/).filter((p) => p.length > 0).map(Number.parseFloat);
      const [r = 0, g = 0, b = 0, a = 1] = parts;
      return [r, g, b, a];
    };

    const luminance = ([r, g, b]: Rgba): number => {
      const channel = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const blend = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3];
      return [
        top[0] * a + bottom[0] * (1 - a),
        top[1] * a + bottom[1] * (1 - a),
        top[2] * a + bottom[2] * (1 - a),
        1,
      ];
    };

    const backgroundBehind = (start: Element): Rgba => {
      let node: Element | null = start.parentElement;
      while (node !== null) {
        const colour = parseColour(getComputedStyle(node).backgroundColor);
        if (colour !== null && colour[3] > 0) {
          return blend(colour, [255, 255, 255, 1]);
        }
        node = node.parentElement;
      }
      return [255, 255, 255, 1];
    };

    const style = getComputedStyle(el);
    const outlineWidth = Number.parseFloat(style.outlineWidth);
    const hasOutline = style.outlineStyle !== 'none' && outlineWidth > 0;
    const hasShadow = style.boxShadow !== 'none' && style.boxShadow.trim() !== '';
    const indicatorColour = hasOutline
      ? parseColour(style.outlineColor)
      : hasShadow
        ? parseColour(style.boxShadow)
        : null;

    let contrast = 0;
    if (indicatorColour !== null && indicatorColour[3] > 0) {
      const background = backgroundBehind(el);
      const fg = luminance(blend(indicatorColour, background));
      const bg = luminance(background);
      contrast = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    }

    return {
      outline: hasOutline ? `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}` : 'none',
      boxShadow: hasShadow ? style.boxShadow : 'none',
      visible: (hasOutline || hasShadow) && contrast > 1,
      contrast,
    };
  });
}

/**
 * A fingerprint of everything visual about an element and its descendants EXCEPT colour:
 * font weight, font style, text decoration, letter spacing, border and outline presence and width,
 * box-shadow geometry, generated content, display, visibility and box sizes.
 * Two fingerprints that differ mean the change is visible without relying on colour alone (AC-4.7).
 */
export async function nonColourFingerprint(target: Locator): Promise<string> {
  return target.evaluate((root) => {
    const alphaOf = (colour: string): number => {
      if (colour === 'transparent') {
        return 0;
      }
      const match = /rgba?\(([^)]+)\)/.exec(colour);
      if (match === null || match[1] === undefined) {
        return 1;
      }
      const parts = match[1].split(/[\s,/]+/).filter((p) => p.length > 0);
      return parts.length >= 4 ? Number.parseFloat(parts[3] ?? '1') : 1;
    };

    const shadowGeometry = (shadow: string): string =>
      shadow === 'none'
        ? 'none'
        : shadow
            .split(/,(?![^(]*\))/)
            .filter((layer) => {
              const colour = /rgba?\([^)]*\)/.exec(layer);
              return colour === null || alphaOf(colour[0]) > 0;
            })
            .map((layer) => layer.replace(/rgba?\([^)]*\)/g, '').trim())
            .join(',') || 'none';

    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;

    const describe = (el: Element, pseudo: string | null): string => {
      const style = getComputedStyle(el, pseudo);
      const borders = sides.map((side) => {
        const width = style.getPropertyValue(`border-${side.toLowerCase()}-width`);
        const lineStyle = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
        const colour = style.getPropertyValue(`border-${side.toLowerCase()}-color`);
        const drawn = lineStyle !== 'none' && Number.parseFloat(width) > 0 && alphaOf(colour) > 0;
        return drawn ? `${lineStyle}:${width}` : 'none';
      });
      const outlineDrawn =
        style.outlineStyle !== 'none' &&
        Number.parseFloat(style.outlineWidth) > 0 &&
        alphaOf(style.outlineColor) > 0;
      const rect = el.getBoundingClientRect();
      return [
        pseudo ?? el.tagName,
        style.fontWeight,
        style.fontStyle,
        style.textDecorationLine,
        style.letterSpacing,
        borders.join('/'),
        outlineDrawn ? `${style.outlineStyle}:${style.outlineWidth}` : 'none',
        shadowGeometry(style.boxShadow),
        pseudo === null ? '' : style.content,
        style.display,
        style.visibility,
        pseudo === null ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : '',
      ].join('|');
    };

    const parts: string[] = [];
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
      parts.push(describe(el, null), describe(el, '::before'), describe(el, '::after'));
    }
    return parts.join('\n');
  });
}

/**
 * Layout problems inside the widget (AC-5.2): text that is clipped (scrollWidth > clientWidth),
 * text that pokes out of the widget or the viewport, and text fragments that overlap each other.
 * Visually hidden text (an ancestor box of 2px or less, the usual screen-reader-only pattern) is ignored.
 */
export async function findLayoutProblems(widget: Locator): Promise<string[]> {
  return widget.evaluate((root) => {
    const problems: string[] = [];
    const rootRect = root.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;

    const isVisuallyHidden = (el: Element): boolean => {
      let node: Element | null = el;
      while (node !== null && node !== root.parentElement) {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return true;
        }
        if (rect.width <= 2 || rect.height <= 2) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    interface Fragment {
      text: string;
      rect: DOMRect;
      owner: Element;
    }
    const fragments: Fragment[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const owner = node.parentElement;
      if (text.length === 0 || owner === null || isVisuallyHidden(owner)) {
        continue;
      }
      if (owner.clientWidth > 0 && owner.scrollWidth > owner.clientWidth + 1) {
        problems.push(`clipped: "${text}" (scrollWidth ${owner.scrollWidth} > clientWidth ${owner.clientWidth})`);
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width === 0 || rect.height === 0) {
          continue;
        }
        if (rect.left < rootRect.left - 1 || rect.right > rootRect.right + 1) {
          problems.push(`outside widget: "${text}"`);
        }
        if (rect.left < -1 || rect.right > viewportWidth + 1) {
          problems.push(`outside viewport: "${text}"`);
        }
        fragments.push({ text, rect, owner });
      }
    }

    for (let i = 0; i < fragments.length; i += 1) {
      for (let j = i + 1; j < fragments.length; j += 1) {
        const a = fragments[i];
        const b = fragments[j];
        if (a === undefined || b === undefined || a.owner === b.owner) {
          continue;
        }
        const overlapX = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const overlapY = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        const smallerArea = Math.min(a.rect.width * a.rect.height, b.rect.width * b.rect.height);
        if (overlapX > 2 && overlapY > 2 && overlapX * overlapY > 0.1 * smallerArea) {
          problems.push(`overlap: "${a.text}" and "${b.text}"`);
        }
      }
    }
    return problems;
  });
}
