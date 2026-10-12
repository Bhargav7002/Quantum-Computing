import { useMemo, useState } from 'react';
import { niceMax, pct } from '../utils/format';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
  data: Record<string, number>;
}

function Legend({ items }: { items: { key: string; label: string; color: string }[] }) {
  return (
    <ul className="legend">
      {items.map((s) => (
        <li key={s.key}><i className="dot" style={{ background: s.color }} />{s.label}</li>
      ))}
    </ul>
  );
}

/** Grouped bar chart of probability per bitstring. Shows the top outcomes unless expanded. */
export function BarChart({ series, maxBars = 16, title }: { series: BarSeries[]; maxBars?: number; title: string }) {
  const [showAll, setShowAll] = useState(false);

  const { keys, total } = useMemo(() => {
    const peak = new Map<string, number>();
    for (const s of series) {
      for (const [k, v] of Object.entries(s.data)) peak.set(k, Math.max(peak.get(k) ?? 0, v));
    }
    const ranked = [...peak.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
    const chosen = showAll ? ranked : ranked.slice(0, maxBars);
    return { keys: chosen.sort(), total: ranked.length };
  }, [series, maxBars, showAll]);

  if (keys.length === 0) return <p className="muted">No outcomes to plot.</p>;

  const yMax = niceMax(Math.max(...series.flatMap((s) => keys.map((k) => s.data[k] ?? 0))));
  const H = 260, top = 14, bottom = 58, left = 48, right = 12;
  const groupW = Math.max(34, 12 * series.length + 14, Math.min(120, (560 - left - right) / keys.length));
  const W = left + right + keys.length * groupW;
  const plotH = H - top - bottom;
  const barW = Math.min(22, (groupW - 10) / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  const MINW = W;
  const rotate = keys.some((k) => k.length > 3);

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <Legend items={series} />
      <div className="chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: MINW, height: 'auto' }} role="img" aria-label={title}>
          {ticks.map((t) => {
            const y = top + plotH - (t / yMax) * plotH;
            return (
              <g key={t}>
                <line x1={left} x2={W - right} y1={y} y2={y} className="grid-line" />
                <text x={left - 6} y={y + 4} textAnchor="end" className="axis-text">{pct(t, t < 0.1 ? 1 : 0)}</text>
              </g>
            );
          })}
          {keys.map((k, gi) => {
            const gx = left + gi * groupW + (groupW - barW * series.length) / 2;
            return (
              <g key={k}>
                {series.map((s, si) => {
                  const v = s.data[k] ?? 0;
                  const h = (v / yMax) * plotH;
                  return (
                    <rect key={s.key} x={gx + si * barW} y={top + plotH - h} width={barW - 2} height={Math.max(h, v > 0 ? 1 : 0)} rx={2} fill={s.color}>
                      <title>{`${s.label} · |${k}⟩ · ${pct(v, 3)}`}</title>
                    </rect>
                  );
                })}
                <text
                  x={left + gi * groupW + groupW / 2}
                  y={H - bottom + 14}
                  textAnchor={rotate ? 'end' : 'middle'}
                  transform={rotate ? `rotate(-40 ${left + gi * groupW + groupW / 2} ${H - bottom + 14})` : undefined}
                  className="axis-text mono"
                >{k}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {total > maxBars && (
        <button type="button" className="btn ghost small" onClick={() => setShowAll((v) => !v)}>
          {showAll ? `Show top ${maxBars} only` : `Show all ${total} outcomes`}
        </button>
      )}
      {total > maxBars && !showAll && <p className="muted small-text">Showing the {maxBars} most probable of {total} observed outcomes.</p>}
    </figure>
  );
}

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export function LineChart({ series, title, xLabel, yLabel }: { series: LineSeries[]; title: string; xLabel: string; yLabel: string }) {
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  if (xs.length === 0) return <p className="muted">No data to plot.</p>;

  const yMax = niceMax(Math.max(...series.flatMap((s) => s.points.map((p) => p.y)), 0.01));
  const W = 640, H = 300, left = 52, right = 18, top = 14, bottom = 44;
  const plotW = W - left - right, plotH = H - top - bottom;
  const xAt = (x: number) => (xs.length === 1 ? left + plotW / 2 : left + ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * plotW);
  const yAt = (y: number) => top + plotH - (y / yMax) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  const MINW = 420;

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <Legend items={series} />
      <div className="chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: MINW, height: 'auto' }} role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={W - right} y1={yAt(t)} y2={yAt(t)} className="grid-line" />
              <text x={left - 6} y={yAt(t) + 4} textAnchor="end" className="axis-text">{t.toFixed(t < 0.1 ? 3 : 2)}</text>
            </g>
          ))}
          {xs.map((x) => (
            <text key={x} x={xAt(x)} y={H - bottom + 16} textAnchor="middle" className="axis-text">{x}</text>
          ))}
          <text x={left + plotW / 2} y={H - 6} textAnchor="middle" className="axis-label">{xLabel}</text>
          <text transform={`rotate(-90 12 ${top + plotH / 2})`} x={12} y={top + plotH / 2} textAnchor="middle" className="axis-label">{yLabel}</text>
          {series.map((s) => {
            const pts = [...s.points].sort((a, b) => a.x - b.x);
            return (
              <g key={s.key}>
                <polyline fill="none" stroke={s.color} strokeWidth={2} points={pts.map((p) => `${xAt(p.x)},${yAt(p.y)}`).join(' ')} />
                {pts.map((p) => (
                  <circle key={p.x} cx={xAt(p.x)} cy={yAt(p.y)} r={4} fill={s.color}>
                    <title>{`${s.label} · ${xLabel} ${p.x} · TVD ${p.y.toFixed(4)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

/** Horizontal TVD ranking bars. */
export function TvdBars({ rows }: { rows: { key: string; label: string; color: string; value: number }[] }) {
  const max = niceMax(Math.max(...rows.map((r) => r.value), 0.01));
  return (
    <div className="tvd-bars" role="list">
      {rows.map((r) => (
        <div key={r.key} className="tvd-row" role="listitem">
          <span className="tvd-label">{r.label}</span>
          <span className="tvd-track"><span className="tvd-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} /></span>
          <span className="tvd-value mono">{r.value.toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
}
