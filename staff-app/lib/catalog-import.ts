// Universal, attribute-agnostic product-catalog CSV import (no React/DOM).
// Reserved columns map to known fields; EVERY other column is a variant attribute.
// Rows group into products by item_code; each row is one SKU/variant.
// Shared by the admin Import Products page and the vendor Products-page dialog.

// norm: lowercase + strip non-alphanumerics, so "Item Code"/"item_code"/"itemcode" all match.
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Reserved header (normalized) → canonical field. Anything not here ⇒ a variant attribute.
const RESERVED: Record<string, string> = {
  itemcode: "code", productcode: "code", code: "code",
  productname: "name", name: "name",
  sku: "sku", variantsku: "sku", variantname: "variant_name",
  category: "category",
  brand: "brand", description: "description", shortdescription: "short_description", tags: "tags",
  hsncode: "hsn_code", hsn: "hsn_code", barcode: "barcode",
  mrp: "mrp", offerprice: "price", price: "price", sellingprice: "price", salesprice: "price",
  stock: "stock", stockqty: "stock", stockquantity: "stock",
  status: "status", featured: "featured", featuredproductflag: "featured",
  image: "image", mainimageurl: "image", imageurl: "image", proimage: "image",
  galleryimages: "gallery_images", galleryimageurls: "gallery_images", gallery: "gallery_images",
  taxtype: "tax_type", taxpercentage: "tax_percentage", taxpercent: "tax_percentage",
};
// Reserved fields that belong to the VARIANT/row (everything else reserved is product-level).
const ROW_LEVEL = new Set(["sku", "variant_name", "price", "mrp", "stock", "barcode"]);

/** True when a label collides with a reserved column (so it can't be used as an attribute name). */
export const isReservedLabel = (s: string) => Object.prototype.hasOwnProperty.call(RESERVED, norm(s));

export type Variant = {
  sku: string; name: string; options: Record<string, string>;
  price: string; mrp: string; stock: string; barcode: string;
};
export type Group = {
  code: string; name: string; category: string; brand: string;
  description: string; short_description: string; tags: string; hsn_code: string;
  status: string; featured: string; image: string; gallery_images: string;
  tax_type: string; tax_percentage: string;
  // product-only row-level values (used when the group has no variants):
  price: string; mrp: string; stock: string; barcode: string;
  variants: Variant[];
};

const blankGroup = (code: string): Group => ({
  code, name: "", category: "", brand: "", description: "", short_description: "",
  tags: "", hsn_code: "", status: "", featured: "", image: "", gallery_images: "", tax_type: "",
  tax_percentage: "", price: "", mrp: "", stock: "", barcode: "", variants: [],
});

// Minimal RFC-4180-ish CSV parser (quotes + embedded commas/newlines).
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
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

/**
 * Read an uploaded catalog file into raw rows (header row first), supporting
 * both CSV and Excel (.xlsx/.xls). The SheetJS parser is dynamic-imported so it
 * stays out of the main bundle / APK — it only loads when an Excel file is
 * actually picked. Output matches parseCsv (string[][]) so groupRows is unchanged.
 */
export async function fileToRows(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
    return rows
      .map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? "" : String(c))) : []))
      .filter((r) => r.some((c) => c.trim() !== ""));
  }
  return parseCsv(await file.text());
}

// ---- Safe variant auto-detection (Rule 1–3) ---------------------------------
// A clean variant attribute: weight, volume, storage, length, count, clothing
// size, or a colour. Decides whether same-(name,category,brand) rows are a real
// variant set vs a generic name collision / bundle. Never merge on ambiguity.
const BUNDLE_PHRASES = ["combo","bundle","hamper","multipack","multi pack","value pack","combo pack","family pack","economy pack","trial pack","festival pack","gift pack","gift set","saver pack","jumbo pack"];

const stripVal = (s: string) => s.replace(/\\/g, "").trim();

/** A bare price label (30/-, 25) — a price stand-in, never a real variant axis. */
function isPriceLabel(val: string): boolean {
  const v = stripVal(val);
  return /^\d+(\.\d+)?\s*\/-?$/.test(v) || /^\d+(\.\d+)?$/.test(v);
}

/**
 * A real variant value: a size (100G), volume (500ML), colour (Red), storage
 * (128GB) OR any NAMED flavour/type (Oreo, Fruit & Nut) — i.e. anything except a
 * bare price label or a marketing/bundle word. Flavours count like colours do.
 */
