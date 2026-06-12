"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Matches lib/api.ts base resolution so images load from the same backend.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function resolveImg(p: string | null | undefined): string {
  if (!p) return "";
  if (p.startsWith("data:") || p.startsWith("blob:")) return p;
  if (/^https?:\/\//.test(p)) return p;
  return `${API_BASE}/${p.replace(/^\/+/, "")}`.replace(/\/{2,}(?=[^:])/g, "/");
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
      className={cn("flex h-full w-full items-center justify-center bg-surface-2 text-muted-foreground", className)}
    >
      <ImageIcon className="h-5 w-5" />
    </div>
  );
}
