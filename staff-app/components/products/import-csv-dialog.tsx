"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, Download, FileUp, AlertTriangle, CheckCircle2, Layers, Wand2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";
import {
  buildTemplateCsv, parseProductCsv, planCategories, resolveImportItems, normalizeName,
  buildExistingIndex, matchProduct, importStockOf, existingStockOf,
  type ParsedImport, type CategoryPlan, type CategoryRef, type ImportAction,
  type ExistingProduct, type ProductMatch,
} from "@/lib/csv";

type Props = {
  productCategories: CategoryRef[];
  existingProducts: ExistingProduct[];
  vendorCategoryId: number | null;
  onImported: () => void | Promise<void>;
};

/** Per unmatched-category choice. */
type Decision =
  | { kind: "existing"; categoryId: number }
  | { kind: "create" }
  | { kind: "skip" };

const decodeDecision = (v: string): Decision =>
  v === "c" ? { kind: "create" }
  : v === "s" ? { kind: "skip" }
  : { kind: "existing", categoryId: Number(v.slice(2)) };
const encodeDecision = (d: Decision): string =>
  d.kind === "create" ? "c" : d.kind === "skip" ? "s" : `e:${d.categoryId}`;

/** Default choice for an unmatched category: accept the suggestion, else create. */
function defaultDecision(u: CategoryPlan["unmatched"][number]): Decision {
  return u.suggestion ? { kind: "existing", categoryId: u.suggestion.id } : { kind: "create" };
}

const catToneClass = (t: "muted" | "map" | "create" | "skip") =>
  t === "create" ? "text-emerald-400" : t === "skip" ? "text-amber-400" : t === "map" ? "text-sky-400" : "text-muted-foreground";

