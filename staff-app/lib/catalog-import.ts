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
  category: "category", subcategory: "sub_category", subcat: "sub_category",
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
  code: string; name: string; category: string; sub_category: string; brand: string;
  description: string; short_description: string; tags: string; hsn_code: string;
  status: string; featured: string; image: string; gallery_images: string;
  tax_type: string; tax_percentage: string;
  // product-only row-level values (used when the group has no variants):
  price: string; mrp: string; stock: string; barcode: string;
  variants: Variant[];
};

const blankGroup = (code: string): Group => ({
  code, name: "", category: "", sub_category: "", brand: "", description: "", short_description: "",
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
 * Parse CSV rows into product groups (by item_code). Reserved headers map to fields;
 * any other header is a variant attribute (its label → variant.options[label]).
 */
export function groupRows(rows: string[][]): Group[] {
  if (rows.length < 2) return [];
  // Per column: a reserved field key, or an attribute label (original header).
  const cols = rows[0].map((h) => {
    const key = RESERVED[norm(h)];
    return key ? { kind: "field" as const, key } : { kind: "attr" as const, label: h.trim() };
  });

  const groups = new Map<string, Group>();
  const order: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // Resolve this row's reserved values + attribute options.
    const f: Record<string, string> = {};
    const options: Record<string, string> = {};
    cols.forEach((c, i) => {
      const v = (row[i] ?? "").trim();
      if (c.kind === "field") { if (v !== "") f[c.key] = v; }
      else if (c.label !== "" && v !== "") options[c.label] = v;
    });

    const code = (f.code ?? "").trim();
    if (!code) continue; // item_code is the grouping key; skip blank
    const key = code.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = blankGroup(code);
      // product-level fields from the first row of this item_code
      g.name = f.name ?? ""; g.category = f.category ?? ""; g.sub_category = f.sub_category ?? "";
      g.brand = f.brand ?? ""; g.description = f.description ?? ""; g.short_description = f.short_description ?? "";
      g.tags = f.tags ?? ""; g.hsn_code = f.hsn_code ?? ""; g.status = f.status ?? "";
      g.featured = f.featured ?? ""; g.image = f.image ?? ""; g.gallery_images = f.gallery_images ?? "";
      g.tax_type = f.tax_type ?? ""; g.tax_percentage = f.tax_percentage ?? "";
      // row-level (used if product-only)
      g.price = f.price ?? ""; g.mrp = f.mrp ?? ""; g.stock = f.stock ?? ""; g.barcode = f.barcode ?? "";
      groups.set(key, g);
      order.push(key);
    }
    // A row is a variant when it carries a sku or any attribute value.
    const isVariant = !!(f.sku && f.sku.trim()) || Object.keys(options).length > 0;
    if (isVariant) {
      g.variants.push({
        sku: f.sku ?? "", name: f.variant_name ?? "", options,
        price: f.price ?? "", mrp: f.mrp ?? "", stock: f.stock ?? "", barcode: f.barcode ?? "",
      });
    }
  }
  return order.map((k) => groups.get(k)!);
}

/** A group is importable with an item_code + product_name + a price (variant or product-only). */
export function isValidGroup(g: Group): boolean {
  const okNum = (s: string) => s.trim() !== "" && !Number.isNaN(Number(s));
  if (!g.code.trim() || !g.name.trim()) return false;
  return g.variants.length ? g.variants.some((v) => okNum(v.price)) : okNum(g.price);
}

const num = (s: string) => (s.trim() !== "" && !Number.isNaN(Number(s)) ? Number(s) : null);

/** Convert a Group to the API item (product + variants[]) the universal engine consumes. */
export function groupToItem(g: Group): Record<string, unknown> {
  return {
    code: g.code, name: g.name, category: g.category, sub_category: g.sub_category,
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
    "item_code", "product_name", "category", "sub_category", "brand", "hsn_code", "description",
    ...attrs, "sku", "barcode", "mrp", "offer_price", "stock", "status",
  ];
  // Two sample variant rows for one product (or one plain row if no attributes selected).
  const sampleVals = (i: number): Record<string, string> => {
    const base: Record<string, string> = {
      item_code: "P001", product_name: "Sample Product", category, sub_category: "", brand: "Acme",
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
};

/**
 * POST product groups to the import endpoint in chunks (a group's rows never split),
 * aggregating the products/variants summary. `extra` adds fields like { vendor_id }.
 */
export async function runChunkedImport(
  post: (url: string, body: unknown) => Promise<{ data: { data?: Record<string, unknown> } }>,
  url: string,
  groups: Group[],
  extra: Record<string, unknown> = {},
  onProgress?: (done: number, total: number) => void,
): Promise<ImportSummary> {
  const CHUNK = 200; // groups per request (each group may carry many variants)
  const agg: ImportSummary = { products: { created: 0, updated: 0, skipped: 0 }, variants: { created: 0, updated: 0 }, failed: 0, failedRows: [] };
  for (let i = 0; i < groups.length; i += CHUNK) {
    const chunk = groups.slice(i, i + CHUNK);
    onProgress?.(Math.min(i + chunk.length, groups.length), groups.length);
    const res = await post(url, { ...extra, items: chunk.map(groupToItem) });
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
