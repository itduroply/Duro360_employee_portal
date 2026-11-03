import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../Motion/motion.js';
import { LABEL_TEXT, SURFACE } from './chartTheme.js';

const SIZE = 200;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 3; // surface gap between segments, in px of arc

/**
 * Donut with the total in the middle. Segments sweep in on load; hovering a
 * segment or its legend row dims the others and shows that part in the middle.
 *   parts: [{ label, value, color }]
 */
export default function DonutChart({ parts, format = String, centerLabel = 'Total' }) {
  const [ready, setReady] = useState(prefersReducedMotion());
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (ready) return undefined;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((s, p) => s + p.value, 0);
  const active = hover !== null ? shown[hover] : null;

  let cumulative = 0;
  const arcs = shown.map((p) => {
    const length = total ? (p.value / total) * C : 0;
    const arc = { start: cumulative, length: Math.max(length - (shown.length > 1 ? GAP : 0), 0) };
    cumulative += length;
    return arc;
  });

  if (!total) return <p className="py-10 text-center text-theme-sm text-gray-400">No data yet.</p>;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 py-2">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Donut chart" className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={SURFACE} strokeWidth={STROKE} />
          {shown.map((p, i) => (
            <circle
              key={p.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth={hover === i ? STROKE + 4 : STROKE}
              strokeDasharray={`${ready ? arcs[i].length : 0} ${C}`}
              strokeDashoffset={-arcs[i].start}
              opacity={hover === null || hover === i ? 1 : 0.35}
              style={{
                transition: `stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1) ${i * 120}ms, opacity 150ms, stroke-width 150ms`,
              }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold tabular-nums" style={{ color: LABEL_TEXT }}>
            {format(active ? active.value : total)}
          </span>
          <span className="max-w-[110px] truncate text-theme-xs text-gray-500">{active ? active.label : centerLabel}</span>
        </div>
      </div>

      <ul className="flex min-w-[180px] flex-col gap-1.5">
        {shown.map((p, i) => (
          <li
            key={p.label}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className={`flex cursor-default items-center gap-3 rounded-lg px-2 py-1.5 text-theme-sm transition-colors ${hover === i ? 'bg-gray-50' : ''}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
            <span className="flex-1 text-gray-600">{p.label}</span>
            <span className="font-semibold tabular-nums text-gray-800">{format(p.value)}</span>
            <span className="w-10 text-right text-theme-xs tabular-nums text-gray-400">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
