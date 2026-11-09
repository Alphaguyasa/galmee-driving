import { cn } from "@/lib/utils";

/** The learner plate: a red L on white. */
export function Logo({ className }: { className?: string; inverse?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm border-2 border-[var(--l-red)] bg-white text-lg leading-none font-bold text-[var(--l-red)]",
        className,
      )}
    >
      L
    </span>
  );
}
