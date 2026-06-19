"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileDown, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type Vendor = { id: number; name: string };

// Every field we store from the Material Master sheet (= keys posted to the API).
const FIELDS = [
  "name", "price", "mrp", "code", "barcode", "category", "image", "status",
  "cost_price", "profit_percent", "profit", "basic_price", "discount_percent", "discount",
  "wholesale_profit_percent", "wholesale_profit", "wholesale_price", "incentive", "incentive_percent",
  "cashback", "cashback_percent", "net_profit", "tax_amount", "wholesales_2", "gst", "gst_value",
  "supplier_price", "agent_commission_perc", "agent_commission", "cess", "cess_rate", "covid",
  "covid_percent", "cost_price_exceed", "manual_rate", "tax_type", "agent", "csquare", "multi_pricing",
  "created_date", "modified_date",
] as const;
type Field = (typeof FIELDS)[number];
type Item = Record<Field, string>;
const blankItem = (): Item => Object.fromEntries(FIELDS.map((f) => [f, ""])) as Item;

// Full Material Master header order (downloadable template).
const TEMPLATE_HEADERS = [
  "Code", "Barcode", "Product", "MRP_Rate", "Cost_Price", "Sales_Price", "Profit_Percent", "Status", "Category",
  "ManualRate", "Profit", "Basic_Price", "Discount_Percent", "Discount", "Tax_Type", "Wholesale_Profit_Percent",
  "Wholesale_Profit", "Wholesale_Price", "Incentive", "Incentive_Percent", "Created_Date", "Modified_Date",
  "CashBack", "CashBack_Percent", "Agent", "Net_Profit", "Tax_Amount", "Wholesales_2", "ProImage", "CSquare",
  "MultiPricing", "GST", "GST_Value", "Supplier_Price", "AgentCommissonPerc", "Cess", "AgentCommission",
  "Cess_Rate", "Covid", "Covid_Percent", "CostPrice_Exceed",
];

// Normalized sheet header → item field. Tolerant of spacing/underscores/case.
const HMAP: Record<string, Field> = {
  product: "name", name: "name", salesprice: "price", price: "price", mrprate: "mrp", mrp: "mrp",
  code: "code", barcode: "barcode", category: "category", proimage: "image", image: "image", status: "status",
  costprice: "cost_price", profitpercent: "profit_percent", profit: "profit", basicprice: "basic_price",
  discountpercent: "discount_percent", discount: "discount",
  wholesaleprofitpercent: "wholesale_profit_percent", wholesaleprofit: "wholesale_profit", wholesaleprice: "wholesale_price",
  incentive: "incentive", incentivepercent: "incentive_percent", cashback: "cashback", cashbackpercent: "cashback_percent",
  netprofit: "net_profit", taxamount: "tax_amount", wholesales2: "wholesales_2", gst: "gst", gstvalue: "gst_value",
  supplierprice: "supplier_price", agentcommissonperc: "agent_commission_perc", agentcommission: "agent_commission",
  agent: "agent", cess: "cess", cessrate: "cess_rate", covid: "covid", covidpercent: "covid_percent",
  costpriceexceed: "cost_price_exceed", manualrate: "manual_rate", taxtype: "tax_type", csquare: "csquare",
  multipricing: "multi_pricing", createddate: "created_date", modifieddate: "modified_date",
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Minimal RFC-4180-ish CSV parser (handles quotes + embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function rowsToItems(rows: string[][]): Item[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => HMAP[norm(h)] ?? null);
  return rows.slice(1).map((r) => {
    const it = blankItem();
    headers.forEach((key, i) => { if (key) it[key] = (r[i] ?? "").trim(); });
    return it;
  });
}

export default function ImportProductsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/vendors");
        const raw = (res.data.data?.items ?? res.data.data ?? []) as Record<string, unknown>[];
        setVendors(raw.map((v) => ({ id: Number(v.id ?? 0), name: String(v.shop_name || v.name || `Vendor #${v.id}`) })));
      } catch (e) { toast.error(apiErrorMessage(e, "Could not load vendors")); }
    })();
  }, []);

  const valid = useMemo(() => items.filter((i) => i.name.trim() && i.price !== "" && !Number.isNaN(Number(i.price))), [items]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = rowsToItems(parseCsv(String(reader.result ?? "")));
      setItems(parsed);
      if (!parsed.length) toast.error("No rows found — check the file has a header row");
      else if (!parsed.some((i) => i.name)) toast.error("Couldn't find a Product/name column");
    };
    reader.readAsText(f);
  }

  function downloadTemplate() {
    const SAMPLE: Record<string, string> = {
      Code: "P001", Barcode: "8901234567890", Product: "Sample Product",
      MRP_Rate: "120", Sales_Price: "99", Category: "Grocery", Status: "active",
    };
    const sample = TEMPLATE_HEADERS.map((h) => SAMPLE[h] ?? "");
    const csv = TEMPLATE_HEADERS.join(",") + "\n" + sample.join(",") + "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "material-master-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!vendorId) { toast.error("Pick a vendor first"); return; }
    if (!valid.length) { toast.error("No valid rows to import"); return; }
    setImporting(true);
    try {
      const res = await api.post("/admin/products/import", { vendor_id: Number(vendorId), items: valid });
      const d = res.data.data ?? {};
      toast.success(`Imported ${d.created ?? 0}, skipped ${d.skipped ?? 0}` + (d.errors?.length ? `, ${d.errors.length} error rows` : ""));
      setItems([]); setFileName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(apiErrorMessage(e, "Import failed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <MobileHeader title="Import Products" />
      <section className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={Upload}
          title="Import Products"
          description="Bulk-import a vendor's catalog from a Material Master CSV (Product, Category, Sales_Price, MRP_Rate, Code, Barcode, ProImage, Status)."
        />

        <LuxuryCard className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-input bg-surface-2/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">{vendors.length ? "Select a vendor" : "Loading…"}</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">All products in the file are imported under this vendor.</p>
          </div>

          <div className="space-y-1.5">
            <Label>CSV file</Label>
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={pickFile} className="hidden" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} disabled={importing}>
                <Upload className="h-4 w-4" /> {fileName || "Choose CSV"}
              </Button>
              <Button variant="ghost" onClick={downloadTemplate} disabled={importing}>
                <FileDown className="h-4 w-4" /> Template
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-sm">
              <p><span className="font-semibold">{valid.length}</span> valid of {items.length} rows ready to import.</p>
              {valid.length > 0 && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  e.g. {valid.slice(0, 3).map((i) => i.name).join(", ")}{valid.length > 3 ? "…" : ""}
                </p>
              )}
            </div>
          )}

          <GradientButton className="w-full" onClick={() => void runImport()} disabled={importing || !vendorId || !valid.length}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Package className="h-4 w-4" /> Import {valid.length || ""} products</>}
          </GradientButton>
          <p className="text-[11px] text-muted-foreground">
            Categories are matched by name (created if new). Duplicate products (same vendor + name/code) are skipped. Internal
            columns (cost, profit, GST, wholesale…) are ignored.
          </p>
        </LuxuryCard>
      </section>
    </>
  );
}
