"use client";

import { useEffect, useState } from "react";
import { Video, Check, X, Play, Loader2, Image as ImageIcon, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";

type Row = {
  id: number;
  type: "banner" | "video";
  attachment: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "inactive";
  created_at: string;
  vendor_name: string;
};

export default function AdRequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ type: "banner" | "video"; url: string } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/admin/ad-requests");
      setRows((res.data.data?.items ?? []) as Row[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function decide(id: number, action: "approve" | "reject") {
    setBusy(id);
    try {
      await api.post(`/admin/ad-requests/${id}/${action}`);
      toast.success(`Request ${action === "approve" ? "approved" : "rejected"}`);
      void refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleVideo(id: number, action: "deactivate" | "reactivate") {
    setBusy(id);
    try {
      await api.post(`/admin/ad-requests/${id}/${action}`);
      toast.success(action === "deactivate" ? "Hidden from home" : "Showing on home");
      void refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function useAsBanner(id: number) {
    setBusy(id);
    try {
      await api.post(`/admin/ad-requests/${id}/use-as-banner`);
      toast.success("Draft banner created — open Home Banners to set the slot/title and publish");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <MobileHeader title="Ad requests" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader eyebrow="Ads" icon={Video} title="Ad requests" description="Banner & video ad requests from vendors — review, approve or reject." />
        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_90px_120px_110px_150px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Vendor / note</span><span>Type</span><span>Creative</span><span>Status</span><span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Video} title="No ad requests yet" />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[1fr_90px_120px_110px_150px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.vendor_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.notes || "—"} · {r.created_at}</p>
                    {/* Mobile-only creative preview trigger (the Creative column is hidden < md). */}
                    {r.attachment && (
                      <div className="mt-2 md:hidden">
                        {r.type === "banner" ? (
                          <button type="button" onClick={() => setPreview({ type: "banner", url: fileUrl(r.attachment) ?? "" })} aria-label="Preview banner">
                            <img src={fileUrl(r.attachment) ?? ""} alt="" className="h-12 w-20 rounded object-cover" />
                          </button>
                        ) : (
                          <button type="button" onClick={() => setPreview({ type: "video", url: fileUrl(r.attachment) ?? "" })} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-brand">
                            <Play className="h-3 w-3" /> Play video
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="hidden text-xs capitalize md:block">{r.type}</span>
                  <div className="hidden md:block">
                    {r.attachment ? (
                      r.type === "banner" ? (
                        <button type="button" onClick={() => setPreview({ type: "banner", url: fileUrl(r.attachment) ?? "" })} className="group relative block" aria-label="Preview banner">
                          <img src={fileUrl(r.attachment) ?? ""} alt="" className="h-10 w-16 rounded object-cover transition group-hover:opacity-80" />
                          <span className="absolute inset-0 flex items-center justify-center rounded opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                            <Eye className="h-4 w-4 text-white" />
                          </span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => setPreview({ type: "video", url: fileUrl(r.attachment) ?? "" })} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                          <Play className="h-3 w-3" /> Play video
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="hidden md:block"><StatusBadge status={r.status} /></div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="md:hidden"><StatusBadge status={r.status} /></span>
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-emerald-500" disabled={busy === r.id} onClick={() => void decide(r.id, "approve")}>
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-rose-500" disabled={busy === r.id} onClick={() => void decide(r.id, "reject")}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </>
                    )}
                    {r.status === "approved" && r.type === "banner" && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-brand" disabled={busy === r.id} onClick={() => void useAsBanner(r.id)}>
                        {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Use as banner
                      </Button>
                    )}
                    {r.type === "video" && r.status === "approved" && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-amber-500" disabled={busy === r.id} onClick={() => void toggleVideo(r.id, "deactivate")}>
                        {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />} Deactivate
                      </Button>
                    )}
                    {r.type === "video" && r.status === "inactive" && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-emerald-500" disabled={busy === r.id} onClick={() => void toggleVideo(r.id, "reactivate")}>
                        {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Banner / video preview — responsive: fills the phone width (minus a margin),
          caps at 2xl on tablet/desktop; media scales to fit and never overflows. */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="w-full max-w-[calc(100vw-1.5rem)] rounded-2xl border-border bg-popover sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.type === "video" ? "Video preview" : "Banner preview"}</DialogTitle>
          </DialogHeader>
          {preview?.type === "video" ? (
            <video src={preview.url} controls autoPlay playsInline className="mx-auto max-h-[70vh] w-full rounded-lg bg-black object-contain" />
          ) : preview ? (
            <img src={preview.url} alt="" className="mx-auto max-h-[70vh] w-full rounded-lg object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
