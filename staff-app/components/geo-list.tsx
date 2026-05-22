"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiErrorMessage } from "@/lib/api";

type District = { id: number; name: string; state: string | null; status: "active" | "inactive" };
type Taluk    = { id: number; district_id: number; name: string; status: "active" | "inactive" };

export function DistrictsList() {
  const [items, setItems] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<District> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); try { const r = await api.get("/geo/districts"); setItems((r.data.data?.items ?? []) as District[]); } catch (err) { toast.error(apiErrorMessage(err)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editing?.name) return; setBusy(true);
    try { if (editing.id) await api.patch(`/geo/districts/${editing.id}`, { name: editing.name, state: editing.state ?? null, status: editing.status }); else await api.post(`/geo/districts`, { name: editing.name, state: editing.state ?? null }); toast.success("Saved"); setEditing(null); await load(); }
    catch (err) { toast.error(apiErrorMessage(err)); } finally { setBusy(false); }
  };
  const del = async (id: number) => { if (!window.confirm("Delete?")) return; try { await api.delete(`/geo/districts/${id}`); await load(); } catch (err) { toast.error(apiErrorMessage(err)); } };

  return (
    <>
      <div className="flex justify-end"><Button size="sm" onClick={() => setEditing({ name: "", state: "", status: "active" })} className="gap-1 bg-brand text-brand-foreground hover:bg-brand/90"><Plus className="h-4 w-4" /> Add district</Button></div>
      {editing && (
        <Card><CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{editing.id ? "Edit" : "New"} district</h3><Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button></div>
          <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>State</Label><Input value={editing.state ?? ""} onChange={(e) => setEditing({ ...editing, state: e.target.value })} /></div>
            <div className="md:col-span-2"><Button type="submit" disabled={busy} className="bg-brand text-brand-foreground hover:bg-brand/90">{busy ? "Saving..." : "Save"}</Button></div>
          </form>
        </CardContent></Card>
      )}
      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div> :
        items.length === 0 ? <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No districts.</CardContent></Card> :
        <div className="space-y-2">{items.map((d) => (
          <Card key={d.id}><CardContent className="flex items-center justify-between p-3">
            <div><p className="text-sm font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.state ?? "—"} · {d.status}</p></div>
            <div className="flex gap-1"><Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditing(d)}><Pencil className="h-3 w-3" /></Button><Button size="icon" variant="outline" className="h-8 w-8 text-rose-600" onClick={() => del(d.id)}><Trash2 className="h-3 w-3" /></Button></div>
          </CardContent></Card>
        ))}</div>
      }
    </>
  );
}

export function TaluksList() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [items, setItems] = useState<Taluk[]>([]);
  const [filterDistrict, setFilterDistrict] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Taluk> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([api.get("/geo/districts"), api.get("/geo/taluks", { params: filterDistrict ? { district_id: filterDistrict } : {} })]);
      setDistricts((d.data.data?.items ?? []) as District[]);
      setItems((t.data.data?.items ?? []) as Taluk[]);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterDistrict]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editing?.name || !editing?.district_id) return toast.error("Pick district + name");
    setBusy(true);
    try { if (editing.id) await api.patch(`/geo/taluks/${editing.id}`, { name: editing.name, district_id: editing.district_id, status: editing.status }); else await api.post(`/geo/taluks`, { name: editing.name, district_id: editing.district_id }); toast.success("Saved"); setEditing(null); await load(); }
    catch (err) { toast.error(apiErrorMessage(err)); } finally { setBusy(false); }
  };
  const del = async (id: number) => { if (!window.confirm("Delete?")) return; try { await api.delete(`/geo/taluks/${id}`); await load(); } catch (err) { toast.error(apiErrorMessage(err)); } };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value ? Number(e.target.value) : "")} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">All districts</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <Button size="sm" onClick={() => setEditing({ name: "", district_id: districts[0]?.id ?? 0, status: "active" })} className="ml-auto gap-1 bg-brand text-brand-foreground hover:bg-brand/90"><Plus className="h-4 w-4" /> Add taluk</Button>
      </div>
      {editing && (
        <Card><CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{editing.id ? "Edit" : "New"} taluk</h3><Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button></div>
          <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label>District</Label>
              <select value={editing.district_id ?? ""} onChange={(e) => setEditing({ ...editing, district_id: Number(e.target.value) })} required className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Select…</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></div>
            <div className="md:col-span-2"><Button type="submit" disabled={busy} className="bg-brand text-brand-foreground hover:bg-brand/90">{busy ? "Saving..." : "Save"}</Button></div>
          </form>
        </CardContent></Card>
      )}
      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div> :
        items.length === 0 ? <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No taluks.</CardContent></Card> :
        <div className="space-y-2">{items.map((t) => {
          const dn = districts.find((d) => d.id === t.district_id)?.name ?? "?";
          return (
            <Card key={t.id}><CardContent className="flex items-center justify-between p-3">
              <div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{dn} · {t.status}</p></div>
              <div className="flex gap-1"><Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditing(t)}><Pencil className="h-3 w-3" /></Button><Button size="icon" variant="outline" className="h-8 w-8 text-rose-600" onClick={() => del(t.id)}><Trash2 className="h-3 w-3" /></Button></div>
            </CardContent></Card>
          );
        })}</div>
      }
    </>
  );
}
