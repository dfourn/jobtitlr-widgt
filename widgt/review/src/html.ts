import type { SignalKey } from './types';

/** An image shown for an iteration. `src` is relative to `review/runs/`, or `null` when missing. */
export interface IndexImage {
  readonly label: string;
  readonly src: string | null;
}

export interface IndexIteration {
  readonly iteration: number;
  readonly total: number;
  readonly gatesPassed: boolean;
  readonly failedGates: readonly string[];
  readonly sha: string | null;
  readonly summary: string;
  readonly signals: Readonly<Record<SignalKey, number | null>>;
  readonly images: readonly IndexImage[];
}

export interface IndexModel {
  readonly generatedAt: string;
  readonly target: number;
  /** The reference image, relative to `review/runs/`, or `null` when missing. */
  readonly reference: string | null;
  readonly iterations: readonly IndexIteration[];
}

/**
 * Renders `review/runs/index.html`: a score chart (inline SVG) and, for each
 * iteration, its signals, screenshots and diff. Self-contained: no external
 * scripts, styles, fonts or images, so it works offline and from a file URL.
 */
export function renderIndexHtml(model: IndexModel): string {
  void model;
  throw new Error('not implemented');
}
