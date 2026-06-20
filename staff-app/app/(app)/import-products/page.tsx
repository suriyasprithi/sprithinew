"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileDown, Loader2, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type Vendor = { id: number; name: string };
type FailedRow = { row: number; name?: string; reason?: string };
type ImportResult = { created: number; updated: number; skipped: number; failed: number; failedRows: FailedRow[] };

// Every field we send to the API (= keys the backend reads from each item).
// Comprehensive catalog fields first; the old Material Master columns are kept
// at the end so legacy sheets still import.
const FIELDS = [
  // Core catalog
  "name", "price", "mrp", "code", "barcode", "category", "sub_category", "image", "gallery_images",
  "status", "featured", "brand", "hsn_code", "description", "short_description", "tags", "unit",
  // Tax + discount
  "cost_price", "tax_type", "tax_percentage", "tax_amount", "discount_type", "discount_value", "discount_amount",
  // Stock + dimensions + fulfilment
  "stock", "min_stock_alert", "max_order_qty", "weight", "length", "width", "height",
  "delivery_charge", "return_days", "warranty_days",
  // Material Master back-compat (still accepted, stored as-is)
  "profit_percent", "profit", "basic_price", "discount_percent", "discount",
  "wholesale_profit_percent", "wholesale_profit", "wholesale_price", "incentive", "incentive_percent",
  "cashback", "cashback_percent", "net_profit", "wholesales_2", "gst", "gst_value",
  "supplier_price", "agent_commission_perc", "agent_commission", "cess", "cess_rate", "covid",
  "covid_percent", "cost_price_exceed", "manual_rate", "agent", "csquare", "multi_pricing",
  "created_date", "modified_date",
] as const;
type Field = (typeof FIELDS)[number];
type Item = Record<Field, string>;
const blankItem = (): Item => Object.fromEntries(FIELDS.map((f) => [f, ""])) as Item;

// Full comprehensive-catalog header order (downloadable template, 34 columns).
const TEMPLATE_HEADERS = [
  "Product Name", "Category", "Sub Category", "Brand", "SKU / Product Code", "Barcode", "HSN Code",
  "MRP", "Selling Price", "Cost Price", "Tax Type", "Tax Percentage", "Tax Amount",
  "Discount Type", "Discount Value", "Discount Amount", "Stock Quantity", "Minimum Stock Alert",
  "Maximum Order Quantity", "Weight", "Length", "Width", "Height", "Unit", "Delivery Charge",
  "Return Days", "Warranty Days", "Short Description", "Description", "Tags", "Main Image URL",
  "Gallery Image URLs", "Product Status", "Featured Product Flag",
];

