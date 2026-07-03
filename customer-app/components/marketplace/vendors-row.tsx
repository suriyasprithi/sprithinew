import Link from "next/link";
import { Store, Star, MapPin, CheckCircle2, Navigation } from "lucide-react";
import { formatDistance } from "@/lib/geo";

export type MarketplaceVendor = {
  id: number;
  name: string;
  shop_name: string | null;
  area: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
  rating?: number;
  delivery_time?: string;
  product_count?: number;
};

export function VendorsRow({ vendors, loading }: { vendors: MarketplaceVendor[]; loading?: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Multi-vendor</p>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">Local vendors near you</h2>
        </div>
        <Link href="/vendors-public" className="text-sm font-semibold text-[var(--mk-brand)] hover:underline">
          See all →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-[var(--mk-surface-2)] shimmer" />
            ))
          : vendors.slice(0, 6).map((v) => (
              <Link
                key={v.id}
                href={`/shop-public?vendor_id=${v.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--mk-brand)]/40 hover:shadow-[var(--mk-shadow-md)]"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--mk-brand)] to-[var(--mk-brand-deep)] text-white">
                  <Store className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-bold">{v.shop_name ?? v.name}</p>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--mk-text-muted)]">
                    <MapPin className="h-3 w-3" /> {v.area ?? "Local vendor"}{v.pincode ? ` · ${v.pincode}` : ""}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                      {(v.rating ?? 4.5).toFixed(1)} <Star className="h-2.5 w-2.5 fill-current" />
                    </span>
                    {v.distance_km != null ? (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--mk-brand-deep)]">
                        <Navigation className="h-2.5 w-2.5" /> {formatDistance(v.distance_km)}
                      </span>
                    ) : (
                      <span className="text-[var(--mk-text-muted)]">{v.delivery_time ?? "15-30 min"}</span>
                    )}
                    {v.product_count != null && (
                      <span className="text-[var(--mk-text-muted)]">· {v.product_count} items</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