export function isCleanAttribute(val: string): boolean {
  const v = stripVal(val);
  if (!v) return false;
  if (isPriceLabel(v)) return false;   // 30/-, 25 → price, not a variant
  if (hasBundleWord(v)) return false;  // combo / pack / gift → marketing
  return true;                         // 100G, 500ML, Red, Oreo, Fruit & Nut …
}

/** Marketing / bundle wording in a variant value or a product name (combo, pack, gift…). */
export function hasBundleWord(s: string): boolean {
  const v = stripVal(s).toLowerCase();
  if (!v) return false;
  if (BUNDLE_PHRASES.some((w) => v.includes(w))) return true;
  return /\b(combo|bundle|hamper|gift|multipack)\b/.test(v) || /\bpack\b/.test(v);
}

export type ReviewRow = { name: string; reason: string; count: number };
export type GroupResult = { groups: Group[]; review: ReviewRow[]; totalRows: number };

type ParsedRow = { f: Record<string, string>; options: Record<string, string>; rowNum: number };

/** Variant value to classify on, by priority: size → colour → storage → ram → first attribute. */
function axisValue(options: Record<string, string>): string {
  const pick = (want: string): string | null => {
    for (const k of Object.keys(options)) if (norm(k) === want) return options[k];
    return null;
  };
  return pick("size") ?? pick("color") ?? pick("colour") ?? pick("storage") ?? pick("ram") ?? Object.values(options)[0] ?? "";
}

/** Fold a set of parsed rows into one product Group (first row = product-level fields). */
function buildGroup(members: ParsedRow[]): Group {
  const first = members[0].f;
  const g = blankGroup((first.code ?? "").trim());
  g.name = first.name ?? ""; g.category = first.category ?? ""; g.brand = first.brand ?? "";
  g.description = first.description ?? ""; g.short_description = first.short_description ?? "";
  g.tags = first.tags ?? ""; g.hsn_code = first.hsn_code ?? ""; g.status = first.status ?? "";
  g.featured = first.featured ?? ""; g.image = first.image ?? ""; g.gallery_images = first.gallery_images ?? "";
  g.tax_type = first.tax_type ?? ""; g.tax_percentage = first.tax_percentage ?? "";
  g.price = first.price ?? ""; g.mrp = first.mrp ?? ""; g.stock = first.stock ?? ""; g.barcode = first.barcode ?? "";
  for (const m of members) {
    const isVariant = !!(m.f.sku && m.f.sku.trim()) || Object.keys(m.options).length > 0;
    if (isVariant) {
      g.variants.push({
        sku: m.f.sku ?? "", name: m.f.variant_name ?? "", options: m.options,
        price: m.f.price ?? "", mrp: m.f.mrp ?? "", stock: m.f.stock ?? "", barcode: m.f.barcode ?? "",
      });
    }
  }
  return g;
}

/**
 * Group rows into products by NAME + CATEGORY + BRAND, auto-detecting variants
 * only when it is safe (Rule 1–3):
 *   - all rows carry a clean attribute (size/volume/colour/…) and the name has
 *     no bundle wording → ONE product with those variants (Rule 1);
 *   - mixed (some attributes + some bundle/blank) → the clean rows form a variant
 *     product, the rest become separate products, and the group is flagged (Rule 3);
 *   - generic (no clean attribute, e.g. price labels) → separate products.
 * Never auto-merges on ambiguity — a wrong merge corrupts the catalog, a missed
 * merge is easy to fix later.
 */
