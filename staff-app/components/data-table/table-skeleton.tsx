import { Shimmer } from "@/components/ui/custom/shimmer";

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid items-center gap-3 rounded-xl border border-border bg-surface p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Shimmer key={c} className={`h-4 ${c === 0 ? "w-32" : c === cols - 1 ? "w-10 ml-auto" : "w-20"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
