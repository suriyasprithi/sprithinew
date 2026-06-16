"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function resolveImg(p: string | null | undefined): string {
  if (!p) return "";
  if (p.startsWith("data:") || p.startsWith("blob:")) return p;
  if (/^https?:\/\//.test(p)) return p;
  return `${API_BASE}/${p.replace(/^\/+/, "")}`;
}

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

export function ProductImage({ src, alt, className }: Props) {
  const [failed, setFailed] = useState(false);
  const url = resolveImg(src);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${alt} — no image`}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-2",
        className,
      )}
    >
      <span className="flex h-1/3 max-h-12 min-h-8 w-1/3 max-w-12 min-w-8 items-center justify-center rounded-lg brand-gradient text-brand-foreground text-xl font-bold">
        S
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        SPRITHI
      </span>
    </div>
  );
}
