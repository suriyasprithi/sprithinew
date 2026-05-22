"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
};

export const GradientButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, size = "md", children, ...props }, ref) => {
    const sizeCls =
      size === "sm" ? "h-8 px-3 text-xs" :
      size === "lg" ? "h-11 px-5 text-sm" :
                      "h-9 px-4 text-sm";
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 rounded-xl font-medium text-brand-foreground",
          "brand-gradient brand-glow",
          "transition-transform active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          sizeCls,
          className,
        )}
        {...props}
      >
        <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12), transparent 50%)" }} />
        <span className="relative inline-flex items-center gap-2">{children}</span>
      </button>
    );
  },
);
GradientButton.displayName = "GradientButton";
