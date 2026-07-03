"use client";

import { useEffect, useState } from "react";
import { FileDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadTemplate, isReservedLabel } from "@/lib/catalog-import";
import { useAuth } from "@/stores/auth";

// Remembered per vendor so the attributes they last used are pre-filled next time.
const attrsKey = (id?: number | null) => `epey:import-attrs:${id ?? "anon"}`;

/**
 * Generates the dynamic CSV template: add the variant attributes you need
 * (Color, Size, RAM…) → download. The product's category goes in the CSV's
 * own `category` column (per row). The same universal engine reads any
 * attributes added here.
 */
export function TemplateBuilder() {
  const userId = useAuth((s) => s.user?.id);
  const [attrs, setAttrs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load this vendor's last-used attributes once their id is known.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(attrsKey(userId));
      const arr = raw ? JSON.parse(raw) : [];
      setAttrs(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
    } catch { setAttrs([]); }
    setLoaded(true);
  }, [userId]);

  // Persist on every change — but only after the initial load, so a fresh mount
  // never clobbers the saved list with an empty [].
  useEffect(() => {
    if (!loaded || typeof window === "undefined") return;
    try { localStorage.setItem(attrsKey(userId), JSON.stringify(attrs)); } catch { /* quota/private mode — ignore */ }
  }, [attrs, loaded, userId]);

  function add() {
    const v = input.trim();
    if (!v) return;
    if (isReservedLabel(v)) { toast.error(`"${v}" is a reserved column name — pick a different attribute name.`); return; }
    if (!attrs.some((a) => a.toLowerCase() === v.toLowerCase())) setAttrs((a) => [...a, v]);
    setInput("");
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-surface-2/30 p-4">
      <div>
        <p className="text-sm font-semibold">Build your CSV template</p>
        <p className="text-[11px] text-muted-foreground">
          Add the variant attributes you need (Color, Size, RAM…), then download. Each product&apos;s category goes in the
          CSV&apos;s own <span className="font-medium">category</span> column (created automatically if new).
        </p>
      </div>

      <div className="space-y-2">
        <Label>Variant attributes</Label>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Add attribute (e.g. Color, Size, RAM)"
            className="h-9 flex-1 rounded-lg bg-surface-2/60 text-sm"
          />
          <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={add} disabled={!input.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {attrs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attrs.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/60 px-2 py-0.5 text-xs">
                {a}
                <button type="button" onClick={() => setAttrs((c) => c.filter((x) => x !== a))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-muted-foreground">
          {attrs.length ? `${attrs.length} attribute column(s): ${attrs.join(", ")}` : "No attributes — single-SKU (product-only) template."}
        </p>
        <Button type="button" size="sm" variant="secondary" className="shrink-0 rounded-lg" onClick={() => downloadTemplate(attrs)}>
          <FileDown className="h-3.5 w-3.5" /> Download template
        </Button>
      </div>
    </div>
  );
}
