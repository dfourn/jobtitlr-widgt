import { SIGNAL_LABELS, pad2 } from './report';
import { SIGNAL_KEYS } from './types';
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
  const latest = model.iterations.at(-1);
  const best = model.iterations.reduce<number | null>((max, it) => (max === null || it.total > max ? it.total : max), null);
  const summary =
    latest === undefined
      ? 'No iterations yet. Run <code>npm run loop</code> to start.'
      : `${String(model.iterations.length)} iterations · latest ${latest.total.toFixed(1)} · best ${(best ?? 0).toFixed(1)} · target ${String(model.target)}`;
  const newestFirst = [...model.iterations].reverse();
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>widgt review loop</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<header>
<h1>widgt review loop</h1>
<p class="muted">${summary}</p>
<p class="muted small">Generated ${escapeHtml(model.generatedAt)}. Scores come from the deterministic harness in <code>review/</code>; the generator never grades itself.</p>
</header>
${model.iterations.length === 0 ? '' : renderChart(model)}
${model.iterations.length === 0 ? '' : renderTable(model.iterations)}
${newestFirst.map((it) => renderIteration(it, model.reference)).join('\n')}
</main>
</body>
</html>
`;
}

const CHART = { width: 720, height: 260, left: 44, right: 72, top: 28, bottom: 34 } as const;

function renderChart(model: IndexModel): string {
  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;
  const count = model.iterations.length;
  const x = (index: number): number => CHART.left + (count === 1 ? plotW / 2 : (index * plotW) / (count - 1));
  const y = (value: number): number => CHART.top + plotH * (1 - Math.min(100, Math.max(0, value)) / 100);
  const fmt = (value: number): string => value.toFixed(1);

  const grid = [0, 25, 50, 75, 100]
    .map(
      (v) =>
        `<line class="grid" x1="${fmt(CHART.left)}" x2="${fmt(CHART.left + plotW)}" y1="${fmt(y(v))}" y2="${fmt(y(v))}"/>` +
        `<text class="axis" x="${fmt(CHART.left - 8)}" y="${fmt(y(v) + 4)}" text-anchor="end">${String(v)}</text>`,
    )
    .join('');
  const target =
    `<line class="target" x1="${fmt(CHART.left)}" x2="${fmt(CHART.left + plotW)}" y1="${fmt(y(model.target))}" y2="${fmt(y(model.target))}"/>` +
    `<text class="axis" x="${fmt(CHART.left + plotW + 8)}" y="${fmt(y(model.target) + 4)}">target ${String(model.target)}</text>`;
  const labelEvery = Math.max(1, Math.ceil(count / 12));
  const xLabels = model.iterations
    .map((it, i) =>
      i % labelEvery === 0 || i === count - 1
        ? `<text class="axis" x="${fmt(x(i))}" y="${fmt(CHART.top + plotH + 20)}" text-anchor="middle">${pad2(it.iteration)}</text>`
        : '',
    )
    .join('');
  const path = model.iterations.map((it, i) => `${i === 0 ? 'M' : 'L'}${fmt(x(i))},${fmt(y(it.total))}`).join(' ');
  const points = model.iterations
    .map((it, i) => {
      const previous = i > 0 ? model.iterations[i - 1] : undefined;
      const delta = previous === undefined ? '' : ` (${it.total - previous.total >= 0 ? '+' : ''}${(it.total - previous.total).toFixed(1)})`;
      const gates = it.gatesPassed ? 'gates pass' : `gates failed: ${it.failedGates.join(', ')}`;
      const label = `Iteration ${pad2(it.iteration)}: ${it.total.toFixed(1)}${delta}, ${gates}`;
      return (
        `<g class="pt-g"><title>${escapeHtml(label)}</title>` +
        `<circle class="hit" cx="${fmt(x(i))}" cy="${fmt(y(it.total))}" r="12"/>` +
        `<circle class="pt${it.gatesPassed ? '' : ' failed'}" cx="${fmt(x(i))}" cy="${fmt(y(it.total))}" r="5"/>` +
        `<text class="val" x="${fmt(x(i))}" y="${fmt(y(it.total) - 12)}" text-anchor="${labelAnchor(i, count)}">${it.total.toFixed(1)}${it.gatesPassed ? '' : ' gate failed'}</text></g>`
      );
    })
    .join('');
  return `<figure class="card chart">
