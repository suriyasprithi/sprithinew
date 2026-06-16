"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Upload, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";

type Row = {
  id: number;
  title: string | null;
  video_url: string;
  sort_order: number;
  status: "active" | "inactive";
  created_at: string;
};

const MAX_MB = 25;

export default function CustomerVideosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [actBusy, setActBusy] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/admin/customer-videos");
      setRows((res.data.data?.items ?? []) as Row[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Video must be ${MAX_MB} MB or smaller`); return; }
    setFile(f);
  }

  async function submit() {
    if (!file) { toast.error("Choose a video first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await api.post("/admin/customer-videos/upload", fd);
      const path = up.data.data?.path as string;
      await api.post("/admin/customer-videos", { video_path: path, title: title.trim() || undefined });
      toast.success("Video added");
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      void refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: Row) {
    setActBusy(r.id);
    try {
      await api.patch(`/admin/customer-videos/${r.id}`, { status: r.status === "active" ? "inactive" : "active" });
      void refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setActBusy(null);
    }
  }

  async function remove(r: Row) {
    if (!confirm("Delete this video?")) return;
    setActBusy(r.id);
    try {
      await api.delete(`/admin/customer-videos/${r.id}`);
      setRows((cur) => cur.filter((x) => x.id !== r.id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setActBusy(null);
    }
  }

  return (
    <>
      <MobileHeader title="Customer videos" />
      <section className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader eyebrow="Home" icon={Film} title="Customer Videos" description="Promo videos shown in the customer home video carousel. Upload, then activate or deactivate." />

        <LuxuryCard className="space-y-3 p-5">
          <input ref={inputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={pick} />
          <Button variant="outline" className="w-full justify-start truncate" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" /> {file ? file.name : "Choose video"}
          </Button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full rounded-xl border border-input bg-surface-2/60 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <GradientButton className="w-full" onClick={() => void submit()} disabled={busy || !file}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add video"}
          </GradientButton>
          <p className="text-[11px] text-muted-foreground">MP4 or WEBM · up to {MAX_MB} MB · muted autoplay on the home carousel.</p>
        </LuxuryCard>

        <div>
          <p className="mb-2 text-sm font-semibold">Videos</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={Film} title="No customer videos yet" />
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <LuxuryCard key={r.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <video src={fileUrl(r.video_url) ?? ""} muted playsInline className="h-12 w-20 shrink-0 rounded bg-black object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.title || "Untitled video"}</p>
                      <p className="text-xs text-muted-foreground">{r.created_at}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={actBusy === r.id} onClick={() => void toggle(r)}>
                      {actBusy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : r.status === "active" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {r.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-rose-500" disabled={actBusy === r.id} onClick={() => void remove(r)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </LuxuryCard>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
