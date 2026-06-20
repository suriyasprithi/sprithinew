"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerAddress } from "@/lib/api";

export type AddressForm = { address_line: string; landmark: string; city: string; pincode: string };

export const emptyAddressForm: AddressForm = { address_line: "", landmark: "", city: "", pincode: "" };

export function formToAddress(a: CustomerAddress): AddressForm {
  return {
    address_line: a.address_line ?? "",
    landmark: a.landmark ?? "",
    city: a.city ?? "",
    pincode: a.pincode ?? "",
  };
}

/** Single-line summary of a saved address. */
export function formatAddress(a: CustomerAddress): string {
  return [a.address_line, a.landmark ? `Near ${a.landmark}` : null, a.city, a.pincode]
    .filter(Boolean)
    .join(", ");
}

export function AddressFields({
  form,
  setForm,
  idPrefix = "addr",
}: {
  form: AddressForm;
  setForm: (f: AddressForm) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}_line`}>Full address</Label>
        <Textarea
          id={`${idPrefix}_line`}
          rows={2}
          value={form.address_line}
          onChange={(e) => setForm({ ...form, address_line: e.target.value })}
          placeholder="House no, street, area"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}_landmark`}>Landmark</Label>
        <Input
          id={`${idPrefix}_landmark`}
          value={form.landmark}
          onChange={(e) => setForm({ ...form, landmark: e.target.value })}
          placeholder="Near…"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}_city`}>City</Label>
          <Input
            id={`${idPrefix}_city`}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}_pin`}>Pincode</Label>
          <Input
            id={`${idPrefix}_pin`}
            inputMode="numeric"
            maxLength={6}
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
          />
        </div>
      </div>
    </div>
  );
}
