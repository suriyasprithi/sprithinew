"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Home, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { Button } from "@/components/ui/button";
import {
  AddressFields,
  emptyAddressForm,
  formToAddress,
  formatAddress,
  type AddressForm,
} from "@/components/address/address-fields";
import { api, apiErrorMessage, type CustomerAddress } from "@/lib/api";

function normalize(items: unknown[]): CustomerAddress[] {
  return (items as CustomerAddress[]).map((a) => ({
    ...a,
    id: Number(a.id),
    is_default: Number(a.is_default),
  }));
}

export default function AddressesPage() {
  const [items, setItems] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // editId: number = editing that address, "new" = adding, null = list only
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyAddressForm);
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/customer/addresses");
        setItems(normalize(res.data.data?.items ?? []));
      } catch (e) {
        toast.error(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isFirst = items.length === 0;

  function openAdd() {
    setForm(emptyAddressForm);
    setMakeDefault(isFirst); // first address is forced default
    setEditId("new");
  }

  function openEdit(a: CustomerAddress) {
    setForm(formToAddress(a));
    setMakeDefault(Number(a.is_default) === 1);
    setEditId(a.id);
  }

  function cancel() {
    setEditId(null);
    setForm(emptyAddressForm);
  }

  async function save() {
    if (!form.address_line.trim()) {
      toast.error("Full address is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, is_default: makeDefault };
      const res =
        editId === "new"
          ? await api.post("/customer/addresses", payload)
          : await api.patch(`/customer/addresses/${editId}`, payload);
      setItems(normalize(res.data.data?.items ?? []));
      toast.success(editId === "new" ? "Address added" : "Address updated");
      cancel();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function setAsDefault(id: number) {
    setBusyId(id);
    try {
      const res = await api.post(`/customer/addresses/${id}/default`);
      setItems(normalize(res.data.data?.items ?? []));
      toast.success("Default address updated");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (items.length <= 1) return; // guarded in UI + backend
    if (!window.confirm("Delete this address?")) return;
    setBusyId(id);
    try {
      const res = await api.delete(`/customer/addresses/${id}`);
      setItems(normalize(res.data.data?.items ?? []));
      toast.success("Address deleted");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  // First-ever address must be default; editing the current default can't unset it here.
  const lockDefault = editId === "new" ? isFirst : makeDefault;

  return (
    <>
      <AppHeader title="Delivery addresses" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Profile
        </Link>

        {loading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Add / Edit form */}
            {editId !== null ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <LuxuryCard hoverLift={false} className="space-y-3 p-4">
                  <p className="text-sm font-semibold">
                    {editId === "new" ? "Add a new address" : "Edit address"}
                  </p>
                  <AddressFields form={form} setForm={setForm} />
                  <label
                    className={`flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/60 p-3 text-sm ${
                      lockDefault ? "opacity-70" : "cursor-pointer hover:border-brand/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={makeDefault}
                      disabled={lockDefault}
                      onChange={(e) => setMakeDefault(e.target.checked)}
                      className="h-4 w-4 accent-brand"
                    />
                    <span>
                      Set as default address
                      {lockDefault && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {editId === "new" ? "(first address)" : "(set another as default to change)"}
                        </span>
                      )}
                    </span>
                  </label>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" className="flex-1" disabled={saving} onClick={cancel}>
                      Cancel
                    </Button>
                    <GradientButton className="flex-1" disabled={saving} onClick={() => void save()}>
                      {saving ? "Saving…" : "Save address"}
                    </GradientButton>
                  </div>
                </LuxuryCard>
              </motion.div>
            ) : (
              <Button variant="outline" className="w-full" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add new address
              </Button>
            )}

            {/* Address list */}
            {items.length === 0 && editId === null ? (
              <LuxuryCard hoverLift={false} className="p-6 text-center text-sm text-muted-foreground">
                <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                No saved addresses yet.
              </LuxuryCard>
            ) : (
              <div className="space-y-3">
                {items.map((a) => {
                  const isDefault = Number(a.is_default) === 1;
                  const busy = busyId === a.id;
                  return (
                    <LuxuryCard key={a.id} hoverLift={false} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Home className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isDefault && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                                <Star className="h-3 w-3 fill-current" /> Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-snug">{formatAddress(a)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        {!isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 text-xs"
                            disabled={busy}
                            onClick={() => void setAsDefault(a.id)}
                          >
                            <Star className="h-3.5 w-3.5" /> Make default
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-xs"
                          disabled={busy}
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto h-7 gap-1.5 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40"
                          disabled={busy || items.length <= 1}
                          title={items.length <= 1 ? "You must keep at least one address" : undefined}
                          onClick={() => void remove(a.id)}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Delete
                        </Button>
                      </div>
                    </LuxuryCard>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
