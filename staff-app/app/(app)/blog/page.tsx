"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Newspaper, Plus, Search, MoreHorizontal, Pencil, Trash2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ImageDrop } from "@/components/ui/custom/image-drop";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  content: string | null;
  status: "draft" | "published";
  published_at: string | null;
};

type Draft = {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string | null;
  content: string;
  status: "draft" | "published";
};

function blankDraft(): Draft {
  return { slug: "", title: "", excerpt: "", cover_image: null, content: "", status: "draft" };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function normalizeApiPost(raw: unknown): BlogPost {
  const r = raw as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    slug: String(r.slug ?? ""),
    title: String(r.title ?? ""),
    excerpt: (r.excerpt as string | null) ?? null,
    cover_image: (r.cover_image as string | null) ?? null,
    content: (r.content as string | null) ?? null,
    status: (r.status === "published" ? "published" : "draft"),
    published_at: (r.published_at as string | null) ?? null,
  };
}

export default function AdminBlogPage() {
  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/blog");
      const raws = (res.data.data?.items ?? []) as unknown[];
      setItems(raws.map(normalizeApiPost));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Failed to load posts"));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => items.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.slug.includes(search.toLowerCase())) return false;
    if (status !== "all" && p.status !== status) return false;
    return true;
  }), [items, search, status]);

  const draftCount     = items.filter((p) => p.status === "draft").length;
  const publishedCount = items.filter((p) => p.status === "published").length;

  function startNew() { setEditing(blankDraft()); }
  function startEdit(p: BlogPost) {
    setEditing({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? "",
      cover_image: p.cover_image,
      content: p.content ?? "",
      status: p.status,
    });
  }

  async function save() {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) { toast.error("Title required"); return; }
    const slug = editing.slug.trim() ? slugify(editing.slug) : slugify(title);
    if (!slug) { toast.error("Slug required"); return; }

    const payload = {
      title,
      slug,
      excerpt: editing.excerpt.trim() || null,
      cover_image: editing.cover_image,
      content: editing.content,
      status: editing.status,
    };

    setBusy(true);
    try {
      if (editing.id) {
        await api.patch(`/admin/blog/${editing.id}`, payload);
        toast.success("Post updated");
      } else {
        await api.post("/admin/blog", payload);
        toast.success("Post created");
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (deleteId == null) return;
    try {
      await api.delete(`/admin/blog/${deleteId}`);
      toast.success("Post deleted");
      setItems((cur) => cur.filter((p) => p.id !== deleteId));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Delete failed"));
    } finally { setDeleteId(null); }
  }

  return (
    <>
      <MobileHeader title="Blog" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Content"
          icon={Newspaper}
          title="Blog"
          description="Write posts that appear on the public marketplace at /blog. Markdown supported."
          action={
            <GradientButton onClick={startNew}>
              <Plus className="h-4 w-4" /> New post
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total posts" value={items.length}   icon={Newspaper} tone="brand"   spark={[1, 1, 2, 2, 3, 3, 4, 4]} />
          <StatCard label="Published"   value={publishedCount} icon={Eye}       tone="emerald" spark={[1, 1, 2, 2, 3, 3, 4, 4]} />
          <StatCard label="Drafts"      value={draftCount}     icon={FileText}  tone="amber"   spark={[0, 1, 1, 1, 2, 2, 2, 2]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or slug…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | "draft" | "published")}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.6fr_1fr_120px_140px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Title</span>
            <span>Slug</span>
            <span>Status</span>
            <span>Published</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No posts yet"
              description="Write your first post and publish it to the marketplace blog."
              action={<GradientButton onClick={startNew}><Plus className="h-4 w-4" /> New post</GradientButton>}
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.6fr_1fr_120px_140px_56px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand/10 text-brand">
                      {p.cover_image
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.cover_image} alt="" className="h-full w-full object-cover" />
                        : <Newspaper className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden font-mono">{p.slug}</p>
                    </div>
                  </div>
                  <p className="hidden truncate font-mono text-xs text-muted-foreground md:block">{p.slug}</p>
                  <div className="hidden md:block"><StatusBadge status={p.status} /></div>
                  <p className="hidden text-xs text-muted-foreground md:block">{p.published_at?.slice(0, 10) ?? "—"}</p>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={p.status} /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(p.id)} className="text-rose-400 focus:text-rose-400">
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] sm:!max-w-3xl lg:!max-w-4xl overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit post" : "New post"}</DialogTitle>
            <DialogDescription>
              Title is required. Slug auto-derives from title if left blank. Content supports basic Markdown: <code className="font-mono">#</code> headings, <code className="font-mono">**bold**</code>, <code className="font-mono">*italic*</code>, <code className="font-mono">- lists</code>, <code className="font-mono">[link](url)</code>, <code className="font-mono">```code```</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_280px]">
              <div className="space-y-1.5">
                <Label>Title <span className="text-brand">*</span></Label>
                <Input
                  value={editing?.title ?? ""}
                  onChange={(e) => setEditing((p) => p && ({ ...p, title: e.target.value }))}
                  placeholder="A great post title"
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editing?.status ?? "draft"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, status: v as "draft" | "published" }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (hidden)</SelectItem>
                    <SelectItem value="published">Published (live)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={editing?.slug ?? ""}
                onChange={(e) => setEditing((p) => p && ({ ...p, slug: e.target.value }))}
                placeholder="auto from title"
                className="h-11 rounded-xl bg-surface-2/60 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">URL: <span className="font-mono">/blog/post?slug={editing?.slug ? slugify(editing.slug) : (editing?.title ? slugify(editing.title) : "...")}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label>Excerpt</Label>
              <Textarea
                rows={2}
                value={editing?.excerpt ?? ""}
                onChange={(e) => setEditing((p) => p && ({ ...p, excerpt: e.target.value }))}
                placeholder="Short summary shown on the blog list (1-2 lines)."
                className="rounded-xl bg-surface-2/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cover image</Label>
              <ImageDrop value={editing?.cover_image ?? null} onChange={(d) => setEditing((p) => p && ({ ...p, cover_image: d }))} />
              <p className="text-[11px] text-muted-foreground">Landscape (16:9) reads best at the top of the post.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Content (Markdown)</Label>
              <Textarea
                rows={14}
                value={editing?.content ?? ""}
                onChange={(e) => setEditing((p) => p && ({ ...p, content: e.target.value }))}
                placeholder={"# Section heading\n\nWrite your post here. Use **bold**, *italic*, [links](https://example.com), `inline code`, and bullet lists with `-`.\n\n> Pull quotes work too.\n\n```\nCode blocks live between triple backticks.\n```"}
                className="rounded-xl bg-surface-2/60 font-mono text-sm leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <GradientButton onClick={save} disabled={busy}>{editing?.id ? "Save changes" : "Save"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>It will disappear from the public blog immediately. This action is soft — the row is kept for audit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-brand text-brand-foreground hover:bg-brand/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
