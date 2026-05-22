"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import type { Banner } from "@/lib/banners";
import { lucideOrFallback } from "@/lib/lucide-registry";

/** Coupon row at the top of the home page.
 *  Drives off slot=coupon (first active row). Convention:
 *    eyebrow   → discount label  (e.g. "₹100 OFF")
 *    title     → middle text     (e.g. "on your first order — use code")
 *    cta_label → the code itself (e.g. "EPEYNEW100")
 *    icon_name → leading lucide icon (defaults to Ticket)
 */
export function CouponBanner({ banner }: { banner?: Banner | null }) {
  const [closed, setClosed] = useState(false);
  if (!banner || closed) return null;

  const Icon = lucideOrFallback(banner.icon_name, lucideOrFallback("Ticket"));
  const code = banner.cta_label ?? "";
  const off = banner.eyebrow ?? "";

  return (
    <section className="w-full px-4 pt-2">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-[var(--mk-brand)]/40 bg-[var(--mk-brand-soft)] px-4 py-3 text-sm">
        <Icon className="h-5 w-5 shrink-0 text-[var(--mk-brand-deep)]" />
        <p className="flex-1 truncate">
          {off && <span className="font-semibold text-[var(--mk-brand-deep)]">{off}</span>}
          {banner.title && <span className="text-[var(--mk-text)]"> {banner.title} </span>}
          {code && <code className="rounded bg-[var(--mk-brand-deep)] px-1.5 py-0.5 font-mono text-xs font-bold text-white">{code}</code>}
        </p>
        {code && (
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(code).then(() => toast.success("Coupon copied")); }}
            className="hidden items-center gap-1 rounded-lg bg-[var(--mk-brand-deep)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--mk-brand)] sm:inline-flex"
          >
            <Copy className="h-3 w-3" /> Copy
          </button>
        )}
        <button onClick={() => setClosed(true)} aria-label="Close" className="rounded-full p-1 hover:bg-[var(--mk-brand)]/15">
          <X className="h-4 w-4 text-[var(--mk-text-soft)]" />
        </button>
      </div>
    </section>
  );
}
