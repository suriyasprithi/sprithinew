"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, Search, Phone, IdCard } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";

type DriverStatus = "active" | "inactive" | "blocked";
type Driver = {
  id: number;
  name: string;
  mobile: string;
  vehicle: string;
  license: string;
  shift: string;
  status: DriverStatus;
  busy: boolean;
  id_card: string | null;
};

// id_card_url is either a base64 data URL (use as-is) or a stored path (resolve).
const idCardSrc = (u: string | null): string | null =>
  !u ? null : (u.startsWith("data:") ? u : fileUrl(u));

function normalize(raw: unknown): Driver {
  const r = raw as Record<string, unknown>;
  const status = r.status === "blocked" ? "blocked" : r.status === "inactive" ? "inactive" : "active";
  return {
    id: Number(r.id ?? 0),
    name: (r.name as string | undefined) || "",
    mobile: (r.mobile_number as string | undefined) || "",
    vehicle: (r.vehicle_number as string | undefined) || "",
    license: (r.license_number as string | undefined) || "",
    shift: (r.shift as string | undefined) || "",
    status,
    busy: Boolean(r.busy),
    id_card: (r.id_card_url as string | null | undefined) ?? null,
  };
}

export default function VendorDriversPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/staff/drivers");
        const raw = (Array.isArray(res.data.data?.items) ? res.data.data.items : []) as unknown[];
        setItems(raw.map(normalize));
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load drivers"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => items.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.vehicle.toLowerCase().includes(q) || d.mobile.includes(q);
  }), [items, search]);

  return (
    <>
      <MobileHeader title="Drivers" />
      <section className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Operations"
          icon={Truck}
          title="Drivers"
          description="Delivery drivers in your taluk. Call a driver or check their ID card; assign one to an order from the Orders page."
        />

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, vehicle, mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={2} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Truck} title="No drivers in your taluk yet" description="Admin adds drivers to your area. They'll appear here." />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((d, i) => {
                const card = idCardSrc(d.id_card);
                const meta = [d.vehicle, d.license, d.shift].filter(Boolean).join(" · ");
                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Truck className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-semibold">{d.name || "—"}</p>
                        {d.status === "active" ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${d.busy ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                            {d.busy ? "Busy" : "Available"}
                          </span>
                        ) : (
                          <StatusBadge status={d.status} />
                        )}
                      </div>
                      {d.mobile ? (
                        <a href={`tel:${d.mobile}`} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                          <Phone className="h-3 w-3" /> {d.mobile}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">No phone</p>
                      )}
                      {meta && <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{meta}</p>}
                    </div>

                    {card ? (
                      <button type="button" onClick={() => setPreview(card)} className="shrink-0" aria-label="View ID card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={card} alt="ID card" className="h-14 w-20 rounded-lg border border-border object-cover" />
                      </button>
                    ) : (
                      <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground" title="No ID card">
                        <IdCard className="h-5 w-5" />
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Full-size ID-card preview */}
      {preview && (
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          aria-label="Close preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Driver ID card" className="max-h-[85vh] max-w-full rounded-xl border border-border object-contain" />
        </button>
      )}
    </>
  );
}
