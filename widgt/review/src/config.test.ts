// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { abs, defaultPaths, SCREENSHOT_NAMES, WIDGT_ROOT } from './config';

const source = (path: string): string => readFileSync(abs(WIDGT_ROOT, path), 'utf8');

/**
 * The screenshot names `review/contract/visual.spec.ts` writes: template
 * literals of the form `${DIR}<name>.png`, with `${width}` expanded over
 * VIEWPORT_WIDTHS from helpers.ts.
 */
function writtenScreenshots(): string[] {
  const widths = /VIEWPORT_WIDTHS = \[([^\]]*)\]/.exec(source('review/contract/helpers.ts'))?.[1] ?? '';
  const names: string[] = [];
  for (const match of source('review/contract/visual.spec.ts').matchAll(/`\$\{\w+\}([\w${}-]+)\.png`/g)) {
    const name = match[1] ?? '';
    const expanded = name.includes('${width}') ? widths.split(',').map((w) => name.replace('${width}', w.trim())) : [name];
    names.push(...expanded);
  }
  return names;
}

describe('AC-L1 screenshot names', () => {
  it('AC-L1 SCREENSHOT_NAMES are the files the contract tests write, plus the widget capture', () => {
    const written = writtenScreenshots();
    expect(written).toContain('visual-401');
    expect(new Set(SCREENSHOT_NAMES)).toEqual(new Set([...written, 'visual-widget']));
  });
});

describe('AC-L10 visual screenshot', () => {
  it('AC-L10 the visual signal reads the widget-only screenshot', () => {
    expect(defaultPaths().visualScreenshot).toBe('review/runs/latest/screenshots/visual-widget.png');
  });
});
