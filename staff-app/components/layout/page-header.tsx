import type { LucideIcon } from "lucide-react";

type Props = {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow, icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        )}
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {Icon && <Icon className="h-6 w-6 text-brand md:h-7 md:w-7" />}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