// Normalized sheet header → item field. Tolerant of spacing/underscores/case.
// Covers both the new catalog headers and the legacy Material Master ones.
const HMAP: Record<string, Field> = {
  // Core
  productname: "name", product: "name", name: "name",
  sellingprice: "price", salesprice: "price", price: "price",
  mrp: "mrp", mrprate: "mrp",
  skuproductcode: "code", productcode: "code", sku: "code", code: "code",
  barcode: "barcode",
  hsncode: "hsn_code", hsn: "hsn_code",
  category: "category",
  subcategory: "sub_category", subcat: "sub_category",
  brand: "brand",
  mainimageurl: "image", proimage: "image", imageurl: "image", image: "image",
  galleryimageurls: "gallery_images", galleryimages: "gallery_images", gallery: "gallery_images",
  productstatus: "status", status: "status",
  featuredproductflag: "featured", featuredproduct: "featured", featured: "featured",
  description: "description", shortdescription: "short_description",
  tags: "tags", unit: "unit",
  // Tax + discount
  costprice: "cost_price",
  taxtype: "tax_type", taxpercentage: "tax_percentage", taxpercent: "tax_percentage", taxamount: "tax_amount",
  discounttype: "discount_type", discountvalue: "discount_value", discountamount: "discount_amount",
  // Stock + dimensions + fulfilment
  stockquantity: "stock", stock: "stock",
  minimumstockalert: "min_stock_alert", minstockalert: "min_stock_alert",
  maximumorderquantity: "max_order_qty", maxorderqty: "max_order_qty", maxorderquantity: "max_order_qty",
  weight: "weight", length: "length", width: "width", height: "height",
  deliverycharge: "delivery_charge", returndays: "return_days", warrantydays: "warranty_days",
  // Material Master back-compat
  profitpercent: "profit_percent", profit: "profit", basicprice: "basic_price",
  discountpercent: "discount_percent", discount: "discount",
  wholesaleprofitpercent: "wholesale_profit_percent", wholesaleprofit: "wholesale_profit", wholesaleprice: "wholesale_price",
  incentive: "incentive", incentivepercent: "incentive_percent", cashback: "cashback", cashbackpercent: "cashback_percent",
  netprofit: "net_profit", wholesales2: "wholesales_2", gst: "gst", gstvalue: "gst_value",
  supplierprice: "supplier_price", agentcommissonperc: "agent_commission_perc", agentcommission: "agent_commission",
  agent: "agent", cess: "cess", cessrate: "cess_rate", covid: "covid", covidpercent: "covid_percent",
  costpriceexceed: "cost_price_exceed", manualrate: "manual_rate", csquare: "csquare",
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

// Send rows in chunks so a 1000+ row catalog imports smoothly without one giant request.
const CHUNK = 250;

export default function ImportProductsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
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

  // Required fields = Product Name + a valid Selling Price.
  const valid = useMemo(() => items.filter((i) => i.name.trim() && i.price !== "" && !Number.isNaN(Number(i.price))), [items]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = rowsToItems(parseCsv(String(reader.result ?? "")));
      setItems(parsed);
      if (!parsed.length) toast.error("No rows found — check the file has a header row");
      else if (!parsed.some((i) => i.name)) toast.error("Couldn't find a Product Name column");
    };
    reader.readAsText(f);
  }

  function downloadTemplate() {
    const SAMPLE: Record<string, string> = {
      "Product Name": "Sample Product", "Category": "Grocery", "Sub Category": "Rice", "Brand": "Acme",
      "SKU / Product Code": "P001", "Barcode": "8901234567890", "HSN Code": "1006",
      "MRP": "120", "Selling Price": "99", "Cost Price": "70", "Tax Type": "Exclusive", "Tax Percentage": "5", "Tax Amount": "",
      "Discount Type": "percentage", "Discount Value": "10", "Discount Amount": "", "Stock Quantity": "100",
      "Minimum Stock Alert": "10", "Maximum Order Quantity": "5", "Weight": "1", "Length": "10", "Width": "8", "Height": "5",
      "Unit": "kg", "Delivery Charge": "0", "Return Days": "7", "Warranty Days": "0",
      "Short Description": "Premium basmati rice", "Description": "5kg pack of premium basmati rice", "Tags": "rice,grocery,basmati",
      "Main Image URL": "https://example.com/p001.jpg",
      "Gallery Image URLs": "https://example.com/p001-2.jpg | https://example.com/p001-3.jpg",
      "Product Status": "active", "Featured Product Flag": "no",
    };
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const sample = TEMPLATE_HEADERS.map((h) => esc(SAMPLE[h] ?? ""));
    const csv = TEMPLATE_HEADERS.join(",") + "\n" + sample.join(",") + "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "product-catalog-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!vendorId) { toast.error("Pick a vendor first"); return; }
    if (!valid.length) { toast.error("No valid rows to import"); return; }
    setImporting(true);
    setResult(null);
    const agg: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, failedRows: [] };
    try {
      for (let i = 0; i < valid.length; i += CHUNK) {
        const chunk = valid.slice(i, i + CHUNK);
        setProgress(`Importing ${Math.min(i + chunk.length, valid.length)} / ${valid.length}…`);
        const res = await api.post("/admin/products/import", { vendor_id: Number(vendorId), items: chunk });
        const d = res.data.data ?? {};
        agg.created += Number(d.created ?? 0);
        agg.updated += Number(d.updated ?? 0);
        agg.skipped += Number(d.skipped ?? 0);
        agg.failed += Number(d.failed_count ?? (Array.isArray(d.failed) ? d.failed.length : 0));
        if (Array.isArray(d.failed)) {
          agg.failedRows.push(...d.failed.slice(0, 50).map((f: FailedRow) => ({ ...f, row: (Number(f.row) || 0) + i })));
        }
      }
      setResult(agg);
      setProgress("");
      toast.success(
        `Created ${agg.created}, updated ${agg.updated}, skipped ${agg.skipped}` + (agg.failed ? `, ${agg.failed} failed` : ""),
      );
      setItems([]); setFileName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setProgress("");
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
          description="Bulk-import a vendor's catalog from a CSV. Categories & sub-categories are created automatically; existing products (matched by SKU/Code) are updated, new ones are created."
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
              {items.length > valid.length && (
                <p className="mt-1 text-xs text-amber-600">{items.length - valid.length} row(s) missing Product Name or Selling Price will be skipped.</p>
              )}
              {valid.length > 0 && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  e.g. {valid.slice(0, 3).map((i) => i.name).join(", ")}{valid.length > 3 ? "…" : ""}
                </p>
              )}
            </div>
          )}

          <GradientButton className="w-full" onClick={() => void runImport()} disabled={importing || !vendorId || !valid.length}>
            {importing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress || "Importing…"}</>
              : <><Package className="h-4 w-4" /> Import {valid.length || ""} products</>}
          </GradientButton>

          <p className="text-[11px] text-muted-foreground">
            Required columns: <span className="font-medium">Product Name</span> + <span className="font-medium">Selling Price</span>.
            Discount & tax amounts are computed from type/value/percentage. Images are stored as URLs. Internal accounting
            columns (cost, profit, GST, wholesale…) are stored but never shown to customers.
          </p>
        </LuxuryCard>

        {result && (
          <LuxuryCard className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h3 className="text-sm font-semibold">Import summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat label="Created" value={result.created} tone="text-emerald-600" />
              <Stat label="Updated" value={result.updated} tone="text-sky-600" />
              <Stat label="Skipped" value={result.skipped} tone="text-muted-foreground" />
              <Stat label="Failed" value={result.failed} tone={result.failed ? "text-red-600" : "text-muted-foreground"} />
            </div>
            {result.failedRows.length > 0 && (
              <details className="rounded-xl border border-border bg-surface-2/40 p-3 text-xs">
                <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" /> {result.failed} failed row(s)
                </summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {result.failedRows.slice(0, 100).map((f, idx) => (
                    <li key={idx}>Row {f.row}{f.name ? ` (${f.name})` : ""}: {f.reason || "error"}</li>
                  ))}
                </ul>
              </details>
            )}
          </LuxuryCard>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-center">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
