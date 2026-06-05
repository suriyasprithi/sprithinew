// CSV import helpers for bulk product upload (one row per variant combination).
// Pure functions only — no React, no DOM — so they're easy to test and reuse.

/** Columns the import template expects, in order. */
export const CSV_COLUMNS = [
  "name", "category", "description", "price", "stock", "status",
  "option1_name", "option1_value",
  "option2_name", "option2_value",
  "option3_name", "option3_value",
  "variant_sku", "variant_price", "variant_stock",
] as const;

export type ImportVariantType = { name: string; options: string[] };
export type ImportVariant = {
  name: string;
  sku: string | null;
  options: Record<string, string>;
  price: number;
  stock: number;
};
export type ImportProduct = {
  name: string;
  categoryRaw: string;
  description: string | null;
  price: number;
  stock: number;
  status: "active" | "inactive";
  variant_types: ImportVariantType[];
  variants: ImportVariant[];
  rows: number; // how many CSV rows fed this product
};
export type ImportIssue = { line: number; message: string };
export type ParsedImport = { products: ImportProduct[]; issues: ImportIssue[]; totalRows: number };

/** Minimal RFC-4180-ish CSV parser: quoted fields, escaped quotes (""), commas, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** A ready-to-edit sample file: header + a 2-axis variant product and a plain product. */
export function buildTemplateCsv(): string {
  const sample: string[][] = [
    [...CSV_COLUMNS],
    ["Baby Onesie", "Clothing", "Soft cotton onesie", "199", "0", "active", "Size", "S", "Color", "White", "", "", "ONESIE-S-WHT", "199", "10"],
    ["Baby Onesie", "Clothing", "Soft cotton onesie", "199", "0", "active", "Size", "M", "Color", "White", "", "", "ONESIE-M-WHT", "199", "8"],
    ["Baby Onesie", "Clothing", "Soft cotton onesie", "199", "0", "active", "Size", "M", "Color", "Blue", "", "", "ONESIE-M-BLU", "219", "5"],
    ["Baby Mittens", "Accessories", "Warm winter mittens", "99", "25", "active", "", "", "", "", "", "", "", "", ""],
  ];
  return toCsv(sample);
}

/**
 * Parse the CSV text into grouped products + a list of human-readable issues.
 * Rows that share the same `name` are merged into one product; each row that
 * carries option columns becomes one variant combination of that product.
 *
 * Note: an *unknown* category is NOT an error here — categories are resolved
 * (and optionally created) later via the category-mapping step. Only a blank
 * category, a bad price, or an inconsistent variant axis are hard issues.
 */
export function parseProductCsv(text: string): ParsedImport {
  const issues: ImportIssue[] = [];
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== "")); // drop blank lines
  if (rows.length === 0) return { products: [], issues: [{ line: 0, message: "File is empty" }], totalRows: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { if (idx[h] === undefined) idx[h] = i; });
  for (const req of ["name", "price"] as const) {
    if (idx[req] === undefined) issues.push({ line: 1, message: `Missing required column "${req}"` });
  }
  if (issues.length) return { products: [], issues, totalRows: rows.length - 1 };

  const cell = (r: string[], key: string): string => {
    const i = idx[key];
    return i === undefined || i >= r.length ? "" : (r[i] ?? "").trim();
  };

  type Acc = ImportProduct & {
    axisOrder: string[];
    optionSets: Record<string, Set<string>>;
    comboLines: number[];
  };
  const byName = new Map<string, Acc>();
  const order: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1; // 1-based; the header is line 1
    const row = rows[r];
    const name = cell(row, "name");
    if (!name) { issues.push({ line, message: "Name is required" }); continue; }

    let acc = byName.get(name);
    if (!acc) {
      const categoryRaw = cell(row, "category");
      const priceStr = cell(row, "price");
      const price = Number(priceStr);
      if (!priceStr || !Number.isFinite(price) || price < 0) issues.push({ line, message: `"${name}": price must be a number ≥ 0` });
      if (!categoryRaw) issues.push({ line, message: `"${name}": category is required` });
      acc = {
        name, categoryRaw,
        description: cell(row, "description") || null,
        price: Number.isFinite(price) ? price : 0,
        stock: Number(cell(row, "stock")) || 0,
        status: cell(row, "status").toLowerCase() === "inactive" ? "inactive" : "active",
        variant_types: [], variants: [], rows: 0,
        axisOrder: [], optionSets: {}, comboLines: [],
      };
      byName.set(name, acc);
      order.push(name);
    }
    acc.rows++;

    // Collect this row's variant axes (option1..3).
    const combo: Record<string, string> = {};
    for (const n of [1, 2, 3]) {
      const axis = cell(row, `option${n}_name`);
      const val = cell(row, `option${n}_value`);
      if (!axis && !val) continue;
      if (!axis || !val) { issues.push({ line, message: `"${name}": option${n} needs both a name and a value` }); continue; }
      combo[axis] = val;
      if (!acc.optionSets[axis]) { acc.optionSets[axis] = new Set(); acc.axisOrder.push(axis); }
      acc.optionSets[axis].add(val);
    }
    if (Object.keys(combo).length === 0) continue; // plain product header row — no combo

    const vp = cell(row, "variant_price");
    const vs = cell(row, "variant_stock");
    acc.variants.push({
      name: Object.values(combo).join(" + "),
      sku: cell(row, "variant_sku") || null,
      options: combo,
      price: vp ? (Number(vp) || acc.price) : acc.price,
      stock: vs ? (Number(vs) || 0) : 0,
    });
    acc.comboLines.push(line);
  }

  const products: ImportProduct[] = [];
  for (const name of order) {
    const acc = byName.get(name)!;
    const variant_types = acc.axisOrder.map((axis) => ({ name: axis, options: [...acc.optionSets[axis]] }));
    // Every combo must specify a value for every axis the product declares.
    if (variant_types.length > 0) {
      acc.variants.forEach((v, i) => {
        for (const axis of acc.axisOrder) {
          if (!v.options[axis]) issues.push({ line: acc.comboLines[i], message: `"${name}": missing value for "${axis}"` });
        }
      });
    }
    products.push({
      name: acc.name, categoryRaw: acc.categoryRaw,
      description: acc.description, price: acc.price, stock: acc.stock, status: acc.status,
      variant_types, variants: acc.variants, rows: acc.rows,
    });
  }

  return { products, issues, totalRows: rows.length - 1 };
}

