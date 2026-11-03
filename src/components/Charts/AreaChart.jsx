import { useEffect, useId, useState } from 'react';
import ChartTooltip from './ChartTooltip.jsx';
import { prefersReducedMotion } from '../Motion/motion.js';
import { AXIS_TEXT, GRID_COLOR, SURFACE, formatTick, niceTicks, useElementWidth } from './chartTheme.js';

const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

// Smooth curve through the points (monotone, so it never overshoots a value).
function smoothPath(points) {
  if (points.length < 2) return points.length ? `M${points[0].x},${points[0].y}` : '';
  const n = points.length;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1].x - points[i].x);
    m.push((points[i + 1].y - points[i].y) / (dx[i] || 1));
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i += 1) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += ` C${points[i].x + h},${points[i].y + t[i] * h} ${points[i + 1].x - h},${points[i + 1].y - t[i + 1] * h} ${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
}

/**
 * Smooth line chart with a soft area under each line. Lines draw from left to
 * right on load; a crosshair and tooltip follow the pointer.
 *   series: [{ name, color, values }]
 */
export default function AreaChart({ labels, series, format = formatTick, height = 260 }) {
  const uid = useId().replace(/:/g, '');
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  const [ready, setReady] = useState(prefersReducedMotion());

  useEffect(() => {
    if (ready) return undefined;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const ticks = niceTicks(Math.max(1, ...series.flatMap((s) => s.values)));
  const max = ticks[ticks.length - 1];
  const last = labels.length - 1;
  const step = last > 0 ? plotW / last : 0;
  const x = (i) => PAD.left + (last > 0 ? step * i : plotW / 2);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 56)));

  function handleMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left - PAD.left) / (step || 1));
    setHover(Math.max(0, Math.min(last, i)));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Trend chart" onPointerMove={handleMove} onPointerLeave={() => setHover(null)}>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={s.name} id={`${uid}-g${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID_COLOR} strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT}>
                {formatTick(t)}
              </text>
            </g>
          ))}
          {labels.map((label, i) =>
            i % labelEvery === 0 || (i === last && last % labelEvery >= labelEvery / 2) ? (
              <text key={`${label}-${i}`} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
                {label}
              </text>
            ) : null
          )}

          {series.map((s, si) => {
            const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
            const line = smoothPath(pts);
            return (
              <g key={s.name}>
                {pts.length > 1 && (
                  <path
                    d={`${line} L${x(last)},${y(0)} L${x(0)},${y(0)} Z`}
                    fill={`url(#${uid}-g${si})`}
                    style={{ opacity: ready ? 1 : 0, transition: `opacity 900ms ease-out ${400 + si * 150}ms` }}
                  />
                )}
                <path
                  d={line}
                  pathLength="1"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1"
                  strokeDashoffset={ready ? 0 : 1}
                  style={{ transition: `stroke-dashoffset 1100ms cubic-bezier(0.22,1,0.36,1) ${si * 150}ms` }}
                />
              </g>
            );
          })}

          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#d0d5dd" strokeWidth="1" />}
          {series.map((s) => {
            const i = hover ?? last;
            return (
              <circle
                key={s.name}
                cx={x(i)}
                cy={y(s.values[i])}
                r={hover === null ? 3.5 : 5}
                fill={s.color}
                stroke={SURFACE}
                strokeWidth="2"
                style={{ opacity: ready ? 1 : 0, transition: 'opacity 300ms ease-out 1100ms, r 150ms' }}
              />
            );
          })}
        </svg>
      )}
      {hover !== null && (
        <ChartTooltip
          x={x(hover)}
          y={PAD.top}
          containerWidth={width}
          title={labels[hover]}
          rows={series.map((s) => ({ name: s.name, color: s.color, value: format(s.values[hover]) }))}
        />
      )}
    </div>
  );
}
