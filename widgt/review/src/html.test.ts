// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderIndexHtml, type IndexIteration, type IndexModel } from './html';

const signals = { contract: 40, unit: 50, a11y: 100, responsive: 25, visual: null, judge: null };

function iteration(n: number, total: number, extra: Partial<IndexIteration> = {}): IndexIteration {
  return {
    iteration: n,
    total,
    gatesPassed: true,
    failedGates: [],
    sha: `sha${String(n)}`,
    summary: `change ${String(n)}`,
    signals,
    images: [
      { label: 'Visual 401px', src: `iter-0${String(n)}/screenshots/visual-401.png` },
      { label: 'Diff', src: `iter-0${String(n)}/diff.png` },
    ],
    ...extra,
  };
}

const model: IndexModel = {
  generatedAt: '2026-10-11T12:00:00.000Z',
  target: 90,
  reference: '../reference/widget-reference.png',
  iterations: [iteration(0, 42), iteration(1, 0, { gatesPassed: false, failedGates: ['G2'] }), iteration(2, 78.5)],
};

describe('AC-L6 renderIndexHtml()', () => {
  it('AC-L6 renders a complete HTML document with an inline SVG chart', () => {
    const html = renderIndexHtml(model);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<svg');
    expect(html.match(/<circle class="pt/g)).toHaveLength(3);
  });

  it('AC-L6 marks iterations whose gates failed', () => {
    expect(renderIndexHtml(model).match(/<circle class="pt failed"/g)).toHaveLength(1);
  });

  it('AC-L6 draws the target line', () => {
    expect(renderIndexHtml(model)).toContain('target 90');
  });

  it('AC-L6 shows a section per iteration, newest first, with its images', () => {
    const html = renderIndexHtml(model);
    expect(html.indexOf('id="iter-02"')).toBeLessThan(html.indexOf('id="iter-00"'));
    expect(html).toContain('src="iter-02/screenshots/visual-401.png"');
    expect(html).toContain('src="../reference/widget-reference.png"');
  });

  it('AC-L6 shows a placeholder instead of a broken image when a screenshot is missing', () => {
    const html = renderIndexHtml({
      ...model,
      iterations: [iteration(0, 10, { images: [{ label: 'Viewport 320px', src: null }] })],
    });
    expect(html).toContain('Viewport 320px');
    expect(html).toContain('not captured');
  });

  it('AC-L6 uses no external assets', () => {
    const html = renderIndexHtml(model);
    expect(html).not.toMatch(/(?:src|href)="(?:https?:)?\/\//);
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script src');
    expect(html).not.toContain('@import');
  });

  it('AC-L6 escapes text from commits and summaries', () => {
    const html = renderIndexHtml({ ...model, iterations: [iteration(0, 1, { summary: '<script>alert(1)</script> & co' })] });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; co');
    expect(html).not.toContain('<script>alert(1)');
  });

  it('AC-L6 renders an empty state before the first iteration', () => {
    const html = renderIndexHtml({ ...model, iterations: [] });
    expect(html).toContain('No iterations yet');
  });
});
