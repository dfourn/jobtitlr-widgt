import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, sep } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { visualScore } from '../score';

/** An RGBA bitmap, 4 bytes per pixel, row-major. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

const WHITE = [255, 255, 255, 255] as const;

/**
 * Crops and/or pads `image` to `width` x `height`, anchored top-left, padding
 * with white (the `?visual=1` page background). Returns a note describing the
 * change, or `null` when the size already matched.
 */
export function fitToSize(image: RgbaImage, width: number, height: number): { image: RgbaImage; note: string | null } {
  if (image.width === width && image.height === height) return { image, note: null };
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      if (x < image.width && y < image.height) {
        const source = (y * image.width + x) * 4;
        data.set(image.data.subarray(source, source + 4), target);
      } else {
        data.set(WHITE, target);
      }
    }
  }
  const changes = [
    image.width > width || image.height > height ? 'cropped' : '',
    image.width < width || image.height < height ? 'padded' : '',
  ].filter((c) => c !== '');
  const note = `screenshot ${String(image.width)}x${String(image.height)} ${changes.join(' and ')} to the reference size ${String(width)}x${String(height)}`;
  return { image: { width, height, data }, note };
}

export interface ImageComparison {
  /** 1 - diffPixels / totalPixels. */
  readonly similarity: number;
  readonly diffPixels: number;
  readonly totalPixels: number;
  readonly diff: RgbaImage;
  readonly note: string | null;
}

/** Compares a screenshot with the reference using pixelmatch (default threshold 0.1). */
export function compareImages(actual: RgbaImage, reference: RgbaImage): ImageComparison {
  const fitted = fitToSize(actual, reference.width, reference.height);
  const diff = new Uint8Array(reference.width * reference.height * 4);
  const diffPixels = pixelmatch(fitted.image.data, reference.data, diff, reference.width, reference.height, { threshold: 0.1 });
  const totalPixels = reference.width * reference.height;
  return {
    similarity: totalPixels === 0 ? 0 : 1 - diffPixels / totalPixels,
    diffPixels,
    totalPixels,
    diff: { width: reference.width, height: reference.height, data: diff },
    note: fitted.note,
  };
}

/** Reads a PNG file into an {@link RgbaImage}. */
export function readPng(path: string): RgbaImage {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

/** Writes an {@link RgbaImage} as a PNG file, creating the folder. */
export function writePng(path: string, image: RgbaImage): void {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

export interface VisualSignal {
  readonly value: number | null;
  readonly similarity: number | null;
  readonly detail: string;
  readonly notes: readonly string[];
}

/**
 * The visual signal: compares the 401px screenshot with the reference,
 * writes `diff.png`, and maps similarity onto 0-100. Missing or unreadable
 * images produce `null` with a reason instead of throwing.
 */
export function collectVisual(
  paths: { readonly screenshot: string; readonly reference: string; readonly diff: string },
  displayRoot: string | null = null,
): VisualSignal {
  const show = (path: string): string => (displayRoot === null ? path : relative(displayRoot, path).split(sep).join('/'));
  if (!existsSync(paths.reference)) {
    return { value: null, similarity: null, detail: `reference not found: ${show(paths.reference)}`, notes: [] };
  }
  if (!existsSync(paths.screenshot)) {
    return { value: null, similarity: null, detail: `screenshot not found: ${show(paths.screenshot)}`, notes: [] };
  }
  try {
    const result = compareImages(readPng(paths.screenshot), readPng(paths.reference));
    writePng(paths.diff, result.diff);
    return {
      value: visualScore(result.similarity),
      similarity: result.similarity,
      detail: `similarity ${(result.similarity * 100).toFixed(1)}% (${String(result.diffPixels)} of ${String(result.totalPixels)} pixels differ)`,
      notes: result.note === null ? [] : [result.note],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { value: null, similarity: null, detail: `could not compare images: ${message}`, notes: [] };
  }
}