export function groupRows(rows: string[][]): GroupResult {
  if (rows.length < 2) return { groups: [], review: [], totalRows: 0 };
  const cols = rows[0].map((h) => {
    const key = RESERVED[norm(h)];
    return key ? { kind: "field" as const, key } : { kind: "attr" as const, label: h.trim() };
  });

  const parsed: ParsedRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const f: Record<string, string> = {};
    const options: Record<string, string> = {};
    cols.forEach((c, i) => {
      const v = (row[i] ?? "").trim();
      if (c.kind === "field") { if (v !== "") f[c.key] = v; }
      else if (c.label !== "" && v !== "") options[c.label] = v;
    });
    parsed.push({ f, options, rowNum: r });
  }

  // Group by name + category + brand (name alone wrongly merges different brands).
  const map = new Map<string, ParsedRow[]>();
  const order: string[] = [];
  for (const p of parsed) {
    if (!(p.f.name ?? "").trim()) continue;
    const k = [norm(p.f.name ?? ""), norm(p.f.category ?? ""), norm(p.f.brand ?? "")].join("|");
    if (!map.has(k)) { map.set(k, []); order.push(k); }
    map.get(k)!.push(p);
  }

  const groups: Group[] = [];
  const review: ReviewRow[] = [];
  for (const k of order) {
    const members = map.get(k)!;
    const name = members[0].f.name ?? "";
    const clean = members.filter((m) => isCleanAttribute(axisValue(m.options)));
    const dirty = members.filter((m) => !isCleanAttribute(axisValue(m.options)));
    const nameBundle = hasBundleWord(name);

    if (members.length === 1) {
      groups.push(buildGroup(members));
      if (nameBundle) review.push({ name, reason: "Bundle / pack in product name", count: 1 });
      continue;
    }
    if (dirty.length === 0 && !nameBundle) {
      groups.push(buildGroup(members)); // Rule 1 — clean variant set
      continue;
    }
    // Rule 3 — mixed: clean rows merge, the rest stay separate; flag for review.
    if (clean.length >= 2) groups.push(buildGroup(clean));
    else for (const m of clean) groups.push(buildGroup([m]));
    for (const m of dirty) groups.push(buildGroup([m]));
    review.push({
      name,
      reason: nameBundle ? "Bundle / pack wording" : "Mixed variant & non-attribute values",
      count: members.length,
    });
  }

  return { groups, review, totalRows: parsed.length };
}

/** A group is importable with an item_code + product_name + a price (variant or product-only). */
export function isValidGroup(g: Group): boolean {
  const okNum = (s: string) => s.trim() !== "" && !Number.isNaN(Number(s));
  if (!g.code.trim() || !g.name.trim() || !g.category.trim()) return false;
  return g.variants.length ? g.variants.some((v) => okNum(v.price)) : okNum(g.price);
}

const num = (s: string) => (s.trim() !== "" && !Number.isNaN(Number(s)) ? Number(s) : null);