<figcaption><strong>Total score per iteration</strong> <span class="muted">(0-100; hollow points failed a gate and score 0)</span></figcaption>
<svg viewBox="0 0 ${String(CHART.width)} ${String(CHART.height)}" role="img" aria-label="Line chart of the total score per iteration">${grid}${target}${xLabels}<path class="line" d="${path}"/>${points}</svg>
</figure>`;
}

/** Keeps value labels inside the plot: the first reads rightwards, the last leftwards. */
function labelAnchor(index: number, count: number): string {
  if (count === 1) return 'middle';
  if (index === 0) return 'start';
  return index === count - 1 ? 'end' : 'middle';
}

function renderTable(iterations: readonly IndexIteration[]): string {
  const head = ['Iter', 'Total', 'Gates', ...SIGNAL_KEYS.map((key) => SIGNAL_LABELS[key]), 'Commit', 'Change']
    .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
    .join('');
  const rows = iterations
    .map((it) => {
      const cells = [
        `<th scope="row"><a href="#iter-${pad2(it.iteration)}">${pad2(it.iteration)}</a></th>`,
        `<td class="num">${it.total.toFixed(1)}</td>`,
        `<td>${it.gatesPassed ? 'pass' : `<span class="fail">${escapeHtml(it.failedGates.join(', '))}</span>`}</td>`,
        ...SIGNAL_KEYS.map((key) => `<td class="num">${formatSignal(it.signals[key])}</td>`),
        `<td><code>${escapeHtml(it.sha ?? 'latest')}</code></td>`,
        `<td>${escapeHtml(it.summary)}</td>`,
      ];
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('\n');
  return `<div class="card table-wrap"><table><caption>Scoreboard</caption><thead><tr>${head}</tr></thead><tbody>\n${rows}\n</tbody></table></div>`;
}

function renderIteration(it: IndexIteration, reference: string | null): string {
  const images: IndexImage[] = reference === null ? [...it.images] : [{ label: 'Reference', src: reference }, ...it.images];
  const chips = SIGNAL_KEYS.map(
    (key) => `<li><span class="muted">${escapeHtml(SIGNAL_LABELS[key])}</span> <strong>${formatSignal(it.signals[key])}</strong></li>`,
  ).join('');
  const figures = images
    .map((image) => {
      const alt = `Iteration ${pad2(it.iteration)}: ${image.label}`;
      const body =
        image.src === null
          ? `<div class="missing">not captured</div>`
          : `<a href="${escapeHtml(image.src)}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(alt)}" loading="lazy"></a>`;
      return `<figure>${body}<figcaption>${escapeHtml(image.label)}</figcaption></figure>`;
    })
    .join('');
  const gates = it.gatesPassed ? 'all gates pass' : `<span class="fail">gates failed: ${escapeHtml(it.failedGates.join(', '))}</span>`;
  return `<section class="card iteration" id="iter-${pad2(it.iteration)}">
<h2>Iteration ${pad2(it.iteration)} <span class="score">${it.total.toFixed(1)}</span></h2>
<p class="muted">${gates} · commit <code>${escapeHtml(it.sha ?? 'latest')}</code> · ${escapeHtml(it.summary)}</p>
<ul class="chips">${chips}</ul>
<div class="gallery">${figures}</div>
</section>`;
}

function formatSignal(value: number | null): string {
  return value === null ? '–' : String(Math.round(value));
}

/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLES = `
:root{color-scheme:light;--bg:#f6f6f4;--surface:#fcfcfb;--text:#0b0b0b;--muted:#52514e;--grid:#e4e3df;--series:#2a78d6;--fail:#b42318;--fail-bg:#fde8e7}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#121211;--surface:#1a1a19;--text:#f0efec;--muted:#c3c2b7;--grid:#34342f;--series:#3987e5;--fail:#ff8a80;--fail-bg:#3a1d1b}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121211;--surface:#1a1a19;--text:#f0efec;--muted:#c3c2b7;--grid:#34342f;--series:#3987e5;--fail:#ff8a80;--fail-bg:#3a1d1b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.6rem;margin:0 0 4px}
h2{font-size:1.15rem;margin:0 0 4px;display:flex;align-items:baseline;gap:12px}
.score{font-variant-numeric:tabular-nums;color:var(--series)}
.muted{color:var(--muted)}.small{font-size:.85rem}
code{font:.85em ui-monospace,SFMono-Regular,Menlo,monospace}
.card{background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:16px;margin:16px 0}
.chart{overflow-x:auto}.chart svg{width:100%;min-width:520px;height:auto;display:block}
.grid{stroke:var(--grid);stroke-width:1}
.target{stroke:var(--muted);stroke-width:1}
.axis{fill:var(--muted);font-size:11px}
.line{fill:none;stroke:var(--series);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.pt{fill:var(--series);stroke:var(--surface);stroke-width:2}
.pt.failed{fill:var(--surface);stroke:var(--series);stroke-width:2}
.hit{fill:transparent}
.val{fill:var(--text);font-size:11px;opacity:0;transition:opacity .15s}
.pt-g:hover .val,.pt-g:last-child .val{opacity:1}
.pt-g:hover .pt{r:7}
.table-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.85rem}
caption{text-align:left;font-weight:600;padding-bottom:8px}
th,td{padding:6px 8px;border-bottom:1px solid var(--grid);text-align:left;white-space:nowrap}
td:last-child{white-space:normal;min-width:28ch}
.num{text-align:right;font-variant-numeric:tabular-nums}
a{color:var(--series)}
.fail{color:var(--fail);background:var(--fail-bg);border-radius:4px;padding:0 4px}
.chips{list-style:none;padding:0;margin:8px 0 12px;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.85rem}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
figure{margin:0}
.gallery img,.missing{width:100%;border:1px solid var(--grid);border-radius:6px;background:#fff}
.gallery img{display:block;height:auto}
.missing{aspect-ratio:401/443;display:grid;place-items:center;color:var(--muted);background:var(--bg);font-size:.85rem}
figcaption{font-size:.8rem;color:var(--muted);margin-top:4px}
`;