// ----- Category matching -------------------------------------------------

export type CategoryRef = { id: number; name: string };
export type CategorySuggestion = { id: number; name: string; score: number } | null;

/** Trim, lowercase, collapse internal whitespace — the canonical match key. */
export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Classic iterative Levenshtein edit distance (two-row, O(n·m) time, O(n) space). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Best fuzzy match for `name` among `cats`, or null if nothing is close enough. */
export function suggestCategory(name: string, cats: CategoryRef[]): CategorySuggestion {
  const target = normalizeName(name);
  if (!target) return null;
  let best: CategorySuggestion = null;
  for (const c of cats) {
    const cand = normalizeName(c.name);
    if (!cand) continue;
    let score = 1 - levenshtein(target, cand) / Math.max(target.length, cand.length, 1);
    // One name fully contained in the other (e.g. "Clothing" vs "Kids Clothing").
    if (cand.length >= 3 && target.length >= 3 && (cand.includes(target) || target.includes(cand))) {
      score = Math.max(score, 0.85);
    }
    if (!best || score > best.score) best = { id: c.id, name: c.name, score };
  }
  return best && best.score >= 0.6 ? best : null;
}

export type CategoryPlan = {
  /** distinct raw category names (first-seen casing) */
  distinct: string[];
  /** normalized key -> existing category for exact (case-insensitive/trimmed) matches */
  matched: Map<string, CategoryRef>;
  /** categories with no exact match, each with an optional fuzzy suggestion */
  unmatched: { raw: string; key: string; suggestion: CategorySuggestion }[];
};

/** Split the products' categories into already-matched vs needs-attention. */
export function planCategories(products: ImportProduct[], cats: CategoryRef[]): CategoryPlan {
  const byNorm = new Map<string, CategoryRef>();
  for (const c of cats) byNorm.set(normalizeName(c.name), c);

  const distinct = new Map<string, string>(); // key -> first raw display
  for (const p of products) {
    const raw = p.categoryRaw.trim();
    if (!raw) continue;
    const key = normalizeName(raw);
    if (!distinct.has(key)) distinct.set(key, raw);
  }

  const matched = new Map<string, CategoryRef>();
  const unmatched: CategoryPlan["unmatched"] = [];
  for (const [key, raw] of distinct) {
    const exact = byNorm.get(key);
    if (exact) matched.set(key, exact);
    else unmatched.push({ raw, key, suggestion: suggestCategory(raw, cats) });
  }
  return { distinct: [...distinct.values()], matched, unmatched };
}

// ----- Existing-product matching & stock --------------------------------

export type ExistingVariant = { sku: string | null; options: Record<string, string>; stock: number };
export type ExistingProduct = { id: number; name: string; stock: number; variants: ExistingVariant[] };

