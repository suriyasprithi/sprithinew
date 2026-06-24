"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, MapPin, Phone, Truck, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductImage } from "@/components/ui/custom/product-image";
import { QrScanModal } from "@/components/qr-scan-modal";
import { api, apiErrorMessage } from "@/lib/api";

type Status = "paid" | "shipped" | "delivered";
type DriverOrderItem = {
  id: number;
  name: string;
  variant_name: string | null;
  image: string | null;
  qty: number;
  price: number;
};
type DriverOrder = {
  id: number;
  status: Status;
  total: number;
  delivery_fee: number;
  pickup_address: string;
  drop_address: string;
  customer_name: string;
  customer_mobile: string;
  items: DriverOrderItem[];
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const STATUS_STYLE: Record<Status, string> = {
  paid:      "bg-amber-100 text-amber-800",
  shipped:   "bg-sky-100 text-sky-800",
  delivered: "bg-emerald-100 text-emerald-800",
};

function normalize(raw: unknown): DriverOrder {
  const r = raw as Record<string, unknown>;
  const s = (r.status as string) === "shipped" ? "shipped" : (r.status as string) === "delivered" ? "delivered" : "paid";
  const rawItems = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [];
  return {
    id:              Number(r.id ?? 0),
    status:          s,
    total:           Number(r.total ?? 0),
    delivery_fee:    Number(r.delivery_fee ?? 0),
    pickup_address:  String(r.pickup_address ?? ""),
    drop_address:    String(r.drop_address ?? ""),
    customer_name:   String(r.customer_name ?? ""),
    customer_mobile: String(r.customer_mobile ?? ""),
    items: rawItems.map((it) => ({
      id:           Number(it.id ?? 0),
      name:         String(it.name ?? "Item"),
      variant_name: (it.variant_name as string | null) ?? null,
      image:        (it.image as string | null) ?? null,
      qty:          Number(it.qty ?? 0),
      price:        Number(it.price ?? 0),
    })),
  };
}

export default function DriverOrdersPage() {
  const [items, setItems] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [scanForId, setScanForId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/driver/orders");
      const raw = (Array.isArray(res.data.data?.items) ? res.data.data.items : []) as unknown[];
      setItems(raw.map(normalize));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load orders"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function deliver(id: number) {
    setActingId(id);
    try {
      await api.patch(`/orders/${id}/status`, { status: "delivered" });
      toast.success(`Delivered #${id}`);
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Action failed"));
    } finally {
      setActingId(null);
    }
  }

  // Driver scans the shop's QR at pickup → vendor mobile verified → order goes
  // out for delivery, then "Mark delivered" appears.
  async function pickup(id: number, vendorMobile: string) {
    setScanForId(null);
    setActingId(id);
    try {
      await api.post(`/driver/orders/${id}/pickup`, { vendor_mobile: vendorMobile });
      toast.success(`Picked up #${id} — out for delivery`);
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Pickup failed"));
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-3 p-4 md:p-8">
      <h2 className="text-2xl font-semibold flex items-center gap-2"><Truck className="h-6 w-6" /> My deliveries</h2>

      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing assigned right now.</CardContent></Card>
      ) : items.map((o) => (
        <Card key={o.id}><CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Order #{o.id}</p>
            <span className={"rounded-full px-2 py-0.5 text-[10px] uppercase " + STATUS_STYLE[o.status]}>{o.status}</span>
          </div>
          {o.items.length > 0 && (
            <ul className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-2">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                    <ProductImage src={it.image} alt={it.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    {it.variant_name && it.variant_name !== it.name ? (
                      <p className="truncate text-xs text-muted-foreground">{it.variant_name}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">Qty {it.qty} × {formatCurrency(it.price)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.pickup_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="-mx-2 flex items-center gap-2 rounded-md px-2 py-2 text-xs text-sky-700 underline-offset-2 hover:underline active:bg-muted"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate"><span className="text-muted-foreground">Pickup:</span> {o.pickup_address}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.drop_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="-mx-2 flex items-center gap-2 rounded-md px-2 py-2 text-xs text-sky-700 underline-offset-2 hover:underline active:bg-muted"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate"><span className="text-muted-foreground">Drop:</span> {o.drop_address}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
          </a>
          {o.customer_mobile && (
            <a
              href={`tel:${o.customer_mobile}`}
              className="-mx-2 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sky-700 underline-offset-2 hover:underline active:bg-muted"
            >
              <Phone className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{o.customer_name} · {o.customer_mobile}</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
            </a>
          )}
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-emerald-700">{formatCurrency(o.total)}</p>
            <span className="text-xs text-muted-foreground">
              Delivery: {o.delivery_fee > 0 ? formatCurrency(o.delivery_fee) : "Free"}
            </span>
          </div>

          {o.status === "shipped" && (
            <Button size="sm" className="w-full" disabled={actingId === o.id} onClick={() => setConfirmId(o.id)}>
              {actingId === o.id ? "Saving…" : "Mark delivered"}
            </Button>
          )}
          {o.status === "paid" && (
            <Button size="sm" variant="outline" className="w-full" disabled={actingId === o.id} onClick={() => setScanForId(o.id)}>
              <QrCode className="h-4 w-4" /> Scan shop QR to pick up
            </Button>
          )}
        </CardContent></Card>
      ))}

      <AlertDialog open={confirmId != null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark delivered?</AlertDialogTitle>
            <AlertDialogDescription>
              Order #{confirmId} will be marked as delivered. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actingId === confirmId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actingId === confirmId}
              onClick={async () => {
                const id = confirmId;
                if (id == null) return;
                setConfirmId(null);
                await deliver(id);
              }}
            >
              {actingId === confirmId ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QrScanModal
        open={scanForId != null}
        onClose={() => setScanForId(null)}
        onResult={(mobile) => { if (scanForId != null) void pickup(scanForId, mobile); }}
      />
    </section>
  );
}
