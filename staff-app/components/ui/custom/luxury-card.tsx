"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type LuxuryCardProps = HTMLMotionProps<"div"> & {
  glow?: boolean;
  hoverLift?: boolean;
};

export const LuxuryCard = React.forwardRef<HTMLDivElement, LuxuryCardProps>(
  ({ className, glow, hoverLift = true, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hoverLift ? { y: -2 } : undefined}
      className={cn(
        "luxe-card relative overflow-hidden rounded-2xl",
        glow && "brand-glow",
        "transition-shadow",
        className,
      )}
      {...props}
    />
  ),
);
LuxuryCard.displayName = "LuxuryCard";
