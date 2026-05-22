"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickAction = { label: string; href: string; icon: LucideIcon; description?: string };

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((a, i) => {
        const Icon = a.icon;
        return (
          <motion.div
            key={a.href}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              href={a.href}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-all hover:border-brand/40 hover:shadow-lg",
              )}
            >
              <span className="absolute inset-0 brand-gradient-soft opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <div className="relative min-w-0">
                <p className="truncate text-sm font-medium">{a.label}</p>
                {a.description && <p className="truncate text-xs text-muted-foreground">{a.description}</p>}
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
