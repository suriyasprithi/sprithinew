"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Phone, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mock, type DriverOrder } from "@/lib/mock";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const STATUS_STYLE: Record<DriverOrder["status"], string> = {
  assigned: "bg-amber-100 text-amber-800",
  picked_up: "bg-sky-100 text-sky-800",
  delivered: "bg-emerald-100 text-emerald-800",
};

export default function DriverOrdersPage() {
  const [items, setItems] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliverForId, setDeliverForId] = useState<number | null>(null);
  const [km, setKm] = useState("");
  const [hours, setHours] = useState("");

  async function refresh() {
    setLoading(true);
    // MOCK — replace with api.get("/driver/orders")
    setItems(await mock.driverOrders());
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  async function pickup(id: number) {
    // MOCK — replace with api.patch(`/driver/orders/${id}/pickup`)
    setItems(items.map((o) => o.id === id ? { ...o, status: "picked_up" } : o));
    toast.success(`Picked up #${id}`);
  }
  async function deliver(id: number) {
    const k = Number(km), h = Number(hours);
    if (!k || !h) { toast.error("Km + hours required"); return; }
    // MOCK — replace with api.patch(`/driver/orders/${id}/deliver`, { km, hours })
    setItems(items.map((o) => o.id === id ? { ...o, status: "delivered" } : o));
    toast.success(`Delivered #${id}`);
    setDeliverForId(null); setKm(""); setHours("");
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
            <span className={"rounded-full px-2 py-0.5 text-[10px] uppercase " + STATUS_STYLE[o.status]}>{o.status.replace("_", " ")}</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Pickup: {o.pickup_address}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Drop: {o.drop_address}</p>
          <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> {o.customer_name} · {o.customer_mobile}</p>
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(o.total)}</p>

          {o.status === "assigned" && <Button size="sm" className="w-full" onClick={() => pickup(o.id)}>Mark picked up</Button>}
          {o.status === "picked_up" && deliverForId !== o.id && <Button size="sm" className="w-full" onClick={() => setDeliverForId(o.id)}>Mark delivered…</Button>}
          {o.status === "picked_up" && deliverForId === o.id && (
            <div className="space-y-2 rounded border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Km driven</Label><Input type="number" value={km} onChange={(e) => setKm(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Hours</Label><Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeliverForId(null)}>Cancel</Button>
                <Button size="sm" className="flex-1" onClick={() => deliver(o.id)}>Confirm</Button>
              </div>
            </div>
          )}
        </CardContent></Card>
      ))}
    </section>
  );
}