/** Convert a Group to the API item (product + variants[]) the universal engine consumes. */
export function groupToItem(g: Group): Record<string, unknown> {
  return {
    code: g.code, name: g.name, category: g.category,
    brand: g.brand, description: g.description, short_description: g.short_description, tags: g.tags,
    hsn_code: g.hsn_code, status: g.status, featured: g.featured, image: g.image,
    gallery_images: g.gallery_images, tax_type: g.tax_type, tax_percentage: num(g.tax_percentage),
    price: num(g.price), mrp: num(g.mrp), stock: num(g.stock), barcode: g.barcode || null,
    variants: g.variants.filter((v) => num(v.price) !== null).map((v) => ({
      sku: v.sku, name: v.name, options: v.options,
      price: num(v.price), mrp: num(v.mrp), stock: num(v.stock), barcode: v.barcode || null,
    })),
  };
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Generate a CSV template: fixed reserved columns + one column per selected attribute, with a 2-variant sample. */
export function buildTemplateCsv(attributes: string[], category = ""): string {
  const attrs = attributes.map((a) => a.trim()).filter(Boolean);
  const headers = [
    "item_code", "product_name", "category", "brand", "hsn_code", "description",
    ...attrs, "sku", "barcode", "mrp", "offer_price", "stock", "status",
  ];
  // Two sample variant rows for one product (or one plain row if no attributes selected).
  const sampleVals = (i: number): Record<string, string> => {
    const base: Record<string, string> = {
      item_code: "P001", product_name: "Sample Product", category, brand: "Acme",
      hsn_code: "1006", description: "Sample description",
      sku: `P001-${i + 1}`, barcode: "", mrp: "499", offer_price: "399", stock: String(50 - i * 10), status: "active",
    };
    attrs.forEach((a, idx) => { base[a] = `Value${i + 1}${attrs.length > 1 ? "-" + (idx + 1) : ""}`; });
    return base;
  };
  const rowCount = attrs.length ? 2 : 1;
  const lines = [headers.join(",")];
  for (let i = 0; i < rowCount; i++) {
    const v = sampleVals(i);
    lines.push(headers.map((h) => esc(v[h] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}

/** Minimal product shape needed to export to the import CSV format. */
export type ExportProduct = {
  id: number; name: string; category_name?: string; brand?: string | null; hsn_code?: string | null;
  description?: string; code?: string | null; barcode?: string | null; mrp?: number | null;
  price: number; stock: number; status: string;
  variants?: { sku: string | null; options: Record<string, string>; price: number; stock: number }[];
};

/** Export products to a CSV string in the import template format (round-trippable). */
export function productsToCsv(products: ExportProduct[]): string {
  const attrSet = new Set<string>();
  for (const p of products) for (const v of p.variants ?? []) for (const k of Object.keys(v.options ?? {})) attrSet.add(k);
  const attrs = [...attrSet];
  const headers = ["item_code", "product_name", "category", "brand", "hsn_code", "description",
    ...attrs, "sku", "barcode", "mrp", "offer_price", "stock", "status"];
  const cell = (v: unknown) => (v == null ? "" : String(v));
  const lines = [headers.map(esc).join(",")];
  for (const p of products) {
    const code = (p.code && String(p.code).trim()) || `P${p.id}`;
    const head = [code, cell(p.name), cell(p.category_name), cell(p.brand), cell(p.hsn_code), cell(p.description)];
    const tail = (sku: string, price: unknown, stock: unknown) =>
      [sku, cell(p.barcode), cell(p.mrp), cell(price), cell(stock), p.status || "active"];
    const vs = p.variants ?? [];
    if (vs.length) {
      for (const v of vs) lines.push([...head, ...attrs.map((a) => v.options?.[a] ?? ""), ...tail(v.sku ?? code, v.price, v.stock)].map(esc).join(","));
    } else {
      lines.push([...head, ...attrs.map(() => ""), ...tail(code, p.price, p.stock)].map(esc).join(","));
    }
  }
  return lines.join("\n") + "\n";
}

/** Trigger a browser download of the products CSV. */
export function downloadProductsCsv(products: ExportProduct[], filename: string): void {
  const url = URL.createObjectURL(new Blob([productsToCsv(products)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of the generated template. */
export function downloadTemplate(attributes: string[], category = "", filename = "product-import-template.csv"): void {
  const url = URL.createObjectURL(new Blob([buildTemplateCsv(attributes, category)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export type FailedRow = { row: number; name?: string; reason?: string };
export type ImportSummary = {
  products: { created: number; updated: number; skipped: number };
  variants: { created: number; updated: number };
  failed: number;
  failedRows: FailedRow[];
  // Client-side grouping facts (Rule 5 summary), set by the import UI.
  totalRows?: number;
  variantProducts?: number;
  separateProducts?: number;
  needsReview?: ReviewRow[];
};

/**
 * POST product groups to the import endpoint in chunks (a group's rows never split),
 * aggregating the products/variants summary. `extra` adds fields like { vendor_id }.
 */
export async function runChunkedImport(
  post: (url: string, body: unknown, config?: { timeout?: number }) => Promise<{ data: { data?: Record<string, unknown> } }>,
  url: string,
  groups: Group[],
  extra: Record<string, unknown> = {},
  onProgress?: (done: number, total: number) => void,
): Promise<ImportSummary> {
  const CHUNK = 100; // groups per request (each group may carry many variants)
  const agg: ImportSummary = { products: { created: 0, updated: 0, skipped: 0 }, variants: { created: 0, updated: 0 }, failed: 0, failedRows: [] };
  for (let i = 0; i < groups.length; i += CHUNK) {
    const chunk = groups.slice(i, i + CHUNK);
    onProgress?.(Math.min(i + chunk.length, groups.length), groups.length);
    const res = await post(url, { ...extra, items: chunk.map(groupToItem) }, { timeout: 60000 });
    const d = (res.data.data ?? {}) as Record<string, unknown>;
    const p = (d.products ?? {}) as Record<string, number>;
    const v = (d.variants ?? {}) as Record<string, number>;
    agg.products.created += Number(p.created ?? d.created ?? 0);
    agg.products.updated += Number(p.updated ?? d.updated ?? 0);
    agg.products.skipped += Number(p.skipped ?? d.skipped ?? 0);
    agg.variants.created += Number(v.created ?? 0);
    agg.variants.updated += Number(v.updated ?? 0);
    const failed = d.failed as FailedRow[] | undefined;
    agg.failed += Number(d.failed_count ?? (Array.isArray(failed) ? failed.length : 0));
    if (Array.isArray(failed)) agg.failedRows.push(...failed.slice(0, 50).map((f) => ({ ...f, row: (Number(f.row) || 0) + i })));
  }
  return agg;
}