export function ImportCsvDialog({ productCategories, existingProducts, vendorCategoryId, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [productActions, setProductActions] = useState<Record<string, ImportAction>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const plan: CategoryPlan | null = useMemo(
    () => (parsed ? planCategories(parsed.products, productCategories) : null),
    [parsed, productCategories],
  );
  const catName = useMemo(
    () => new Map(productCategories.map((c) => [c.id, c.name] as [number, string])),
    [productCategories],
  );

  // Existing-product matching (variant SKU first, then name).
  const index = useMemo(() => buildExistingIndex(existingProducts), [existingProducts]);
  const matchByName = useMemo(() => {
    const m = new Map<string, ProductMatch | null>();
    if (parsed) for (const p of parsed.products) m.set(normalizeName(p.name), matchProduct(p, index));
    return m;
  }, [parsed, index]);

  function reset() {
    setParsed(null);
    setFileName("");
    setDecisions({});
    setProductActions({});
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setDecisions({});
    setProductActions({});
    try {
      setParsed(parseProductCsv(await file.text()));
    } catch {
      toast.error("Could not read that file");
      reset();
    }
  }

  // Live resolution preview from the current category + product decisions.
  const summary = useMemo(() => {
    if (!parsed || !plan) return null;
    const skipCatKeys = new Set<string>();
    let willCreate = 0, willExisting = 0;
    const createNames: string[] = [];
    for (const u of plan.unmatched) {
      const dc = decisions[u.key] ?? defaultDecision(u);
      if (dc.kind === "skip") skipCatKeys.add(u.key);
      else if (dc.kind === "create") { willCreate++; createNames.push(u.raw); }
      else willExisting++;
    }
    let newProducts = 0, matchedProducts = 0, creating = 0, updating = 0, stockToAdd = 0, addStock = 0, replaceStock = 0, skipped = 0;
    for (const p of parsed.products) {
      if (skipCatKeys.has(normalizeName(p.categoryRaw))) { skipped++; continue; }
      const m = matchByName.get(normalizeName(p.name));
      if (!m) { newProducts++; creating++; continue; }
      matchedProducts++;
      const a = productActions[normalizeName(p.name)] ?? "add_stock";
      if (a === "skip") skipped++;
      else if (a === "create") creating++;
      else if (a === "update") updating++;
      else if (a === "add_stock") { updating++; addStock++; stockToAdd += importStockOf(p); }
      else if (a === "replace_stock") { updating++; replaceStock++; }
    }
    return {
      matchedCats: plan.matched.size, attention: plan.unmatched.length, willCreate, willExisting, createNames,
      newProducts, matchedProducts, creating, updating, stockToAdd, addStock, replaceStock, skipped,
      importable: creating + updating,
    };
  }, [parsed, plan, decisions, productActions, matchByName]);

  const previewRows = useMemo(() => {
    if (!parsed || !plan) return [];
    const unmatchedByKey = new Map(plan.unmatched.map((u) => [u.key, u]));
    return parsed.products.map((p) => {
      const catKey = normalizeName(p.categoryRaw);
      const nameKey = normalizeName(p.name);
      const match = matchByName.get(nameKey) ?? null;
      let catLabel = p.categoryRaw || "—";
      let catTone: "muted" | "map" | "create" | "skip" = "muted";
      if (!plan.matched.has(catKey)) {
        const u = unmatchedByKey.get(catKey);
        const dc: Decision = u ? (decisions[catKey] ?? defaultDecision(u)) : { kind: "skip" };
        if (dc.kind === "existing") { catLabel = `→ ${catName.get(dc.categoryId) ?? "?"}`; catTone = "map"; }
        else if (dc.kind === "create") { catLabel = `${p.categoryRaw} (new cat)`; catTone = "create"; }
        else { catLabel = `${p.categoryRaw} (skip)`; catTone = "skip"; }
      }
      return {
        name: p.name, nameKey, match,
        importStock: importStockOf(p),
        existingStock: match ? existingStockOf(match.product) : null,
        catLabel, catTone, dupSku: match?.dupSku ?? false,
      };
    });
  }, [parsed, plan, decisions, catName, matchByName]);

  const hasIssues = !!parsed && parsed.issues.length > 0;
  const canImport =
    !!parsed && !!summary && !hasIssues && parsed.products.length > 0 && summary.importable > 0 && !importing;

  function autoMapSuggestions() {
    if (!plan) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const u of plan.unmatched) if (u.suggestion) next[u.key] = { kind: "existing", categoryId: u.suggestion.id };
      return next;
    });
  }
  function createAllMissing() {
    if (!plan) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const u of plan.unmatched) next[u.key] = { kind: "create" };
      return next;
    });
  }
  function setAllMatched(action: ImportAction) {
    setProductActions((prev) => {
      const next = { ...prev };
      for (const [norm, m] of matchByName) if (m) next[norm] = action;
      return next;
    });
  }

  async function doImport() {
    if (!parsed || !plan || !canImport) return;
    setImporting(true);
    try {
      // 1. Resolve categories (matched + chosen existing + created).
      const idByKey = new Map<string, number>();
      for (const [key, ref] of plan.matched) idByKey.set(key, ref.id);
      const skipKeys = new Set<string>();
      const toCreate: { key: string; name: string }[] = [];
      for (const u of plan.unmatched) {
        const dc = decisions[u.key] ?? defaultDecision(u);
        if (dc.kind === "skip") { skipKeys.add(u.key); continue; }
        if (dc.kind === "existing") idByKey.set(u.key, dc.categoryId);
        else toCreate.push({ key: u.key, name: u.raw });
      }

      // 2. Create the missing categories (server dedupes case-insensitively).
      let newCats = 0;
      if (toCreate.length > 0) {
        const res = await api.post("/vendor/categories", { names: toCreate.map((c) => c.name), vendor_category_id: vendorCategoryId });
        const cats = (res.data.data?.items ?? []) as { name: string; id: number; created: boolean }[];
        for (const it of cats) { idByKey.set(normalizeName(it.name), it.id); if (it.created) newCats++; }
      }

      // 3. Build the payload (create / update / add / replace / skip) and import.
      const { items, created: nCreate, updated: nUpdate, stockToAdd } = resolveImportItems(parsed.products, {
        categoryIdByKey: idByKey,
        skipCategoryKeys: skipKeys,
        matchOf: (p) => matchProduct(p, index),
        actionFor: (n) => productActions[n] ?? "add_stock",
        vendorCategoryId,
      });
      if (items.length === 0) { toast.error("Nothing to import"); setImporting(false); return; }
      const res = await api.post("/vendor/products/bulk", { items });
      const d = res.data.data ?? {};
      const created = d.created ?? nCreate;
      const updated = d.updated ?? nUpdate;
      const unitsAdded = d.units_added ?? stockToAdd;
      toast.success(
        [
          "Import complete",
          created ? `${created} created` : null,
          updated ? `${updated} updated` : null,
          unitsAdded ? `${unitsAdded} stock added` : null,
          newCats ? `${newCats} new categor${newCats === 1 ? "y" : "ies"}` : null,
        ].filter(Boolean).join(" · "),
      );
      setOpen(false);
      reset();
      await onImported();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Import failed"));
    } finally {
      setImporting(false);
    }
  }

  const totalVariants = parsed?.products.reduce((s, p) => s + p.variants.length, 0) ?? 0;

  return (
    <>
      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import CSV
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[92vh] sm:!max-w-2xl overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Import products from CSV</DialogTitle>
            <DialogDescription>
              One row per variant combination. Existing products are matched by SKU/name — choose to add stock, replace, update, skip or create new.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File + template */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/30 p-3">
              <Button type="button" size="sm" variant="secondary" className="rounded-lg" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Download template
              </Button>
              <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => fileRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5" /> {fileName || "Choose CSV file"}
              </Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>

            {parsed && summary && (
              <>
                {/* Summary chips */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/60 px-2 py-1">
                    <Layers className="h-3.5 w-3.5" /> {parsed.products.length} products · {totalVariants} variants
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {summary.matchedCats} categories matched
                  </span>
                  {summary.matchedProducts > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-sky-400">
                      {summary.matchedProducts} existing matched
                    </span>
                  )}
                  {summary.attention > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> {summary.attention} categories need attention
                    </span>
                  )}
                  {hasIssues && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> {parsed.issues.length} row issue(s)
                    </span>
                  )}
                </div>

                {/* Hard row issues block import */}
                {hasIssues && (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
                    {parsed.issues.slice(0, 50).map((iss, i) => (
                      <p key={i} className="text-rose-400">
                        {iss.line > 0 ? <span className="font-medium">Line {iss.line}: </span> : null}{iss.message}
                      </p>
                    ))}
                    {parsed.issues.length > 50 && <p className="text-muted-foreground">+{parsed.issues.length - 50} more…</p>}
                  </div>
                )}

                {/* Detailed summary */}
                {!hasIssues && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {[
                      { label: "New", value: summary.newProducts },
                      { label: "Matched", value: summary.matchedProducts },
                      { label: "Creating", value: summary.creating },
                      { label: "Updating", value: summary.updating },
                      { label: "Stock +", value: summary.stockToAdd },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-center">
                        <p className="text-base font-bold leading-none">{s.value}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category mapping */}
                {!hasIssues && plan && plan.unmatched.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-border bg-surface-2/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Map categories</p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={autoMapSuggestions}>
                          <Wand2 className="h-3.5 w-3.5" /> Use suggestions
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={createAllMissing}>
                          <PlusCircle className="h-3.5 w-3.5" /> Create all
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {plan.unmatched.map((u) => {
                        const d = decisions[u.key] ?? defaultDecision(u);
                        return (
                          <div key={u.key} className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-background/60 p-2 sm:grid-cols-[1fr_240px] sm:items-center">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{u.raw}</p>
                              {u.suggestion
                                ? <p className="text-[11px] text-muted-foreground">Suggested: <span className="text-foreground">{u.suggestion.name}</span> ({Math.round(u.suggestion.score * 100)}%)</p>
                                : <p className="text-[11px] text-muted-foreground">No close match</p>}
                            </div>
                            <Select
                              value={encodeDecision(d)}
                              onValueChange={(v) => v && setDecisions((prev) => ({ ...prev, [u.key]: decodeDecision(v) }))}
                            >
                              <SelectTrigger className="h-9 rounded-lg bg-background text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {productCategories.map((c) => (
                                  <SelectItem key={c.id} value={`e:${c.id}`}>Use: {c.name}</SelectItem>
                                ))}
                                <SelectItem value="c">➕ Create &quot;{u.raw}&quot;</SelectItem>
                                <SelectItem value="s">Skip these products</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bulk actions for matched products */}
                {!hasIssues && summary.matchedProducts > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">For matched:</span>
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setAllMatched("add_stock")}>Add stock all</Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setAllMatched("replace_stock")}>Replace all</Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setAllMatched("skip")}>Skip all</Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setAllMatched("create")}>Create all new</Button>
                  </div>
                )}

                {/* Product review table */}
                {!hasIssues && previewRows.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="hidden grid-cols-[1.5fr_64px_64px_180px] gap-2 border-b border-border bg-surface-2/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                      <span>Product</span><span>Exist</span><span>Import</span><span>Action</span>
                    </div>
                    <div className="max-h-64 divide-y divide-border overflow-y-auto">
                      {previewRows.map((r, i) => {
                        const action: ImportAction = r.match ? (productActions[r.nameKey] ?? "add_stock") : "create";
                        const dim = action === "skip" || r.catTone === "skip";
                        return (
                          <div key={i} className={"flex flex-col gap-1.5 px-3 py-2 text-sm sm:grid sm:grid-cols-[1.5fr_64px_64px_180px] sm:items-center sm:gap-2" + (dim ? " opacity-50" : "")}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate font-medium">{r.name}</span>
                                {r.match
                                  ? <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">existing</span>
                                  : <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">new</span>}
                                {r.dupSku && <span className="shrink-0 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">dup SKU</span>}
                                {r.match && (action === "add_stock" || action === "replace_stock") && (
                                  <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-400">stock</span>
                                )}
                              </div>
                              <span className={"block truncate text-[11px] " + catToneClass(r.catTone)}>{r.catLabel}</span>
                            </div>
                            <div className="text-xs text-muted-foreground"><span className="sm:hidden">Existing: </span>{r.existingStock ?? "—"}</div>
                            <div className="text-xs text-muted-foreground"><span className="sm:hidden">Import: </span>{r.importStock}</div>
                            <div>
                              {r.match ? (
                                <Select value={action} onValueChange={(v) => v && setProductActions((prev) => ({ ...prev, [r.nameKey]: v as ImportAction }))}>
                                  <SelectTrigger className="h-8 w-full rounded-md bg-background text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="add_stock">Add stock</SelectItem>
                                    <SelectItem value="replace_stock">Replace stock</SelectItem>
                                    <SelectItem value="update">Update details</SelectItem>
                                    <SelectItem value="skip">Skip</SelectItem>
                                    <SelectItem value="create">Create new</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-emerald-400">New product</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <GradientButton disabled={!canImport} onClick={() => void doImport()}>
              <Upload className="h-4 w-4" /> {importing ? "Importing…" : `Confirm import${summary ? ` (${summary.importable})` : ""}`}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
