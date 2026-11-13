/**
 * Lesson progress as a road: the dashed lane line grows as lessons are attended.
 * Drawn as SVG with presentation attributes so it renders under the strict
 * style-src CSP (inline `style` attributes are blocked there).
 */
export function RoadLine({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <svg
      role="img"
      aria-label={label}
      className="block h-3 w-full overflow-hidden rounded-sm bg-[var(--asphalt)]"
      focusable="false"
    >
      {percent > 0 ? (
        <line
          x1="0"
          y1="50%"
          x2={`${percent}%`}
          y2="50%"
          strokeWidth="3"
          strokeDasharray="12 6"
          className="stroke-[var(--lane)]"
        />
      ) : null}
    </svg>
  );
}