/** Canonical key for a variant's option map (axis-sorted, lowercased). */
export function optionsKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k.trim().toLowerCase()}=${String(options[k]).trim().toLowerCase()}`)
    .join("|");
}

export type ExistingIndex = {
  byName: Map<string, ExistingProduct>;
  bySku: Map<string, ExistingProduct>;
};

/** Index the vendor's products by normalized name and by every variant SKU. */
export function buildExistingIndex(existing: ExistingProduct[]): ExistingIndex {
  const byName = new Map<string, ExistingProduct>();
  const bySku = new Map<string, ExistingProduct>();
  for (const p of existing) {
    byName.set(normalizeName(p.name), p);
    for (const v of p.variants) if (v.sku) bySku.set(v.sku.trim().toLowerCase(), p);
  }
  return { byName, bySku };
}

export type ProductMatch = { product: ExistingProduct; via: "sku" | "name"; dupSku: boolean };

/** Match a parsed product to an existing one — variant SKU first, then name. */
export function matchProduct(p: ImportProduct, index: ExistingIndex): ProductMatch | null {
  let skuHit: ExistingProduct | undefined;
  let dupSku = false;
  for (const v of p.variants) {
    if (!v.sku) continue;
    const hit = index.bySku.get(v.sku.trim().toLowerCase());
    if (hit) { dupSku = true; skuHit = skuHit ?? hit; }
  }
  if (skuHit) return { product: skuHit, via: "sku", dupSku };
  const nameHit = index.byName.get(normalizeName(p.name));
  return nameHit ? { product: nameHit, via: "name", dupSku: false } : null;
}

/** Import stock total for a parsed product (sum of variant stock, or base stock). */
export function importStockOf(p: ImportProduct): number {
  return p.variants.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
}
/** Current stock total for an existing product. */
export function existingStockOf(e: ExistingProduct): number {
  return e.variants.length > 0 ? e.variants.reduce((s, v) => s + v.stock, 0) : e.stock;
}

// ----- Building the import payload --------------------------------------

/** What to do with a matched product. New products are always "create". */
export type ImportAction = "add_stock" | "replace_stock" | "update" | "skip" | "create";

/** Base request body for one product (no id / action). */
export function toApiItem(p: ImportProduct, categoryId: number, vendorCategoryId: number | null): Record<string, unknown> {
  const item: Record<string, unknown> = {
    name: p.name,
    category_id: categoryId,
    vendor_category_id: vendorCategoryId,
    description: p.description,
    price: p.price,
    stock: p.stock,
    status: p.status,
  };
  if (p.variant_types.length > 0) {
    item.variant_types = p.variant_types;
    item.variants = p.variants.map((v) => ({
      name: v.name, sku: v.sku, options: v.options, price: v.price, stock: v.stock,
    }));
  }
  return item;
}

export type ResolveOptions = {
  /** normalized category name -> resolved product-category id */
  categoryIdByKey: Map<string, number>;
  /** normalized category names whose products should be skipped */
  skipCategoryKeys: Set<string>;
  /** match a parsed product to an existing one (or null) */
  matchOf: (p: ImportProduct) => ProductMatch | null;
  /** action for a matched product (by normalized name); defaults to "add_stock" */
  actionFor: (normName: string) => ImportAction;
  vendorCategoryId: number | null;
};

export type ResolveResult = {
  items: Record<string, unknown>[];
  created: number;       // new products (unmatched + matched→create)
  updated: number;       // update-details
  addStock: number;      // matched → add_stock
  replaceStock: number;  // matched → replace_stock
  stockToAdd: number;    // total units added via add_stock
  skipped: number;
};

/** Turn parsed products into API items, honouring category + match decisions. */
export function resolveImportItems(products: ImportProduct[], opts: ResolveOptions): ResolveResult {
  const items: Record<string, unknown>[] = [];
  let created = 0, updated = 0, addStock = 0, replaceStock = 0, stockToAdd = 0, skipped = 0;
  for (const p of products) {
    const catKey = normalizeName(p.categoryRaw);
    const catId = opts.categoryIdByKey.get(catKey);
    if (opts.skipCategoryKeys.has(catKey) || catId === undefined) { skipped++; continue; }

    const match = opts.matchOf(p);
    if (!match) { items.push(toApiItem(p, catId, opts.vendorCategoryId)); created++; continue; }

    const action = opts.actionFor(normalizeName(p.name));
    if (action === "skip") { skipped++; continue; }
    if (action === "create") { items.push(toApiItem(p, catId, opts.vendorCategoryId)); created++; continue; }

    const item = toApiItem(p, catId, opts.vendorCategoryId);
    item.id = match.product.id;
    item.action = action;
    items.push(item);
    if (action === "update") updated++;
    else if (action === "add_stock") { addStock++; stockToAdd += importStockOf(p); }
    else if (action === "replace_stock") replaceStock++;
  }
  return { items, created, updated, addStock, replaceStock, stockToAdd, skipped };
}
