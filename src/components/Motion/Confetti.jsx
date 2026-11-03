import { useMemo } from 'react';
import { prefersReducedMotion } from './motion.js';
import { theme } from '../../theme/themes.js';

const COLORS = [theme.brand[500], theme.brand[300], theme.accent[500], '#d8b183', '#12b76a'];

/**
 * A short burst of falling confetti over its parent (the parent needs
 * `relative`). Decorative only. The parent unmounts it when done; with
 * reduced motion it renders nothing.
 */
export default function Confetti({ pieces = 28 }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        size: 5 + Math.random() * 5,
        round: Math.random() > 0.6,
        color: COLORS[i % COLORS.length],
      })),
    [pieces]
  );

  if (prefersReducedMotion()) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 z-20 h-0 overflow-visible" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className={`absolute top-0 animate-confetti ${b.round ? 'rounded-full' : 'rounded-[2px]'}`}
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.round ? b.size : b.size * 0.45,
            background: b.color,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
