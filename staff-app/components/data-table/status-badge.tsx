import { cn } from "@/lib/utils";

type Status = "active" | "inactive" | "blocked" | "pending" | "approved" | "rejected";

const MAP: Record<Status, string> = {
  active:   "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  inactive: "bg-muted text-muted-foreground ring-1 ring-border",
  blocked:  "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
  pending:  "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  rejected: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status?.toLowerCase() as Status) || "inactive";
  const cls = MAP[key] ?? MAP.inactive;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", cls, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
