/** Lesson progress as a road: the dashed lane line grows as lessons are attended. */
export function RoadLine({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div role="img" aria-label={label} className="relative h-3 w-full overflow-hidden rounded-sm bg-[var(--asphalt)]">
      <div
        className="absolute inset-y-1/2 left-0 h-[3px] -translate-y-1/2"
        style={{
          width: `${percent}%`,
          backgroundImage: "repeating-linear-gradient(90deg, var(--lane) 0 12px, transparent 12px 18px)",
        }}
      />
    </div>
  );
}
