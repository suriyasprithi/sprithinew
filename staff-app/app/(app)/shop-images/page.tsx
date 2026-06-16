"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Check, X, Loader2, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { EmptyState } from "@/components/data-table/empty-state";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type State = "pending" | "live" | "inactive";
type Row = {
  vendor_id: number;
  vendor_name: string;
  shop_name: string | null;
  state: State;
  image_url: string | null;
  image_pending_url: string | null;
  updated_at: string | null;
};

const badgeFor = (s: State) => (s === "pending" ? "pending" : s === "inactive" ? "inactive" : "active");

export default function ShopImageApprovalPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/admin/shop-images");
      setRows((res.data.data?.items ?? []) as Row[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function act(id: number, action: "approve" | "deactivate" | "reactivate", okMsg: string) {
    setBusy(id);
    try {
      await api.post(`/admin/shop-images/${id}/${action}`);
      toast.success(okMsg);
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function submitReject() {
    if (!rejecting) return;
    if (!reason.trim()) { toast.error("Enter a reason"); return; }
    const id = rejecting.vendor_id;
    setBusy(id);
    try {
      await api.post(`/admin/shop-images/${id}/reject`, { reason: reason.trim() });
      toast.success("Shop image rejected");
      setRejecting(null);
      setReason("");
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <MobileHeader title="Shop image approval" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Vendors"
          icon={ImageIcon}
          title="Shop Image Approval"
          description="Vendors upload a shop image; it shows to customers only after approval. You can also hide (deactivate) a live image or bring it back."
        />
        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_140px_110px_110px_180px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Vendor / shop</span><span>Image</span><span>State</span><span>Submitted</span><span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={ImageIcon} title="No shop images yet" description="Vendor shop images appear here for review & management." />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const img = r.state === "pending" ? r.image_pending_url : r.image_url;
                return (
                  <div key={r.vendor_id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[1fr_140px_110px_110px_180px]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.shop_name || r.vendor_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.vendor_name}</p>
                    </div>
                    <div className="hidden md:block">
                      {img ? (
                        <a href={img} target="_blank" rel="noreferrer">
                          <img src={img} alt="" className={`h-14 w-28 rounded-lg border border-border object-cover ${r.state === "inactive" ? "opacity-40 grayscale" : ""}`} />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="hidden md:block"><StatusBadge status={badgeFor(r.state)} /></div>
                    <span className="hidden text-xs text-muted-foreground md:block">{(r.updated_at ?? "").replace("T", " ").slice(0, 16) || "—"}</span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="md:hidden"><StatusBadge status={badgeFor(r.state)} /></span>
                      {r.state === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-emerald-500" disabled={busy === r.vendor_id} onClick={() => void act(r.vendor_id, "approve", "Shop image approved")}>
                            {busy === r.vendor_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-rose-500" disabled={busy === r.vendor_id} onClick={() => { setRejecting(r); setReason(""); }}>
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {r.state === "live" && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-amber-500" disabled={busy === r.vendor_id} onClick={() => void act(r.vendor_id, "deactivate", "Shop image hidden from customers")}>
                          {busy === r.vendor_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />} Deactivate
                        </Button>
                      )}
                      {r.state === "inactive" && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-emerald-500" disabled={busy === r.vendor_id} onClick={() => void act(r.vendor_id, "reactivate", "Shop image live again")}>
                          {busy === r.vendor_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setReason(""); } }}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Reject shop image</DialogTitle>
            <DialogDescription>Tell {rejecting?.shop_name || rejecting?.vendor_name || "the vendor"} why, so they can upload a better one.</DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Image is blurry / contains text / not your shopfront"
            className="w-full rounded-xl border border-input bg-surface-2/60 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejecting(null); setReason(""); }} disabled={busy !== null}>Cancel</Button>
            <GradientButton onClick={() => void submitReject()} disabled={busy !== null}>
              {busy !== null ? "Rejecting…" : "Reject"}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
