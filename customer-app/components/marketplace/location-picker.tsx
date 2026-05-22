"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type State    = { id: number; name: string };
type District = { id: number; state_id: number; name: string };
type Taluk    = { id: number; district_id: number; name: string };

export type LocationSelection = {
  state_id: number | null;
  district_id: number | null;
  taluk_id: number | null;
  label: string;
};

const STORAGE_KEY = "epey.deliveryLocation";

export function readSavedLocation(): LocationSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LocationSelection;
    if (!v || typeof v !== "object") return null;
    return v;
  } catch { return null; }
}

function saveLocation(v: LocationSelection) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  // Notify same-tab listeners.
  window.dispatchEvent(new Event("epey-location-changed"));
}

export function clearLocation() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("epey-location-changed"));
}

export function LocationPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [states, setStates]       = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [taluks, setTaluks]       = useState<Taluk[]>([]);
  const [stateId, setStateId]       = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [talukId, setTalukId]       = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const r = await api.get("/public/locations");
        if (cancelled) return;
        setStates(r.data?.data?.states ?? []);
        setDistricts(r.data?.data?.districts ?? []);
        setTaluks(r.data?.data?.taluks ?? []);
        const saved = readSavedLocation();
        if (saved) {
          setStateId(saved.state_id);
          setDistrictId(saved.district_id);
          setTalukId(saved.taluk_id);
        }
      } catch {
        if (!cancelled) toast.error("Could not load locations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const districtsForState = useMemo(
    () => stateId == null ? [] : districts.filter((d) => d.state_id === stateId),
    [districts, stateId],
  );
  const taluksForDistrict = useMemo(
    () => districtId == null ? [] : taluks.filter((t) => t.district_id === districtId),
    [taluks, districtId],
  );

  function apply() {
    const stName = states.find((s) => s.id === stateId)?.name ?? "";
    const dName  = districts.find((d) => d.id === districtId)?.name ?? "";
    const tName  = taluks.find((t) => t.id === talukId)?.name ?? "";
    if (!stName) { toast.error("Pick a state"); return; }
    const parts  = [tName, dName, stName].filter(Boolean);
    const label  = parts.join(", ");
    saveLocation({ state_id: stateId, district_id: districtId, taluk_id: talukId, label });
    onClose();
    const params = new URLSearchParams();
    if (talukId)    params.set("taluk_id",    String(talukId));
    if (districtId && !talukId) params.set("district_id", String(districtId));
    if (stateId && !districtId && !talukId) params.set("state_id", String(stateId));
    router.push(`/shop-public${params.toString() ? `?${params}` : ""}`);
  }

  function reset() {
    clearLocation();
    setStateId(null); setDistrictId(null); setTalukId(null);
    onClose();
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="marketplace-theme fixed inset-0 z-[100] overflow-y-hidden"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-3">
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-[var(--mk-text)] shadow-2xl ring-1 ring-black/5"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header — brand-tinted band */}
          <header className="flex items-center justify-between border-b border-[var(--mk-border)] bg-[var(--mk-brand-soft)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--mk-brand)] text-white">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[15px] font-bold leading-tight text-[var(--mk-text)]">Choose delivery location</p>
                <p className="text-[11px] text-[var(--mk-text-muted)]">Products from local vendors only</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-[var(--mk-text-muted)] hover:bg-white hover:text-[var(--mk-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Body — form fields */}
          <div className="space-y-4 px-5 py-5">
            <Field label="State">
              <select
                value={stateId ?? ""}
                onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setStateId(v); setDistrictId(null); setTalukId(null); }}
                disabled={loading || states.length === 0}
                className="h-11 w-full appearance-none rounded-xl border border-[var(--mk-border)] bg-white px-3 pr-8 text-sm font-medium text-[var(--mk-text)] outline-none transition-colors hover:border-[var(--mk-brand)]/50 focus:border-[var(--mk-brand)] focus:ring-2 focus:ring-[var(--mk-brand)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
              >
                <option value="">{loading ? "Loading…" : "Pick a state"}</option>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            <Field label="District">
              <select
                value={districtId ?? ""}
                onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setDistrictId(v); setTalukId(null); }}
                disabled={stateId == null}
                className="h-11 w-full appearance-none rounded-xl border border-[var(--mk-border)] bg-white px-3 pr-8 text-sm font-medium text-[var(--mk-text)] outline-none transition-colors hover:border-[var(--mk-brand)]/50 focus:border-[var(--mk-brand)] focus:ring-2 focus:ring-[var(--mk-brand)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
              >
                <option value="">{stateId == null ? "Pick a state first" : (districtsForState.length === 0 ? "No districts" : "Pick a district")}</option>
                {districtsForState.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>

            <Field label="Taluk" hint="Optional — leave for district-wide.">
              <select
                value={talukId ?? ""}
                onChange={(e) => setTalukId(e.target.value ? Number(e.target.value) : null)}
                disabled={districtId == null}
                className="h-11 w-full appearance-none rounded-xl border border-[var(--mk-border)] bg-white px-3 pr-8 text-sm font-medium text-[var(--mk-text)] outline-none transition-colors hover:border-[var(--mk-brand)]/50 focus:border-[var(--mk-brand)] focus:ring-2 focus:ring-[var(--mk-brand)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
              >
                <option value="">{districtId == null ? "Pick a district first" : (taluksForDistrict.length === 0 ? "No taluks" : "Any (district-wide)")}</option>
                {taluksForDistrict.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-between gap-2 border-t border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-5 py-4">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-[var(--mk-text-muted)] underline-offset-2 hover:text-[var(--mk-text)] hover:underline"
            >
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--mk-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--mk-text)] transition-colors hover:border-[var(--mk-brand)]/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={stateId == null}
                className="rounded-xl bg-[var(--mk-brand)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--mk-brand-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--mk-text-muted)]">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[var(--mk-text-muted)]">{hint}</p>}
    </div>
  );
}
